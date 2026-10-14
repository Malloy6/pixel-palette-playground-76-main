import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MpesaPhoneDialog } from "@/components/mpesa-phone-dialog";
import {
  ArrowLeft,
  LogIn,
  Video,
  ShieldCheck,
  MessageCircle,
  Hand,
  Presentation,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { waitForMpesaPayment } from "@/lib/mpesa-client";

declare global {
  interface Window {
    JitsiMeetJS?: {
      logLevels?: { ERROR?: unknown };
      setLogLevel: (level: unknown) => void;
    };
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: {
        roomName: string;
        parentNode: HTMLElement;
        width?: string;
        height?: string;
        userInfo?: { displayName?: string; email?: string };
        jwt?: string;
        configOverwrite?: Record<string, unknown>;
        interfaceConfigOverwrite?: Record<string, unknown>;
      },
    ) => {
      dispose: () => void;
      executeCommand: (command: string, ...args: unknown[]) => void;
      addEventListener: (event: string, listener: (payload?: unknown) => void) => void;
      getParticipantsInfo: () => Array<{ participantId: string; displayName?: string }>;
    };
  }
}

type ConferencePayload = {
  participantId: number;
  roomName: string;
  jitsiDomain: string;
  jitsiWhiteboardUrl?: string;
  jitsiAppId?: string;
  jitsiJwt?: string;
  class: {
    subject: string;
    grade: string;
    tutorName: string;
  };
  userDisplayName?: string;
  participantRole: "learner" | "tutor" | "admin";
  roomId: number;
  conferencePermissions: {
    canUseWhiteboard: boolean;
    canShareScreen: boolean;
  };
};
type MeetingParticipant = {
  userId: number;
  name: string;
  role: string;
  canUseWhiteboard: boolean;
  canShareScreen: boolean;
};

export const Route = createFileRoute("/conference/$classId")({
  validateSearch: (search: Record<string, unknown>) => ({
    sessionId:
      typeof search.sessionId === "string" && Number.isSafeInteger(Number(search.sessionId))
        ? Number(search.sessionId)
        : undefined,
  }),
  component: ConferencePage,
  head: () => ({
    meta: [
      { title: "Live conference | Elimusphere" },
      { name: "description", content: "Join your Elimusphere live class." },
    ],
  }),
});

function loadJitsi(domain: string, appId?: string) {
  return new Promise<void>((resolve, reject) => {
    try {
      const storage = window.localStorage;
      const staleKeys = Object.keys(storage).filter((key) => /jitsi|meet/i.test(key));
      for (const key of staleKeys) {
        storage.removeItem(key);
      }
    } catch {
      // Ignore storage restrictions in private browsing or locked browser contexts.
    }

    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }

    const source = `https://${domain}${appId ? `/${appId}` : ""}/external_api.js`;
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${source}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Could not load Jitsi Meet.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = source;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Jitsi Meet."));
    document.body.appendChild(script);
  });
}

function ConferencePage() {
  const { classId } = Route.useParams();
  const { sessionId } = Route.useSearch();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const participantIdRef = useRef<number | null>(null);
  const apiRef = useRef<InstanceType<NonNullable<typeof window.JitsiMeetExternalAPI>> | null>(null);
  const [conference, setConference] = useState<ConferencePayload | null>(null);
  const [status, setStatus] = useState("Connecting to class...");
  const [sessionPaymentOpen, setSessionPaymentOpen] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [meetingParticipants, setMeetingParticipants] = useState<MeetingParticipant[]>([]);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [contentSharingActive, setContentSharingActive] = useState(false);
  const [filmStripHidden, setFilmStripHidden] = useState(false);
  const filmStripHiddenRef = useRef(false);
  const tileViewActiveRef = useRef(false);
  const [sharingParticipantIds, setSharingParticipantIds] = useState<string[]>([]);
  const [screenCaptureAvailable, setScreenCaptureAvailable] = useState(true);
  const [screenSharingOn, setScreenSharingOn] = useState(false);
  const [whiteboardActive, setWhiteboardActive] = useState(false);
  const whiteboardOpenRef = useRef(false);
  const [whiteboardRequestSent, setWhiteboardRequestSent] = useState(false);
  const previousWhiteboardPermissionRef = useRef<boolean | null>(null);
  const [permissionState, setPermissionState] = useState<
    "unknown" | "granted" | "denied" | "unavailable" | "prompt"
  >("unknown");
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    setScreenCaptureAvailable(typeof navigator.mediaDevices?.getDisplayMedia === "function");
  }, []);

  async function requestMediaPermissions() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      setPermissionState("denied");
      return { audio: false, video: false, unavailable: false };
    }
    let audio = false;
    let mediaUnavailable = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audio = true;
      stream.getTracks().forEach((t) => t.stop());
    } catch (error) {
      // A missing camera must not prevent a participant from joining by audio.
      mediaUnavailable = error instanceof DOMException && error.name === "NotReadableError";
    }
    setPermissionState(audio ? "granted" : mediaUnavailable ? "unavailable" : "denied");
    return { audio, video: false, unavailable: mediaUnavailable };
  }

  function PermissionInstructions({
    onRetry,
    unavailable = false,
  }: {
    onRetry: () => void;
    unavailable?: boolean;
  }) {
    return (
      <div className="mt-4 rounded-md border border-border bg-background p-4 text-sm">
        <p className="font-medium">
          {unavailable ? "Camera or microphone unavailable" : "Permissions required"}
        </p>
        <p className="mt-2 text-muted-foreground">
          {unavailable
            ? "Your browser granted access, but another app may be using the camera or microphone. Check the device and click Retry."
            : "This class needs access to your camera and microphone. Enable camera and microphone in your browser's site settings, then click Retry."}
        </p>
        <div className="mt-3 flex gap-2">
          <Button onClick={onRetry}>Retry</Button>
          <Button variant="outline" onClick={() => window.open("/help/permissions", "_blank")}>
            How to enable
          </Button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    let disposed = false;
    let whiteboardPollTimer: number | null = null;
    let whiteboardSyncErrorShown = false;

    function minimizeConferenceTiles(
      api: InstanceType<NonNullable<typeof window.JitsiMeetExternalAPI>>,
    ) {
      if (!window.matchMedia("(max-width: 768px), (max-height: 500px)").matches) return;
      try {
        if (tileViewActiveRef.current) {
          api.executeCommand("toggleTileView");
          tileViewActiveRef.current = false;
        }
        if (!filmStripHiddenRef.current) {
          api.executeCommand("toggleFilmStrip");
          filmStripHiddenRef.current = true;
          setFilmStripHidden(true);
        }
      } catch {
        toast.error("Could not expand the shared whiteboard for mobile viewing.");
      }
    }

    function showSharedWhiteboard(
      api: InstanceType<NonNullable<typeof window.JitsiMeetExternalAPI>>,
    ) {
      try {
        api.executeCommand("toggleWhiteboard", true);
        api.executeCommand("setLargeVideoParticipant", "whiteboard");
        api.executeCommand("pinParticipant", "whiteboard");
        whiteboardOpenRef.current = true;
        setWhiteboardActive(true);
        minimizeConferenceTiles(api);
      } catch {
        toast.error("Could not open the tutor's shared whiteboard.");
      }
    }

    function hideSharedWhiteboard(
      api: InstanceType<NonNullable<typeof window.JitsiMeetExternalAPI>>,
    ) {
      try {
        api.executeCommand("toggleWhiteboard", false);
        api.executeCommand("pinParticipant");
        api.executeCommand("setLargeVideoParticipant");
      } catch {
        toast.error("Could not close the shared whiteboard view.");
      } finally {
        whiteboardOpenRef.current = false;
        setWhiteboardActive(false);
      }
    }

    async function syncWhiteboardState(
      api: InstanceType<NonNullable<typeof window.JitsiMeetExternalAPI>>,
      data: ConferencePayload,
    ) {
      try {
        const response = await fetch(`/api/conferences/${data.roomId}/whiteboard-state`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Whiteboard state request failed.");
        const payload: unknown = await response.json();
        if (
          !payload ||
          typeof payload !== "object" ||
          !("visible" in payload) ||
          typeof payload.visible !== "boolean" ||
          !("ended" in payload) ||
          typeof payload.ended !== "boolean"
        ) {
          throw new Error("Whiteboard state response was invalid.");
        }
        if (disposed || apiRef.current !== api) return;
        whiteboardSyncErrorShown = false;
        if (payload.ended) {
          hideSharedWhiteboard(api);
          if (whiteboardPollTimer !== null) {
            window.clearInterval(whiteboardPollTimer);
            whiteboardPollTimer = null;
          }
          api.executeCommand("hangup");
          return;
        }
        if (payload.visible === whiteboardOpenRef.current) return;
        if (payload.visible) showSharedWhiteboard(api);
        else hideSharedWhiteboard(api);
      } catch (error) {
        if (!whiteboardSyncErrorShown) {
          whiteboardSyncErrorShown = true;
          console.error("Could not synchronize conference whiteboard state.", error);
          toast.error("Could not synchronize the whiteboard with this meeting.");
        }
      }
    }

    async function initJitsiClient(data: ConferencePayload) {
      if (disposed || !containerRef.current || !window.JitsiMeetExternalAPI) return null;
      containerRef.current.innerHTML = "";
      const isObserver = data.participantRole === "admin";
      const showWhiteboardButton =
        data.participantRole !== "learner" || data.conferencePermissions.canUseWhiteboard;
      const toolbarButtons = [
        "microphone",
        "camera",
        ...(!isObserver ? ["desktop"] : []),
        "chat",
        "raisehand",
        ...(showWhiteboardButton ? ["whiteboard"] : []),
        "fullscreen",
        "hangup",
        ...(data.participantRole === "tutor" ? ["settings", "stats"] : ["settings"]),
      ];
      const whiteboardCollabServerBaseUrl =
        data.jitsiWhiteboardUrl ?? (data.jitsiAppId ? undefined : `https://${data.jitsiDomain}`);
      const api = new window.JitsiMeetExternalAPI(data.jitsiDomain, {
        roomName: data.jitsiAppId ? `${data.jitsiAppId}/${data.roomName}` : data.roomName,
        parentNode: containerRef.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName: data.userDisplayName ?? undefined },
        jwt: data.jitsiJwt,
        configOverwrite: {
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          // Participants can speak immediately; observer accounts never publish media.
          startWithAudioMuted: false,
          startWithVideoMuted: true,
          startSilent: isObserver,
          whiteboard: {
            enabled: true,
            ...(whiteboardCollabServerBaseUrl
              ? { collabServerBaseUrl: whiteboardCollabServerBaseUrl }
              : {}),
          },
          toolbarButtons: isObserver
            ? [
                "chat",
                "raisehand",
                ...(showWhiteboardButton ? ["whiteboard"] : []),
                "fullscreen",
                "hangup",
                "settings",
              ]
            : toolbarButtons,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: isObserver,
          DISABLE_JOIN_LEAVE_SOUNDS: isObserver,
          VERTICAL_FILMSTRIP: !window.matchMedia("(max-width: 768px), (max-height: 500px)").matches,
          TILE_VIEW_MAX_COLUMNS: 4,
        },
      });
      apiRef.current = api;

      return api;
    }

    async function attemptReconnect(data: ConferencePayload) {
      const maxAttempts = 5;
      reconnectAttemptsRef.current += 1;
      const attempt = reconnectAttemptsRef.current;
      const delay = Math.min(30000, 1000 * Math.pow(2, attempt));
      setStatus(`Connection lost — attempting reconnect (${attempt}/${maxAttempts})`);
      try {
        apiRef.current?.dispose();
      } catch (e) {
        // ignore
      }
      await new Promise((r) => setTimeout(r, delay));
      if (disposed) return;
      if (attempt > maxAttempts) {
        setStatus(
          "Unable to reconnect to the conference. Please refresh the page or try again later.",
        );
        return;
      }
      try {
        const api = await initJitsiClient(data);
        if (!api) throw new Error("no api");
        attachJitsiEventListeners(api, data);
        setStatus("Reconnecting to the conference...");
      } catch (e) {
        // schedule another attempt
        void attemptReconnect(data);
      }
    }

    async function sendLog(data: ConferencePayload, eventType: string, payload: unknown = null) {
      try {
        await fetch("/api/conferences/log", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            roomId: data.roomId,
            participantId: participantIdRef.current,
            eventType,
            payload,
          }),
        });
      } catch {
        // Conference telemetry must not disrupt a live room.
      }
    }

    function attachJitsiEventListeners(
      api: InstanceType<NonNullable<typeof window.JitsiMeetExternalAPI>>,
      data: ConferencePayload,
    ) {
      api.addEventListener("videoConferenceJoined", () => {
        setStatus("Live now");
        reconnectAttemptsRef.current = 0;
        setPermissionState("granted");
        if (data.participantRole !== "tutor") {
          hideSharedWhiteboard(api);
          void syncWhiteboardState(api, data);
          if (whiteboardPollTimer !== null) window.clearInterval(whiteboardPollTimer);
          whiteboardPollTimer = window.setInterval(() => void syncWhiteboardState(api, data), 1500);
        }
        void sendLog(data, "videoConferenceJoined");
      });

      api.addEventListener("videoConferenceLeft", () => {
        if (whiteboardPollTimer !== null) {
          window.clearInterval(whiteboardPollTimer);
          whiteboardPollTimer = null;
        }
        void sendLog(data, "videoConferenceLeft");
        void leaveConference().then(async () => {
          if (!disposed) await navigate({ to: "/classes" });
        });
      });

      api.addEventListener("participantJoined", (payload) => {
        void sendLog(data, "participantJoined", payload);
      });
      api.addEventListener("participantLeft", (payload) => {
        const eventData =
          payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
        if (
          data.participantRole === "learner" &&
          eventData &&
          typeof eventData === "object" &&
          "id" in eventData &&
          eventData.id === "whiteboard"
        ) {
          hideSharedWhiteboard(api);
        }
        void sendLog(data, "participantLeft", payload);
      });
      api.addEventListener(
        "audioMuteStatusChanged",
        (payload) => void sendLog(data, "audioMuteStatusChanged", payload),
      );
      api.addEventListener(
        "videoMuteStatusChanged",
        (payload) => void sendLog(data, "videoMuteStatusChanged", payload),
      );
      api.addEventListener("screenSharingStatusChanged", (payload) => {
        if (
          payload &&
          typeof payload === "object" &&
          "on" in payload &&
          typeof payload.on === "boolean"
        ) {
          setScreenSharingOn(payload.on);
        }
        void sendLog(data, "screenSharingStatusChanged", payload);
      });
      api.addEventListener("contentSharingParticipantsChanged", (payload) => {
        const eventData =
          payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
        const participants = Array.isArray(eventData)
          ? eventData
          : eventData &&
              typeof eventData === "object" &&
              "participants" in eventData &&
              Array.isArray(eventData.participants)
            ? eventData.participants
            : [];
        const sharingIds = participants.filter(
          (participant): participant is string => typeof participant === "string",
        );
        setSharingParticipantIds(sharingIds);
        setContentSharingActive(sharingIds.length > 0);
        if (sharingIds.length > 0) {
          if (tileViewActiveRef.current) {
            api.executeCommand("toggleTileView");
            tileViewActiveRef.current = false;
          }
          api.executeCommand("setLargeVideoParticipant", sharingIds[0], "desktop");
          if (
            window.matchMedia("(max-width: 768px), (max-height: 500px)").matches &&
            !filmStripHiddenRef.current
          ) {
            api.executeCommand("toggleFilmStrip");
            filmStripHiddenRef.current = true;
            setFilmStripHidden(true);
          }
        }
      });
      api.addEventListener("tileViewChanged", (payload) => {
        if (payload && typeof payload === "object" && "enabled" in payload) {
          tileViewActiveRef.current = Boolean(payload.enabled);
        }
      });
      api.addEventListener(
        "recordingStatusChanged",
        (payload) => void sendLog(data, "recordingStatusChanged", payload),
      );
      api.addEventListener(
        "dominantSpeakerChanged",
        (payload) => void sendLog(data, "dominantSpeakerChanged", payload),
      );
      api.addEventListener(
        "connectionQualityChanged",
        (payload) => void sendLog(data, "connectionQualityChanged", payload),
      );
      api.addEventListener("whiteboardStatusChanged", (payload) => {
        const boardStatus =
          payload && typeof payload === "object" && "status" in payload ? payload.status : null;
        if (boardStatus !== "SHOWN" && boardStatus !== "HIDDEN" && boardStatus !== "RESET") return;
        const isOpen = boardStatus === "SHOWN";
        whiteboardOpenRef.current = isOpen;
        setWhiteboardActive(isOpen);
        if (isOpen) minimizeConferenceTiles(api);
        if (data.participantRole === "tutor") {
          void fetch(`/api/conferences/${data.roomId}/whiteboard-state`, {
            method: "PUT",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ visible: isOpen }),
          })
            .then((response) => {
              if (!response.ok) throw new Error("Could not synchronize whiteboard visibility.");
            })
            .catch(() => toast.error("Could not synchronize whiteboard visibility to the room."));
        }
        void sendLog(data, "whiteboardStatusChanged", payload);
      });
      api.addEventListener("connectionFailed", (payload) => {
        if (whiteboardPollTimer !== null) {
          window.clearInterval(whiteboardPollTimer);
          whiteboardPollTimer = null;
        }
        void sendLog(data, "connectionFailed", payload);
        void attemptReconnect(data);
      });
      api.addEventListener("connectionEstablished", () => {
        reconnectAttemptsRef.current = 0;
        setStatus("Live now");
      });
      api.addEventListener("errorOccurred", (payload) => {
        const errorCode =
          payload && typeof payload === "object" && "errorCode" in payload
            ? payload.errorCode
            : null;
        if (errorCode === "conference.videobridgeNotAvailable") {
          setStatus("The meeting server has no available video bridge. Please notify support.");
          void sendLog(data, "videoBridgeUnavailable");
          void leaveConference();
        }
      });
    }

    async function joinConference() {
      const sessionQuery = sessionId ? `?sessionId=${sessionId}` : "";
      const response = await fetch(`/api/conferences/${classId}/join${sessionQuery}`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 401) {
        toast.error(payload.message ?? "Please sign in to join class.");
        await navigate({ to: "/login" });
        return;
      }

      if (response.status === 402 && payload.requiresPayment) {
        setStatus(`This live session costs Ksh ${Number(payload.amountKes).toLocaleString()}.`);
        setSessionPaymentOpen(true);
        return;
      }

      if (!response.ok) {
        setStatus(payload.message ?? "Could not join the conference.");
        return;
      }

      const data = payload as ConferencePayload;
      participantIdRef.current = data.participantId;
      setConference(data);
      if (data.participantRole === "tutor" || data.participantRole === "admin") {
        void fetch(`/api/conferences/${data.roomId}/participants`, { credentials: "include" })
          .then((response) => (response.ok ? response.json() : null))
          .then((payload) => setMeetingParticipants(payload?.participants ?? []))
          .catch(() => undefined);
      }
      try {
        await loadJitsi(data.jitsiDomain, data.jitsiAppId);
      } catch {
        setStatus("Could not load the video service. Please check your connection and try again.");
        return;
      }

      // Verify WebRTC support and request permissions for non-admins
      const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      if (!hasGetUserMedia && data.participantRole !== "admin") {
        setStatus(
          "Your browser does not support WebRTC (getUserMedia). Use Chrome, Edge, Firefox or Safari over HTTPS.",
        );
        return;
      }

      if (data.participantRole !== "admin") {
        // attempt to request permissions; if denied, show instructions
        const permissions = await requestMediaPermissions();
        if (!permissions.audio) {
          setStatus(
            permissions.unavailable ? "Camera or microphone unavailable" : "Permissions required",
          );
          return;
        }
      }

      // Reduce Jitsi client log verbosity in non-dev environments
      try {
        const jm = window.JitsiMeetJS;
        if (jm && typeof jm.setLogLevel === "function") {
          const level = jm.logLevels?.ERROR ?? 1;
          jm.setLogLevel(level);
        }
      } catch (e) {
        // ignore
      }

      if (disposed || !containerRef.current || !window.JitsiMeetExternalAPI) return;

      try {
        const api = await initJitsiClient(data);
        if (!api) return;
        attachJitsiEventListeners(api, data);
      } catch {
        setStatus("Could not start the video room. Please refresh and try again.");
      }
    }

    async function heartbeat() {
      if (!participantIdRef.current) return;
      await fetch("/api/conferences/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId: participantIdRef.current }),
      }).catch(() => undefined);
    }

    async function leaveConference() {
      if (!participantIdRef.current) return;
      const participantId = participantIdRef.current;
      participantIdRef.current = null;
      await fetch("/api/conferences/leave", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId }),
        keepalive: true,
      }).catch(() => undefined);
    }

    void joinConference();
    const heartbeatId = window.setInterval(() => void heartbeat(), 30000);

    return () => {
      disposed = true;
      window.clearInterval(heartbeatId);
      if (whiteboardPollTimer !== null) window.clearInterval(whiteboardPollTimer);
      apiRef.current?.dispose();
      void leaveConference();
    };
  }, [classId, navigate, sessionId]);

  async function toggleFullscreen() {
    const fullscreenTarget = document.querySelector<HTMLElement>("[data-conference-shell]");
    if (!fullscreenTarget) return;
    try {
      if (!document.fullscreenElement) {
        await fullscreenTarget.requestFullscreen();
        if (screen.orientation?.lock)
          await screen.orientation.lock("landscape").catch(() => undefined);
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        screen.orientation?.unlock?.();
        setIsFullscreen(false);
      }

      async function payForCurrentSession(phone: string) {
        try {
          const response = await fetch(`/api/classes/${classId}/mpesa-checkout`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, sessionId }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.message ?? "Session payment could not be started.");
          if (payload.alreadyPaid) {
            window.location.reload();
            return;
          }
          toast.message(
            payload.alreadyPending
              ? "Your payment prompt is pending. Check the phone that received it."
              : "M-Pesa prompt sent. Enter your PIN on your phone.",
          );
          const payment = await waitForMpesaPayment(payload.reference);
          if (payment.status === "completed") {
            toast.success("Payment confirmed. Joining the live session…");
            window.location.reload();
          } else if (payment.status === "failed") {
            toast.error(payment.failureReason ?? "Payment was not completed. You can try again.");
          } else {
            toast.message("Payment is still pending. Reopen the payment prompt after confirmation.");
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Session payment could not be started.");
        }
      }
    } catch {
      toast.error("Fullscreen is not available in this browser.");
    }
  }

  function toggleScreenShare() {
    if (!screenCaptureAvailable) {
      toast.error("Screen sharing is not supported by this browser or device.");
      return;
    }
    const api = apiRef.current;
    if (!api) {
      toast.error("Conference is not ready for screen sharing.");
      return;
    }
    try {
      api.executeCommand("toggleShareScreen");
    } catch {
      toast.error("Could not start screen sharing. Try the Share your screen option in Jitsi.");
    }
  }

  function toggleFilmStrip() {
    const api = apiRef.current;
    if (!api) return toast.error("Conference not ready");
    try {
      if (!filmStripHiddenRef.current && tileViewActiveRef.current) {
        api.executeCommand("toggleTileView");
        tileViewActiveRef.current = false;
      }
      api.executeCommand("toggleFilmStrip");
      filmStripHiddenRef.current = !filmStripHiddenRef.current;
      setFilmStripHidden(filmStripHiddenRef.current);
    } catch {
      toast.error("Could not change participant tile visibility.");
    }
  }

  function focusSharedScreen() {
    const api = apiRef.current;
    const participantId = sharingParticipantIds[0];
    if (!api || !participantId) return;
    try {
      api.executeCommand("setLargeVideoParticipant", participantId, "desktop");
      if (!filmStripHiddenRef.current) toggleFilmStrip();
    } catch {
      toast.error("Could not focus the shared screen.");
    }
  }

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!conference || conference.participantRole !== "learner") return;
    const interval = window.setInterval(() => {
      fetch(`/api/conferences/${conference.roomId}/permissions`, { credentials: "include" })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          const permissions = payload?.permissions;
          if (!permissions) return;
          const wasDenied = previousWhiteboardPermissionRef.current === false;
          previousWhiteboardPermissionRef.current = Boolean(permissions.canUseWhiteboard);
          if (wasDenied && permissions.canUseWhiteboard) {
            window.location.reload();
            return;
          }
          setConference((current) =>
            current ? { ...current, conferencePermissions: permissions } : current,
          );
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [conference]);

  async function updateMeetingPermission(
    participant: MeetingParticipant,
    permissions: { canUseWhiteboard: boolean; canShareScreen: boolean },
  ) {
    if (!conference) return;
    const response = await fetch(
      `/api/conferences/${conference.roomId}/participants/${participant.userId}/permissions`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(permissions),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      return toast.error(payload.message ?? "Could not update learner permissions.");
    setMeetingParticipants((items) =>
      items.map((item) =>
        item.userId === participant.userId ? { ...item, ...permissions } : item,
      ),
    );
  }

  async function requestWhiteboardAccess() {
    if (!conference) return;
    const response = await fetch(`/api/conferences/${conference.roomId}/whiteboard-request`, {
      method: "POST",
      credentials: "include",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.message ?? "Could not request whiteboard access.");
    setWhiteboardRequestSent(true);
    toast.success("Request sent to the tutor.");
  }

  async function endSession() {
    if (!conference) return;
    const response = await fetch("/api/conferences/end", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ roomId: conference.roomId }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast.error(payload.message ?? "Could not end this session.");
      return;
    }
    toast.success("Session ended and attendance report saved.");
    await navigate({ to: "/dashboard" });
  }

  return (
    <section
      data-conference-shell
      data-whiteboard-active={whiteboardActive}
      className="flex h-[100dvh] min-h-0 min-w-0 max-h-[100dvh] max-w-full flex-col overflow-hidden bg-background text-foreground"
    >
      <header
        data-conference-chrome
        className="sticky top-0 z-20 flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border bg-card/95 px-3 py-2 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-5"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/classes"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Classes
            </Link>
            <h1 className="mt-1 truncate text-lg font-bold sm:text-xl">
              {conference
                ? `${conference.class.subject} · ${conference.class.grade}`
                : "Live class"}
            </h1>
            {conference ? (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                with {conference.class.tutorName}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{status}</p>
            )}
          </div>
          <div className="flex min-w-0 max-w-full shrink-0 items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <Video className="h-4 w-4 text-primary" />
            <span className="max-w-[8rem] truncate sm:max-w-none">{status}</span>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </Button>
            {conference?.participantRole === "admin" ? (
              <ShieldCheck className="h-4 w-4" aria-label="Supervisor mode" />
            ) : null}
          </div>
        </div>
      </header>

      <div
        data-conference-content
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden p-2 pb-[max(.5rem,env(safe-area-inset-bottom))] sm:gap-3 sm:p-4"
      >
        {conference ? (
          <div
            data-conference-chrome
            className={`flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-2 py-2 text-xs text-muted-foreground sm:px-4 sm:text-sm ${controlsOpen ? "max-h-[40dvh] overflow-y-auto" : ""}`}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {conference.participantRole === "learner" ? (
                <>
                  <span className="text-xs text-muted-foreground" role="status">
                    {screenCaptureAvailable
                      ? "Present your screen to the class."
                      : "This browser does not support screen capture. Try an up-to-date browser on a supported device."}
                  </span>
                  <Button
                    variant={screenSharingOn ? "destructive" : "outline"}
                    size="sm"
                    className="shrink-0"
                    disabled={!screenCaptureAvailable}
                    title={
                      screenCaptureAvailable
                        ? "Share your screen with the class"
                        : "Screen sharing is not supported by this browser or device"
                    }
                    onClick={toggleScreenShare}
                  >
                    {screenSharingOn ? "Stop sharing" : "Share screen"}
                  </Button>
                </>
              ) : null}
              {conference.participantRole === "learner" &&
              !conference.conferencePermissions.canUseWhiteboard ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={whiteboardRequestSent}
                  onClick={() => void requestWhiteboardAccess()}
                >
                  <Presentation className="h-4 w-4" />
                  {whiteboardRequestSent ? "Request sent" : "Request whiteboard"}
                </Button>
              ) : null}
              {conference.participantRole === "learner" &&
              conference.conferencePermissions.canUseWhiteboard ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="sm:hidden"
                  onClick={() => window.location.reload()}
                >
                  Refresh whiteboard tools
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="sm:hidden"
                onClick={() => void toggleFullscreen()}
              >
                {isFullscreen ? "Exit full screen" : "Full screen"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={controlsOpen}
                aria-controls="meeting-secondary-controls"
                onClick={() => setControlsOpen((open) => !open)}
              >
                {controlsOpen ? "Hide controls" : "More controls"}
              </Button>
            </div>
            <div
              id="meeting-secondary-controls"
              className={`${controlsOpen ? "flex" : "hidden"} w-full min-w-0 flex-wrap items-center gap-3`}
            >
              <span className="inline-flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" /> Chat
              </span>
              <span className="hidden items-center gap-2 md:inline-flex">
                <Hand className="h-4 w-4 text-primary" /> Raise hand
              </span>
              {conference.participantRole === "admin" ? (
                <span className="hidden md:inline">
                  Observer mode: camera and microphone stay off.
                </span>
              ) : (
                <span className="hidden md:inline">
                  Use the Jitsi toolbar to mute, unmute, and collaborate.
                </span>
              )}
            </div>
            {conference.participantRole === "tutor" ? (
              <Button variant="outline" size="sm" onClick={() => void endSession()}>
                End lesson
              </Button>
            ) : null}
            {conference.participantRole === "tutor" ? (
              <div className={`${controlsOpen ? "flex" : "hidden"} min-w-0 items-center gap-2`}>
                <input
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  placeholder="Set room password"
                  className="min-w-0 w-full max-w-40 rounded-md border border-border bg-background px-3 py-1 text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const api = apiRef.current;
                    if (!api) return toast.error("Conference not ready");
                    try {
                      api.executeCommand("password", roomPassword || "");
                      toast.success("Room password set");
                    } catch {
                      toast.error("Could not set room password");
                    }
                  }}
                >
                  Set password
                </Button>
              </div>
            ) : null}
            {conference.participantRole === "tutor" && meetingParticipants.length > 0 ? (
              <details
                className={`${controlsOpen ? "block" : "hidden"} basis-full rounded-md border border-border bg-background p-3`}
              >
                <summary className="cursor-pointer font-medium text-foreground">
                  Learner presentation access
                </summary>
                <div className="mt-3 space-y-2">
                  {meetingParticipants
                    .filter((participant) => participant.role === "learner")
                    .map((participant) => (
                      <div
                        key={participant.userId}
                        className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0"
                      >
                        <span className="text-foreground">{participant.name}</span>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={participant.canUseWhiteboard}
                              onChange={(event) =>
                                void updateMeetingPermission(participant, {
                                  canUseWhiteboard: event.target.checked,
                                  canShareScreen: participant.canShareScreen,
                                })
                              }
                            />
                            Whiteboard
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={participant.canShareScreen}
                              onChange={(event) =>
                                void updateMeetingPermission(participant, {
                                  canUseWhiteboard: participant.canUseWhiteboard,
                                  canShareScreen: event.target.checked,
                                })
                              }
                            />
                            Screen sharing
                          </label>
                        </div>
                      </div>
                    ))}
                </div>
              </details>
            ) : null}
            {conference.participantRole === "learner" ? (
              <Button
                variant="outline"
                size="sm"
                className={controlsOpen ? "" : "hidden"}
                onClick={() => window.location.reload()}
                title="Reload the meeting tools after a tutor grants access"
              >
                Refresh tools
              </Button>
            ) : null}
          </div>
        ) : null}

        {permissionState === "denied" ||
        permissionState === "unavailable" ||
        status === "Permissions required" ? (
          <PermissionInstructions
            unavailable={permissionState === "unavailable"}
            onRetry={async () => {
              const permissions = await requestMediaPermissions();
              if (permissions.audio) {
                window.location.reload();
              } else {
                toast.error(
                  permissions.unavailable
                    ? "Camera or microphone could not be opened. Check that another app is not using them."
                    : "Permissions still denied. Check your browser settings.",
                );
              }
            }}
          />
        ) : null}

        <div
          data-conference-stage
          data-whiteboard-active={whiteboardActive}
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="conference-stage-mobile-controls absolute inset-x-2 top-2 z-30 flex-wrap items-center justify-end gap-2">
            {conference?.participantRole === "learner" ? (
              <Button
                variant={screenSharingOn ? "destructive" : "outline"}
                size="sm"
                disabled={!screenCaptureAvailable}
                title={
                  screenCaptureAvailable
                    ? "Share your screen with the class"
                    : "Screen sharing is not supported by this browser or device"
                }
                onClick={toggleScreenShare}
              >
                {screenSharingOn ? "Stop sharing" : "Share screen"}
              </Button>
            ) : null}
            {contentSharingActive ? (
              <Button variant="outline" size="sm" onClick={focusSharedScreen}>
                Focus presentation
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              aria-pressed={filmStripHidden}
              aria-label={filmStripHidden ? "Show participant tiles" : "Hide participant tiles"}
              onClick={toggleFilmStrip}
            >
              {filmStripHidden ? "Show people" : "Hide people"}
            </Button>
            {isFullscreen ? (
              <Button variant="outline" size="sm" onClick={() => void toggleFullscreen()}>
                Exit full screen
              </Button>
            ) : null}
          </div>
          <div
            ref={containerRef}
            data-room-name={conference?.roomName ?? ""}
            data-jitsi-container
            className="h-full min-h-0 w-full touch-manipulation [&>iframe]:h-full [&>iframe]:min-h-0 [&>iframe]:w-full"
          >
            <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 p-4 text-center">
              <Video className="h-10 w-10 text-primary" />
              <p className="text-sm text-muted-foreground">{status}</p>
              <Link to="/login">
                <Button variant="outline" className="rounded-full">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <MpesaPhoneDialog
        open={sessionPaymentOpen}
        onOpenChange={setSessionPaymentOpen}
        onSubmit={(phone) => void payForCurrentSession(phone)}
      />
    </section>
  );
}
