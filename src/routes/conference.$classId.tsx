import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogIn, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: {
        roomName: string;
        parentNode: HTMLElement;
        width?: string;
        height?: string;
        userInfo?: { displayName?: string; email?: string };
        configOverwrite?: Record<string, unknown>;
        interfaceConfigOverwrite?: Record<string, unknown>;
      },
    ) => {
      dispose: () => void;
      addEventListener: (event: string, listener: () => void) => void;
    };
  }
}

type ConferencePayload = {
  participantId: number;
  roomName: string;
  jitsiDomain: string;
  class: {
    subject: string;
    grade: string;
    tutorName: string;
  };
  userDisplayName?: string;
};

export const Route = createFileRoute("/conference/$classId")({
  component: ConferencePage,
  head: () => ({
    meta: [
      { title: "Live conference | Tusome Live" },
      { name: "description", content: "Join your Tusome Live live class." },
    ],
  }),
});

function loadJitsi(domain: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Jitsi Meet."));
    document.body.appendChild(script);
  });
}

function ConferencePage() {
  const { classId } = Route.useParams();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const participantIdRef = useRef<number | null>(null);
  const [conference, setConference] = useState<ConferencePayload | null>(null);
  const [status, setStatus] = useState("Connecting to class...");

  useEffect(() => {
    let disposed = false;
    let api: InstanceType<NonNullable<typeof window.JitsiMeetExternalAPI>> | undefined;

    async function joinConference() {
      const response = await fetch(`/api/conferences/${classId}/join`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 401) {
        toast.error(payload.message ?? "Please sign in to join class.");
        await navigate({ to: "/login" });
        return;
      }

      if (!response.ok) {
        setStatus(payload.message ?? "Could not join the conference.");
        return;
      }

      const data = payload as ConferencePayload;
      participantIdRef.current = data.participantId;
      setConference(data);
      await loadJitsi(data.jitsiDomain);

      // Reduce Jitsi client log verbosity in non-dev environments
      try {
        // @ts-ignore
        const jm = (window as any).JitsiMeetJS;
        if (jm && typeof jm.setLogLevel === 'function') {
          const level = jm.logLevels?.ERROR ?? 1;
          jm.setLogLevel(level);
        }
      } catch (e) {
        // ignore
      }

      if (disposed || !containerRef.current || !window.JitsiMeetExternalAPI) return;

      containerRef.current.innerHTML = "";
      api = new window.JitsiMeetExternalAPI(data.jitsiDomain, {
        roomName: data.roomName,
        parentNode: containerRef.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName: data.userDisplayName ?? undefined },
        configOverwrite: {
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          // start muted to avoid immediate getUserMedia prompts in some browsers/environments
          startWithAudioMuted: true,
          startWithVideoMuted: true,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
        },
      });
      api.addEventListener("videoConferenceJoined", () => setStatus("Live now"));
      api.addEventListener("videoConferenceLeft", () => {
        void leaveConference();
        void navigate({ to: "/classes" });
      });
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
      api?.dispose();
      void leaveConference();
    };
  }, [classId, navigate]);

  return (
    <PageShell>
      <section className="mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to="/classes"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Classes
            </Link>
            <h1 className="mt-2 text-2xl font-bold">
              {conference
                ? `${conference.class.subject} · ${conference.class.grade}`
                : "Live class"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {conference ? `with ${conference.class.tutorName}` : status}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Video className="h-4 w-4 text-primary" />
            {status}
          </div>
        </div>

        <div className="min-h-[620px] flex-1 overflow-hidden rounded-lg border border-border bg-card">
          <div ref={containerRef} className="h-full min-h-[620px] w-full">
            <div className="flex h-full min-h-[620px] flex-col items-center justify-center gap-4 text-center">
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
      </section>
    </PageShell>
  );
}
