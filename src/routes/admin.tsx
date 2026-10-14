import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  ShieldCheck,
  Users,
  CreditCard,
  BarChart3,
  CalendarDays,
  Check,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CLASS_WEEKDAYS } from "@/lib/class-schedule";

type Role = "learner" | "tutor" | "admin";
type AdminSection =
  | "overview"
  | "applications"
  | "users"
  | "classes"
  | "payments"
  | "reports"
  | "health"
  | "resources";
type User = { id: number; firstName: string; role: Role };
type ApplicantDocument = { name: string; mimeType: string; content?: string };
type Applicant = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  requestedRole: "learner" | "tutor";
  subject: string | null;
  documents: ApplicantDocument[];
  status: string;
  createdAt: string;
};
type Tutor = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
};
type RegisteredUser = {
  id: number;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: Role;
  createdAt: string;
  parentId: number | null;
  canUseWhiteboard: boolean;
  canShareScreen: boolean;
  isActive: boolean;
  suspensionReason: string | null;
};

type AdminCard = {
  title: string;
  description: string;
  section?: Exclude<AdminSection, "overview">;
  href?: "/admin/service-requests";
  Icon: typeof BookOpen;
};

type AdminReports = {
  generatedAt: string;
  usersByRole: Record<string, number>;
  totalClasses: number;
  activeConferences: number;
  totalParticipants: number;
  onlineParticipants: number;
  totalResources: number;
  verifiedPayments: number;
  verifiedRevenueKes: number;
  sessions: Array<{
    id: number;
    classId: number;
    subject: string;
    grade: string;
    tutorName: string;
    startedAt: string;
    endedAt: string | null;
    tutorSeconds: number;
    learnerCount: number;
    learnerSeconds: number;
    tutorPresent: boolean;
  }>;
};

type AttendanceRecord = {
  roomId: number;
  classId: number;
  subject: string;
  grade: string;
  tutorName: string;
  userId: number;
  role: "learner" | "tutor";
  participantName: string;
  attended: boolean;
  durationSeconds: number;
  startedAt: string;
  completedAt: string;
};

type AdminAttendance = {
  summary: {
    totalRecords: number;
    totalSessions: number;
    attended: number;
    attendedSessions: number;
    missed: number;
    missedSessions: number;
    completedSessions: number;
    classesTaught: number;
    tutorMissed: number;
    tutorsTaught: number;
    learnerAttended: number;
    learnerMissed: number;
    upcomingClasses: number;
  };
  records: AttendanceRecord[];
  limit: number;
  offset: number;
};

type AdminAttendanceClass = {
  classId: number;
  subject: string;
  grade: string;
  tutorName: string;
  scheduleLabel: string;
  registeredLearners: number;
  completedSessions: number;
  sessionsTaught: number;
};

type PlatformHealth = {
  database: "connected";
  totalUsers: number;
  activeClasses: number;
  resources: number;
  activeConferences: number;
  onlineParticipants: number;
  pendingPayments: number;
  checkedAt: string;
};

type ActiveConference = {
  id: number;
  subject: string;
  grade: string;
  roomName: string;
  startedAt: string;
};

type ConferenceLog = {
  id: number;
  eventType: string;
  roomId: string | null;
  participantId: string | null;
  createdAt: string;
};
type Payment = {
  id: string;
  userId: number;
  classId: number | null;
  amountKes: number;
  provider: string;
  status: string;
  reference: string | null;
  type: "class" | "resource" | "service";
  itemName: string;
  phoneNumber: string | null;
  checkoutRequestId: string | null;
  merchantRequestId: string | null;
  receipt: string | null;
  learnerName: string;
  createdAt: string;
};

type Resource = {
  id: number;
  title: string;
  description: string | null;
  grade: string | null;
  subject: string | null;
  priceKes: number;
  filePath: string;
  createdAt: string;
};
type AdminClass = {
  id: number;
  subject: string;
  grade: string;
  scheduleLabel: string;
  scheduleDays: number[];
  startTime: string | null;
  seatsTotal: number;
  priceKes: number;
  tutorUserId: number | null;
};

function ClassScheduleFields({
  days = [],
  startTime = "",
}: {
  days?: number[];
  startTime?: string | null;
}) {
  return (
    <>
      <fieldset className="md:col-span-2">
        <legend className="text-sm font-medium">Class days</legend>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {CLASS_WEEKDAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="scheduleDays"
                value={day.value}
                defaultChecked={days.includes(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1.5 text-sm font-medium">
        Start time (East Africa Time)
        <Input name="startTime" type="time" defaultValue={startTime ?? ""} required />
      </label>
    </>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

const cards: AdminCard[] = [
  {
    title: "User management",
    description: "View and manage students, tutors and account roles.",
    section: "users",
    Icon: Users,
  },
  {
    title: "Live classes",
    description: "Manage class schedules, Jitsi rooms and published learning sessions.",
    section: "classes",
    Icon: BookOpen,
  },
  {
    title: "Custom lesson requests",
    description: "Schedule paid one-on-one and homework-help requests and assign tutors.",
    href: "/admin/service-requests",
    Icon: CalendarDays,
  },
  {
    title: "Payments",
    description: "Monitor subscriptions, Safaricom transactions and billing status.",
    section: "payments",
    Icon: CreditCard,
  },
  {
    title: "Reports",
    description: "Review attendance, engagement and platform performance reports.",
    section: "reports",
    Icon: BarChart3,
  },
  {
    title: "Resources",
    description: "Manage downloadable learning resources and pricing.",
    section: "resources",
    Icon: BookOpen,
  },
  {
    title: "Platform health",
    description: "Check service status and conference room availability.",
    section: "health",
    Icon: ShieldCheck,
  },
  {
    title: "Approvals",
    description: "Approve or reject learner and tutor applications.",
    section: "applications",
    Icon: Check,
  },
];

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    section:
      typeof search.section === "string" &&
      [
        "overview",
        "applications",
        "users",
        "classes",
        "payments",
        "reports",
        "health",
        "resources",
      ].includes(search.section)
        ? (search.section as AdminSection)
        : "overview",
  }),
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin dashboard | Elimusphere" }] }),
});

function AdminPage() {
  const { section } = Route.useSearch();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<AdminReports | null>(null);
  const [attendance, setAttendance] = useState<AdminAttendance | null>(null);
  const [attendanceClasses, setAttendanceClasses] = useState<AdminAttendanceClass[]>([]);
  const [selectedAttendanceClass, setSelectedAttendanceClass] =
    useState<AdminAttendanceClass | null>(null);
  const [selectedAttendanceRoom, setSelectedAttendanceRoom] = useState<number | null>(null);
  const [sessionAttendance, setSessionAttendance] = useState<AttendanceRecord[] | null>(null);
  const [sessionAttendanceLoading, setSessionAttendanceLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [platformHealth, setPlatformHealth] = useState<PlatformHealth | null>(null);
  const [activeConferences, setActiveConferences] = useState<ActiveConference[]>([]);
  const [conferenceLogs, setConferenceLogs] = useState<ConferenceLog[]>([]);
  const [applications, setApplications] = useState<Applicant[]>([]);
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [classesList, setClassesList] = useState<AdminClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<number | null>(null);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceGrade, setResourceGrade] = useState("");
  const [resourceSubject, setResourceSubject] = useState("");
  const [resourcePrice, setResourcePrice] = useState("0");
  const [resourceActionId, setResourceActionId] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("");
  const [paymentFrom, setPaymentFrom] = useState("");
  const [paymentTo, setPaymentTo] = useState("");
  const [paymentHistoryCleared, setPaymentHistoryCleared] = useState(false);
  const [applicationStatusFilter, setApplicationStatusFilter] = useState("");
  const [classGradeFilter, setClassGradeFilter] = useState("");
  const [classSubjectFilter, setClassSubjectFilter] = useState("");
  const [resourceGradeFilter, setResourceGradeFilter] = useState("");
  const [resourceSubjectFilter, setResourceSubjectFilter] = useState("");
  const userRef = useRef<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let interval: number | undefined;
    let polling = false;
    let paymentPolling = false;
    let reportPolling = false;
    const requestJson = async (path: string) => {
      const response = await fetch(path, { credentials: "include", signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? `Request failed (${response.status})`);
      return payload;
    };

    async function ensureAdmin() {
      if (userRef.current) return true;
      try {
        const auth = await requestJson("/api/auth/me");
        if (!auth?.user) {
          setError("Please sign in to access admin tools.");
          return false;
        }
        if (auth.user.role !== "admin") {
          setError("You do not have permission to view the admin dashboard.");
          return false;
        }
        if (cancelled) return false;
        userRef.current = auth.user;
        setUser(auth.user);
        return true;
      } catch {
        if (!cancelled) setError("Unable to verify your account at this time.");
        return false;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadHealthData() {
      try {
        const [conferenceData, logData, reportData, healthData] = await Promise.all([
          requestJson("/api/admin/active-conferences"),
          requestJson("/api/admin/conference-logs?limit=200"),
          requestJson("/api/admin/reports"),
          requestJson("/api/admin/health"),
        ]);
        if (!cancelled) {
          setActiveConferences(conferenceData.conferences ?? []);
          setConferenceLogs(logData.logs ?? []);
          setReports(reportData.reports ?? null);
          setPlatformHealth(healthData.health ?? null);
        }
      } catch {
        if (!cancelled) {
          setDataError("Platform health data is currently unavailable.");
          setPlatformHealth(null);
          setActiveConferences([]);
          setConferenceLogs([]);
          setReports(null);
        }
      }
    }

    async function loadSectionData() {
      const authorized = await ensureAdmin();
      if (cancelled || !authorized) return;
      setLoading(false);
      setDataError(null);

      if (section === "overview") return;
      try {
        const requests: Record<string, () => Promise<unknown>> = {
          applications: () => requestJson("/api/admin/applications"),
          users: () => requestJson("/api/admin/users"),
          classes: async () => {
            const [usersPayload, classesPayload] = await Promise.all([
              requestJson("/api/admin/users"),
              requestJson("/api/classes"),
            ]);
            return { usersPayload, classesPayload };
          },
          payments: () => requestJson("/api/admin/payments"),
          reports: async () => {
            const [reportPayload, attendanceClassesPayload] = await Promise.all([
              requestJson("/api/admin/reports"),
              requestJson("/api/admin/attendance/classes"),
            ]);
            return { reportPayload, attendanceClassesPayload };
          },
          resources: () => requestJson("/api/resources"),
        };

        if (section === "health") {
          polling = true;
          await loadHealthData();
          polling = false;
          return;
        }
        if (section === "overview") return;
        const result = (await requests[section]()) as Record<string, unknown>;
        if (cancelled) return;
        if (section === "applications")
          setApplications((result.applications as Applicant[] | undefined) ?? []);
        if (section === "users") {
          const allUsers = (result.users as RegisteredUser[] | undefined) ?? [];
          setUsers(allUsers);
          setTutors(allUsers.filter((candidate) => candidate.role === "tutor"));
        }
        if (section === "classes") {
          const userPayload = result.usersPayload as { users?: RegisteredUser[] };
          const classPayload = result.classesPayload as { classes?: AdminClass[] };
          const allUsers = userPayload.users ?? [];
          setUsers(allUsers);
          setTutors(allUsers.filter((candidate) => candidate.role === "tutor"));
          setClassesList(classPayload.classes ?? []);
        }
        if (section === "payments") setPayments((result.payments as Payment[] | undefined) ?? []);
        if (section === "reports") {
          const reportPayload = result.reportPayload as { reports?: AdminReports };
          setReports(reportPayload.reports ?? null);
          const classesPayload = result.attendanceClassesPayload as {
            classes?: AdminAttendanceClass[];
          };
          setAttendanceClasses(classesPayload.classes ?? []);
        }
        if (section === "resources")
          setResources((result.resources as Resource[] | undefined) ?? []);
      } catch {
        if (!cancelled) {
          setDataError("This admin section could not be loaded. Please try again shortly.");
          if (section === "reports") {
            setReports(null);
            setAttendance(null);
            setAttendanceClasses([]);
          }
        }
      }
    }

    void loadSectionData();
    if (section === "health") {
      interval = window.setInterval(() => {
        if (cancelled || polling || !userRef.current) return;
        polling = true;
        void loadHealthData().finally(() => {
          polling = false;
        });
      }, 30000);
    }
    if (section === "payments") {
      interval = window.setInterval(() => {
        if (cancelled || paymentPolling || !userRef.current) return;
        paymentPolling = true;
        void requestJson("/api/admin/payments")
          .then((payload) => {
            if (!cancelled) setPayments(payload.payments ?? []);
          })
          .catch(() => {
            if (!cancelled) setDataError("Payment history could not be refreshed.");
          })
          .finally(() => {
            paymentPolling = false;
          });
      }, 30000);
    }
    if (section === "reports") {
      interval = window.setInterval(() => {
        if (cancelled || reportPolling || !userRef.current) return;
        reportPolling = true;
        void Promise.all([
          requestJson("/api/admin/reports"),
          requestJson("/api/admin/attendance/classes"),
        ])
          .then(([reportPayload, classesPayload]) => {
            if (!cancelled) {
              setReports(reportPayload.reports ?? null);
              setAttendanceClasses(classesPayload.classes ?? []);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setDataError("Reports could not be refreshed.");
              setReports(null);
              setAttendanceClasses([]);
            }
          })
          .finally(() => {
            reportPolling = false;
          });
      }, 30000);
    }
    return () => {
      cancelled = true;
      controller.abort();
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [section]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[image:var(--gradient-dashboard-admin)]">
        <main className="mx-auto max-w-7xl px-6 py-20">Loading admin dashboard…</main>
      </main>
    );
  }

  if (!user || error) {
    return (
      <main className="grid min-h-screen place-items-center bg-[image:var(--gradient-dashboard-admin)]">
        <main className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-3xl font-bold">Admin access required</h1>
          <p className="mt-4 text-muted-foreground">
            {error ?? "Only administrators can access this page."}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button variant="outline" onClick={() => navigate({ to: "/login" })}>
              Sign in
            </Button>
            <Button onClick={() => navigate({ to: "/dashboard" })}>Return to dashboard</Button>
          </div>
        </main>
      </main>
    );
  }

  async function reviewApplication(id: number, action: "approve" | "reject") {
    const response = await fetch(`/api/admin/applications/${id}/${action}`, {
      method: "POST",
      credentials: "include",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.message ?? "Could not update application.");
    setApplications((items) =>
      items.map((item) =>
        item.id === id ? { ...item, status: action === "approve" ? "approved" : "rejected" } : item,
      ),
    );
    if (payload.user)
      setTutors((items) => (payload.user.role === "tutor" ? [...items, payload.user] : items));
    toast.success(
      action === "approve"
        ? "Application approved and access email sent."
        : "Application rejected.",
    );
  }

  async function resendApprovalEmail(id: number) {
    const response = await fetch(`/api/admin/applications/${id}/resend-approval`, {
      method: "POST",
      credentials: "include",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.message ?? "Could not resend access email.");
    toast.success("Access email resent to applicant.");
  }

  async function loadMoreAttendance() {
    if (
      !attendance ||
      !selectedAttendanceClass ||
      attendanceLoading ||
      attendance.records.length >= attendance.summary.totalRecords
    )
      return;
    setAttendanceLoading(true);
    try {
      const response = await fetch(
        `/api/admin/attendance?classId=${selectedAttendanceClass.classId}&limit=${attendance.limit}&offset=${attendance.records.length}`,
        { credentials: "include" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message ?? "Attendance records could not be loaded.");
      }
      setAttendance((current) =>
        current
          ? {
              ...payload,
              records: [...current.records, ...(payload.records as AttendanceRecord[])],
            }
          : payload,
      );
    } catch (loadError) {
      toast.error(
        loadError instanceof Error ? loadError.message : "Attendance records could not be loaded.",
      );
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function openAttendanceClass(liveClass: AdminAttendanceClass) {
    setSelectedAttendanceClass(liveClass);
    setSelectedAttendanceRoom(null);
    setSessionAttendance(null);
    setAttendance(null);
    setAttendanceLoading(true);
    try {
      const response = await fetch(
        `/api/admin/attendance?classId=${liveClass.classId}&limit=200&offset=0`,
        { credentials: "include" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message ?? "Class attendance could not be loaded.");
      }
      setAttendance(payload as AdminAttendance);
    } catch (loadError) {
      toast.error(
        loadError instanceof Error ? loadError.message : "Class attendance could not be loaded.",
      );
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function openAttendanceSession(roomId: number) {
    if (!selectedAttendanceClass) return;
    setSelectedAttendanceRoom(roomId);
    setSessionAttendance(null);
    setSessionAttendanceLoading(true);
    try {
      const response = await fetch(
        `/api/admin/attendance?classId=${selectedAttendanceClass.classId}&roomId=${roomId}&limit=200&offset=0`,
        { credentials: "include" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message ?? "Session attendance could not be loaded.");
      }
      setSessionAttendance(payload.records ?? []);
    } catch (loadError) {
      toast.error(
        loadError instanceof Error ? loadError.message : "Session attendance could not be loaded.",
      );
      setSelectedAttendanceRoom(null);
    } finally {
      setSessionAttendanceLoading(false);
    }
  }

  async function updateUserProfileRole(id: number, role: Role) {
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.message ?? "Could not update user role.");

    const nextUsers = users.map((item) => (item.id === id ? { ...item, role } : item));
    setUsers(nextUsers);
    setTutors(
      nextUsers
        .filter((candidate) => candidate.role === "tutor")
        .map((candidate) => ({
          id: candidate.id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
          role: candidate.role,
          isActive: candidate.isActive,
        })),
    );
    toast.success("User role updated.");
  }

  async function updateUserAccountStatus(user: RegisteredUser) {
    const isActive = !user.isActive;
    const suspensionReason = isActive
      ? null
      : window.prompt("Reason for pausing this account during investigation:");
    if (!isActive && !suspensionReason?.trim()) return;
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive, suspensionReason: suspensionReason?.trim() }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.message ?? "Could not update account status.");
    setUsers((items) =>
      items.map((item) => (item.id === user.id ? { ...item, ...payload.user } : item)),
    );
    toast.success(isActive ? "Account reactivated." : "Account paused during investigation.");
  }

  async function updateConferencePermissions(
    userId: number,
    permissions: { canUseWhiteboard: boolean; canShareScreen: boolean },
  ) {
    const response = await fetch(`/api/admin/users/${userId}/conference-permissions`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(permissions),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      return toast.error(payload.message ?? "Could not update conference permissions.");
    setUsers((items) =>
      items.map((item) => (item.id === userId ? { ...item, ...permissions } : item)),
    );
    toast.success("Conference permissions updated.");
  }

  async function deleteRegisteredUser(id: number) {
    const confirmed = window.confirm("Remove this registered user from the platform?");
    if (!confirmed) return;
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.message ?? "Could not delete user.");
    setUsers((items) => items.filter((item) => item.id !== id));
    setTutors((items) => items.filter((item) => item.id !== id));
    toast.success("User removed.");
  }

  function openApplicantDocument(document: ApplicantDocument) {
    if (!document.content) {
      toast.error("Document preview is unavailable for this file.");
      return;
    }

    const url = `data:${document.mimeType};base64,${document.content}`;
    window.open(url, "_blank");
  }

  async function createClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/classes", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject: form.get("subject"),
        grade: form.get("grade"),
        scheduleDays: form.getAll("scheduleDays").map(Number),
        startTime: form.get("startTime"),
        seatsTotal: Number(form.get("seatsTotal")),
        priceKes: Number(form.get("priceKes")),
        tutorUserId: Number(form.get("tutorUserId")),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.message ?? "Could not create class.");
    formElement.reset();
    if (payload.emailSent) {
      toast.success("Class created and assigned. The tutor was notified by email.");
    } else {
      toast.error(
        payload.message ??
          "Class was assigned, but the tutor notification email could not be sent.",
      );
    }
    // refresh classes list
    fetch("/api/classes", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setClassesList(d?.classes ?? []))
      .catch(() => undefined);
  }

  async function updateClass(id: number, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const scheduleDays = form.getAll("scheduleDays").map(Number);
    if (!scheduleDays.length) return toast.error("Choose at least one class day.");
    const response = await fetch(`/api/classes/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject: form.get("subject"),
        grade: form.get("grade"),
        scheduleDays,
        startTime: form.get("startTime"),
        seatsTotal: Number(form.get("seatsTotal")),
        priceKes: Number(form.get("priceKes")),
        tutorUserId: Number(form.get("tutorUserId")),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.message ?? "Could not update class.");
    setClassesList((items) => items.map((item) => (item.id === id ? payload.class : item)));
    if (payload.emailSent === false) {
      toast.error(
        payload.message ?? "Class was updated, but the tutor notification email could not be sent.",
      );
    } else if (payload.emailSent) {
      toast.success("Class updated and the newly assigned tutor was notified by email.");
    } else {
      toast.success("Class updated.");
    }
  }

  async function deleteClass(id: number) {
    const confirmed = window.confirm("Delete this class? This cannot be undone.");
    if (!confirmed) return;
    const response = await fetch(`/api/classes/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return toast.error(payload.message ?? "Could not delete class.");
    }
    setClassesList((items) => items.filter((it) => it.id !== id));
    toast.success("Class deleted.");
  }

  function startEditingResource(resource: Resource) {
    setEditingResourceId(resource.id);
    setResourceTitle(resource.title);
    setResourceDescription(resource.description ?? "");
    setResourceGrade(resource.grade ?? "");
    setResourceSubject(resource.subject ?? "");
    setResourcePrice(String(resource.priceKes));
  }

  async function saveResource(id: number) {
    setResourceActionId(id);
    try {
      const response = await fetch(`/api/admin/resources/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: resourceTitle,
          description: resourceDescription,
          grade: resourceGrade,
          subject: resourceSubject,
          priceKes: Number(resourcePrice),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return toast.error(payload.message ?? "Could not update resource.");
      setResources((items) => items.map((item) => (item.id === id ? payload.resource : item)));
      setEditingResourceId(null);
      toast.success("Resource updated.");
    } catch {
      toast.error("Could not update resource. Check your connection and try again.");
    } finally {
      setResourceActionId(null);
    }
  }

  async function removeResource(id: number) {
    const confirmed = window.confirm(
      "Delete this resource? This also removes purchase records and revokes download access.",
    );
    if (!confirmed) return;
    setResourceActionId(id);
    try {
      const response = await fetch(`/api/admin/resources/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return toast.error(payload.message ?? "Could not delete resource.");
      setResources((items) => items.filter((item) => item.id !== id));
      if (editingResourceId === id) setEditingResourceId(null);
      toast.success("Resource deleted.");
    } catch {
      toast.error("Could not delete resource. Check your connection and try again.");
    } finally {
      setResourceActionId(null);
    }
  }

  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const filteredUsers = users.filter(
    (record) =>
      (!userRoleFilter || record.role === userRoleFilter) &&
      (!normalizedUserSearch ||
        `${record.firstName} ${record.lastName} ${record.email} ${record.phone ?? ""} ${record.id}`
          .toLowerCase()
          .includes(normalizedUserSearch)),
  );
  const filteredApplications = applications.filter(
    (application) => !applicationStatusFilter || application.status === applicationStatusFilter,
  );
  const filteredClasses = classesList.filter(
    (liveClass) =>
      (!classGradeFilter || liveClass.grade === classGradeFilter) &&
      (!classSubjectFilter || liveClass.subject === classSubjectFilter),
  );
  const filteredResources = resources.filter(
    (resource) =>
      (!resourceGradeFilter || resource.grade === resourceGradeFilter) &&
      (!resourceSubjectFilter || resource.subject === resourceSubjectFilter),
  );
  const resourceGrades = [
    ...new Set(
      resources.map((item) => item.grade).filter((grade): grade is string => Boolean(grade)),
    ),
  ].sort();
  const resourceSubjects = [
    ...new Set(
      resources
        .map((item) => item.subject)
        .filter((subject): subject is string => Boolean(subject)),
    ),
  ].sort();
  const normalizedPaymentSearch = paymentSearch.trim().toLowerCase();
  const filteredPayments = payments.filter((record) => {
    const createdDate = String(record.createdAt).slice(0, 10);
    return (
      (!paymentStatusFilter || record.status === paymentStatusFilter) &&
      (!paymentTypeFilter || record.type === paymentTypeFilter) &&
      (!paymentFrom || createdDate >= paymentFrom) &&
      (!paymentTo || createdDate <= paymentTo) &&
      (!normalizedPaymentSearch ||
        `${record.reference ?? ""} ${record.learnerName} ${record.phoneNumber ?? ""} ${record.itemName} ${record.receipt ?? ""} ${record.checkoutRequestId ?? ""} ${record.merchantRequestId ?? ""}`
          .toLowerCase()
          .includes(normalizedPaymentSearch))
    );
  });
  const visiblePayments = paymentHistoryCleared ? [] : filteredPayments;

  function resetPaymentFilters() {
    setPaymentSearch("");
    setPaymentStatusFilter("");
    setPaymentTypeFilter("");
    setPaymentFrom("");
    setPaymentTo("");
    toast.success("Payment filters cleared.");
  }

  function clearPaymentHistoryView() {
    setPaymentHistoryCleared(true);
    toast.success("Payment history cleared from this view. Saved records are unchanged.");
  }

  function exportPayments() {
    if (!filteredPayments.length) {
      toast.error("There are no matching payment records to export.");
      return;
    }
    const columns: Array<[string, (payment: Payment) => string | number | null]> = [
      ["Reference", (payment) => payment.reference],
      ["Learner", (payment) => payment.learnerName],
      ["User ID", (payment) => payment.userId],
      ["Phone", (payment) => payment.phoneNumber],
      ["Type", (payment) => payment.type],
      ["Item", (payment) => payment.itemName],
      ["Amount KES", (payment) => payment.amountKes],
      ["Provider", (payment) => payment.provider],
      ["Status", (payment) => payment.status],
      ["Checkout Request ID", (payment) => payment.checkoutRequestId],
      ["Merchant Request ID", (payment) => payment.merchantRequestId],
      ["Receipt", (payment) => payment.receipt],
      ["Created At", (payment) => payment.createdAt],
    ];
    const csvCell = (value: string | number | null) => {
      const text = String(value ?? "");
      const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replaceAll('"', '""')}"`;
    };
    const csv = [
      columns.map(([label]) => csvCell(label)).join(","),
      ...filteredPayments.map((payment) =>
        columns.map(([, getValue]) => csvCell(getValue(payment))).join(","),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `elimusphere-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (pathname === "/admin/service-requests") return <Outlet />;

  return (
    <DashboardShell user={user}>
      <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Administrator dashboard
            </p>
            <h1 className="mt-2 text-4xl font-bold">Welcome back, {user.firstName}</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Manage users, live classes, subscriptions, reports and platform health.
            </p>
          </div>
          <Button onClick={() => navigate({ to: "/classes" })}>Browse live classes</Button>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ title, description, section: cardSection, href, Icon }) => (
            <article key={title} className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">{title}</h2>
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{description}</p>
              <div className="mt-6">
                {href ? (
                  <Link
                    to={href}
                    search={{ section: "overview" }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Open requests page
                  </Link>
                ) : (
                  <Link
                    to="/admin"
                    search={{ section: cardSection ?? "overview" }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Open section
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>

        {dataError ? (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {dataError}
          </div>
        ) : null}

        <section
          hidden={section !== "applications"}
          className="mt-10 rounded-3xl border bg-card p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Approvals</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Review learner and tutor applications. Approved applicants receive a login email.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {applications.filter((item) => item.status === "under_review").length} pending
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4">
            <label className="grid gap-1.5 text-sm font-medium">
              Application status
              <select
                className="h-10 min-w-44 rounded-md border border-input bg-background px-3"
                value={applicationStatusFilter}
                onChange={(event) => setApplicationStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                {[...new Set(applications.map((application) => application.status))]
                  .sort()
                  .map((status) => (
                    <option value={status} key={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
              </select>
            </label>
            <p className="pb-2 text-sm text-muted-foreground">
              Showing {filteredApplications.length} of {applications.length}
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {filteredApplications.length ? (
              filteredApplications.map((applicant) => (
                <article
                  key={applicant.id}
                  className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {applicant.firstName} {applicant.lastName}{" "}
                      <span className="font-normal capitalize text-muted-foreground">
                        · {applicant.requestedRole}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {applicant.email} · {new Date(applicant.createdAt).toLocaleDateString()}
                    </p>
                    {applicant.subject ? (
                      <p className="text-sm text-muted-foreground">
                        Applying to teach: {applicant.subject}
                      </p>
                    ) : null}
                    {applicant.documents.length ? (
                      <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                        <p className="font-medium">Documents</p>
                        <div className="flex flex-wrap gap-2">
                          {applicant.documents.map((document, index) => (
                            <button
                              key={`${document.name}-${index}`}
                              type="button"
                              onClick={() => openApplicantDocument(document)}
                              className="rounded-full border border-border bg-background px-3 py-1 text-xs text-primary transition hover:bg-primary/5"
                            >
                              View {document.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {applicant.status === "under_review" ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => reviewApplication(applicant.id, "approve")}>
                        <Check className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reviewApplication(applicant.id, "reject")}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize text-muted-foreground">
                        {applicant.status}
                      </span>
                      {applicant.status === "approved" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resendApprovalEmail(applicant.id)}
                        >
                          Resend access email
                        </Button>
                      ) : null}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {applications.length
                  ? "No applications match this status."
                  : "No applications have been submitted."}
              </p>
            )}
          </div>
        </section>

        <section hidden={section !== "users"} className="mt-10 rounded-3xl border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Registered users</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                View full account profile details and manage every registered user from one place.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {filteredUsers.length} of {users.length} accounts
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4">
            <label className="grid min-w-56 flex-1 gap-1.5 text-sm font-medium">
              Search users
              <Input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Name, email, phone or ID"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Role
              <select
                className="h-10 min-w-40 rounded-md border border-input bg-background px-3"
                value={userRoleFilter}
                onChange={(event) => setUserRoleFilter(event.target.value)}
              >
                <option value="">All roles</option>
                <option value="learner">Learner</option>
                <option value="tutor">Tutor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUserSearch("");
                setUserRoleFilter("");
              }}
            >
              Clear filters
            </Button>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="p-3">Profile</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Account status</th>
                  <th className="p-3">Conference permissions</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((userRecord) => (
                  <tr key={userRecord.id} className="border-b last:border-0">
                    <td className="p-3">
                      <div className="font-medium">
                        {userRecord.firstName} {userRecord.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">ID #{userRecord.id}</div>
                    </td>
                    <td className="p-3">{userRecord.email}</td>
                    <td className="p-3">{userRecord.phone ?? "—"}</td>
                    <td className="p-3">
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-base"
                        value={userRecord.role}
                        disabled={!userRecord.isActive}
                        onChange={(event) =>
                          void updateUserProfileRole(userRecord.id, event.target.value as Role)
                        }
                      >
                        <option value="learner">learner</option>
                        <option value="tutor">tutor</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <span
                        className={
                          userRecord.isActive
                            ? "font-medium text-emerald-700"
                            : "font-medium text-destructive"
                        }
                      >
                        {userRecord.isActive ? "Active" : "Paused"}
                      </span>
                      {!userRecord.isActive && userRecord.suspensionReason ? (
                        <p className="mt-1 max-w-48 text-xs text-muted-foreground">
                          {userRecord.suspensionReason}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <div className="space-y-2 text-xs">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={userRecord.canUseWhiteboard}
                            onChange={(event) =>
                              void updateConferencePermissions(userRecord.id, {
                                canUseWhiteboard: event.target.checked,
                                canShareScreen: userRecord.canShareScreen,
                              })
                            }
                          />
                          Whiteboard
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={userRecord.canShareScreen}
                            onChange={(event) =>
                              void updateConferencePermissions(userRecord.id, {
                                canUseWhiteboard: userRecord.canUseWhiteboard,
                                canShareScreen: event.target.checked,
                              })
                            }
                          />
                          Screen sharing
                        </label>
                      </div>
                    </td>
                    <td className="p-3">{new Date(userRecord.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {(userRecord.role === "learner" || userRecord.role === "tutor") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void updateUserAccountStatus(userRecord)}
                          >
                            {userRecord.isActive ? "Pause" : "Reactivate"}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void deleteRegisteredUser(userRecord.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td className="p-5 text-muted-foreground" colSpan={8}>
                      {users.length
                        ? "No users match these filters."
                        : "No registered users found."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section hidden={section !== "classes"} className="mt-10 rounded-3xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Create and assign a class</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Only admins create classes; tutors can start and manage classes assigned to them.
          </p>
          <form className="mt-5 grid gap-4 md:grid-cols-3" onSubmit={createClass}>
            <div>
              <Label>Subject</Label>
              <Input className="mt-2" name="subject" required />
            </div>
            <div>
              <Label>Grade</Label>
              <Input className="mt-2" name="grade" placeholder="Grade 7" required />
            </div>
            <ClassScheduleFields />
            <div>
              <Label>Seats</Label>
              <Input
                className="mt-2"
                name="seatsTotal"
                type="number"
                min="1"
                defaultValue="8"
                required
              />
            </div>
            <div>
              <Label>Price (KES)</Label>
              <Input
                className="mt-2"
                name="priceKes"
                type="number"
                min="0"
                defaultValue="0"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">Enter 0 to make this class free.</p>
            </div>
            <div>
              <Label>Assigned tutor</Label>
              <select
                name="tutorUserId"
                className="mt-2 flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-base"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select an approved tutor
                </option>
                {tutors.map((tutor) => (
                  <option value={tutor.id} key={tutor.id}>
                    {tutor.firstName} {tutor.lastName}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="md:col-span-3 md:justify-self-start">
              Create and assign class
            </Button>
          </form>
          <div className="mt-6">
            <h3 className="text-lg font-medium">Existing classes</h3>
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4">
              <label className="grid gap-1.5 text-sm font-medium">
                Grade
                <select
                  className="h-10 min-w-40 rounded-md border border-input bg-background px-3"
                  value={classGradeFilter}
                  onChange={(event) => setClassGradeFilter(event.target.value)}
                >
                  <option value="">All grades</option>
                  {[...new Set(classesList.map((item) => item.grade))].sort().map((grade) => (
                    <option value={grade} key={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Subject
                <select
                  className="h-10 min-w-48 rounded-md border border-input bg-background px-3"
                  value={classSubjectFilter}
                  onChange={(event) => setClassSubjectFilter(event.target.value)}
                >
                  <option value="">All subjects</option>
                  {[...new Set(classesList.map((item) => item.subject))].sort().map((subject) => (
                    <option value={subject} key={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </label>
              <span className="pb-2 text-sm text-muted-foreground">
                {filteredClasses.length} of {classesList.length} classes
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {filteredClasses.map((c) => (
                <article key={c.id} className="rounded-xl border p-3">
                  <div>
                    <div className="font-medium">
                      {c.subject} · {c.grade}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.scheduleLabel} · {c.priceKes === 0 ? "Free" : `Ksh ${c.priceKes}`}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <details className="w-full rounded-lg border p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        Edit class and schedule
                      </summary>
                      <form
                        className="mt-4 grid gap-4 md:grid-cols-2"
                        onSubmit={(event) => void updateClass(c.id, event)}
                      >
                        <label className="grid gap-1.5 text-sm font-medium">
                          Subject
                          <Input name="subject" defaultValue={c.subject} required />
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium">
                          Grade
                          <Input name="grade" defaultValue={c.grade} required />
                        </label>
                        <ClassScheduleFields days={c.scheduleDays} startTime={c.startTime} />
                        <label className="grid gap-1.5 text-sm font-medium">
                          Seats
                          <Input
                            name="seatsTotal"
                            type="number"
                            min="1"
                            defaultValue={c.seatsTotal}
                            required
                          />
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium">
                          Price (KES)
                          <Input
                            name="priceKes"
                            type="number"
                            min="0"
                            defaultValue={c.priceKes}
                            required
                          />
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium">
                          Assigned tutor
                          <select
                            name="tutorUserId"
                            className="h-10 rounded-md border border-input bg-background px-3"
                            defaultValue={c.tutorUserId ?? ""}
                            required
                          >
                            {tutors.map((tutor) => (
                              <option key={tutor.id} value={tutor.id}>
                                {tutor.firstName} {tutor.lastName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button type="submit" className="md:col-span-2 md:justify-self-start">
                          Save class
                        </Button>
                      </form>
                    </details>
                    <Button size="sm" variant="outline" onClick={() => void deleteClass(c.id)}>
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
              {filteredClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {classesList.length ? "No classes match these filters." : "No classes found."}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section hidden={section !== "resources"} className="mt-10 rounded-3xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Create a resource</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload or register downloadable learning resources with pricing and publish status.
          </p>
          <form
            className="mt-5 grid gap-4 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const formEl = event.currentTarget;
              const fileInput = (
                formEl.querySelector('input[name="file"]') as HTMLInputElement | null
              )?.files?.[0];
              setUploadingResource(true);
              try {
                let response: Response;
                if (fileInput) {
                  const fd = new FormData();
                  fd.append(
                    "title",
                    (formEl.elements.namedItem("title") as HTMLInputElement).value,
                  );
                  fd.append(
                    "description",
                    (formEl.elements.namedItem("description") as HTMLInputElement).value,
                  );
                  fd.append(
                    "grade",
                    (formEl.elements.namedItem("grade") as HTMLInputElement).value,
                  );
                  fd.append(
                    "subject",
                    (formEl.elements.namedItem("subject") as HTMLInputElement).value,
                  );
                  fd.append(
                    "priceKes",
                    (formEl.elements.namedItem("priceKes") as HTMLInputElement).value || "0",
                  );
                  fd.append("file", fileInput, fileInput.name);
                  response = await fetch("/api/admin/resources", {
                    method: "POST",
                    credentials: "include",
                    body: fd,
                  });
                } else {
                  const form = new FormData(formEl);
                  response = await fetch("/api/admin/resources", {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      title: form.get("title"),
                      description: form.get("description"),
                      grade: form.get("grade"),
                      subject: form.get("subject"),
                      priceKes: Number(form.get("priceKes") ?? 0),
                      filePath: form.get("filePath"),
                    }),
                  });
                }
                const payload = await response.json().catch(() => ({}));
                if (!response.ok)
                  return toast.error(payload.message ?? "Could not create resource.");
                toast.success("Resource created.");
                setResources((items) => [payload.resource, ...items]);
                formEl.reset();
              } catch {
                toast.error("Upload failed. Check your connection and try again.");
              } finally {
                setUploadingResource(false);
              }
            }}
          >
            <div>
              <Label>Title</Label>
              <Input name="title" className="mt-2" required />
            </div>
            <div>
              <Label>Price (KES)</Label>
              <Input name="priceKes" className="mt-2" type="number" defaultValue="0" />
              <p className="mt-1 text-xs text-muted-foreground">
                Enter 0 to make this resource free.
              </p>
            </div>
            <div>
              <Label>Grade</Label>
              <Input name="grade" className="mt-2" placeholder="e.g. Grade 7" />
            </div>
            <div>
              <Label htmlFor="resource-subject">Subject</Label>
              <Input
                id="resource-subject"
                name="subject"
                className="mt-2"
                placeholder="e.g. Mathematics"
                maxLength={120}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used by learners to filter resources by subject.
              </p>
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Input name="description" className="mt-2" />
            </div>
            <div className="md:col-span-2">
              <Label>File path or data URL</Label>
              <Input name="filePath" className="mt-2" placeholder="/path/to/file.pdf or data:..." />
            </div>
            <div className="md:col-span-2">
              <Label>Upload file (maximum 25 MB)</Label>
              <input
                type="file"
                name="file"
                className="mt-2 block w-full"
                disabled={uploadingResource}
              />
            </div>
            <Button type="submit" disabled={uploadingResource}>
              {uploadingResource ? "Uploading…" : "Create resource"}
            </Button>
          </form>

          <div className="mt-6">
            <h3 className="text-lg font-medium">Existing resources</h3>
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4">
              <label className="grid gap-1.5 text-sm font-medium">
                Grade
                <select
                  className="h-10 min-w-40 rounded-md border border-input bg-background px-3"
                  value={resourceGradeFilter}
                  onChange={(event) => setResourceGradeFilter(event.target.value)}
                >
                  <option value="">All grades</option>
                  {resourceGrades.map((grade) => (
                    <option value={grade} key={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Subject
                <select
                  className="h-10 min-w-48 rounded-md border border-input bg-background px-3"
                  value={resourceSubjectFilter}
                  onChange={(event) => setResourceSubjectFilter(event.target.value)}
                >
                  <option value="">All subjects</option>
                  {resourceSubjects.map((subject) => (
                    <option value={subject} key={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </label>
              <span className="pb-2 text-sm text-muted-foreground">
                {filteredResources.length} of {resources.length} resources
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {filteredResources.map((r) => (
                <article
                  key={r.id}
                  className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  {editingResourceId === r.id ? (
                    <div className="grid flex-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`resource-title-${r.id}`}>Title</Label>
                        <Input
                          id={`resource-title-${r.id}`}
                          className="mt-1"
                          value={resourceTitle}
                          onChange={(event) => setResourceTitle(event.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`resource-price-${r.id}`}>Price (KES)</Label>
                        <Input
                          id={`resource-price-${r.id}`}
                          className="mt-1"
                          type="number"
                          min="0"
                          step="1"
                          value={resourcePrice}
                          onChange={(event) => setResourcePrice(event.target.value)}
                          required
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Enter 0 to make this resource free.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor={`resource-grade-${r.id}`}>Grade</Label>
                        <Input
                          id={`resource-grade-${r.id}`}
                          className="mt-1"
                          value={resourceGrade}
                          onChange={(event) => setResourceGrade(event.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`resource-subject-${r.id}`}>Subject</Label>
                        <Input
                          id={`resource-subject-${r.id}`}
                          className="mt-1"
                          value={resourceSubject}
                          onChange={(event) => setResourceSubject(event.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor={`resource-description-${r.id}`}>Description</Label>
                        <Input
                          id={`resource-description-${r.id}`}
                          className="mt-1"
                          value={resourceDescription}
                          onChange={(event) => setResourceDescription(event.target.value)}
                        />
                      </div>
                      <div className="flex gap-2 sm:col-span-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={resourceActionId === r.id}
                          onClick={() => void saveResource(r.id)}
                        >
                          <Check className="mr-1 h-4 w-4" /> Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={resourceActionId === r.id}
                          onClick={() => setEditingResourceId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium">{r.title}</div>
                      {r.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                      ) : null}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {[r.subject, r.grade].filter(Boolean).join(" · ")}
                        {r.subject || r.grade ? " · " : ""}
                        {r.priceKes === 0 ? "Free" : `Ksh ${r.priceKes}`} · Added{" "}
                        {new Date(r.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                  {editingResourceId !== r.id ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={resourceActionId !== null}
                        onClick={() => startEditingResource(r)}
                      >
                        <Pencil className="mr-1 h-4 w-4" /> Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={resourceActionId !== null}
                        onClick={() => void removeResource(r.id)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Delete
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
              {filteredResources.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {resources.length ? "No resources match these filters." : "No resources yet."}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section hidden={section !== "payments"} className="mt-10 rounded-3xl border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Payments</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Review Safaricom subscriptions and payment status.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {visiblePayments.length} shown of {payments.length} records
            </span>
          </div>
          <div className="mt-5 grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-2 xl:grid-cols-6">
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
              Search records
              <Input
                value={paymentSearch}
                onChange={(event) => setPaymentSearch(event.target.value)}
                placeholder="Learner, reference, item, receipt or phone"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Status
              <select
                className="h-10 rounded-md border border-input bg-background px-3"
                value={paymentStatusFilter}
                onChange={(event) => setPaymentStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                {[...new Set(payments.map((payment) => payment.status))].sort().map((status) => (
                  <option value={status} key={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Purchase type
              <select
                className="h-10 rounded-md border border-input bg-background px-3"
                value={paymentTypeFilter}
                onChange={(event) => setPaymentTypeFilter(event.target.value)}
              >
                <option value="">All types</option>
                <option value="class">Classes</option>
                <option value="resource">Resources</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              From
              <Input
                type="date"
                value={paymentFrom}
                onChange={(event) => setPaymentFrom(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              To
              <Input
                type="date"
                value={paymentTo}
                onChange={(event) => setPaymentTo(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-6">
              <Button type="button" variant="outline" onClick={resetPaymentFilters}>
                Clear filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (paymentHistoryCleared) setPaymentHistoryCleared(false);
                  else clearPaymentHistoryView();
                }}
              >
                {paymentHistoryCleared ? "Restore history" : "Clear history"}
              </Button>
              <Button type="button" onClick={exportPayments} disabled={!filteredPayments.length}>
                Export filtered CSV
              </Button>
              <span className="pb-2 text-xs text-muted-foreground">
                Clearing hides records from this view only. Saved records remain unchanged.
              </span>
            </div>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Learner</th>
                  <th className="p-3">Safaricom number</th>
                  <th className="p-3">Purchase</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Safaricom checkout ID</th>
                  <th className="p-3">Safaricom merchant ID</th>
                  <th className="p-3">M-Pesa receipt</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-0">
                    <td className="p-3">{payment.reference ?? `Payment ${payment.id}`}</td>
                    <td className="p-3">
                      {payment.learnerName} (#{payment.userId})
                    </td>
                    <td className="p-3">{payment.phoneNumber ?? "—"}</td>
                    <td className="p-3">
                      <span className="capitalize">{payment.type}</span>: {payment.itemName}
                    </td>
                    <td className="p-3">Ksh {payment.amountKes}</td>
                    <td className="p-3">{payment.provider}</td>
                    <td className="p-3">
                      <span className="capitalize">{payment.status}</span>
                    </td>
                    <td className="p-3">{payment.checkoutRequestId ?? "—"}</td>
                    <td className="p-3">{payment.merchantRequestId ?? "—"}</td>
                    <td className="p-3">{payment.receipt ?? "—"}</td>
                    <td className="p-3">{new Date(payment.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {!visiblePayments.length ? (
                  <tr>
                    <td className="p-5 text-muted-foreground" colSpan={11}>
                      {paymentHistoryCleared
                        ? "History cleared from this view. Restore it to show records again."
                        : payments.length
                          ? "No payments match these filters."
                          : "No payments recorded."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section hidden={section !== "reports"} className="mt-8 rounded-3xl border bg-card p-6">
          <div>
            <h2 className="text-xl font-semibold">Completed classes and attendance records</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Select a class to review the tutor's completed sessions. Open a session to see all
              registered learners, who attended, and how long they stayed.
            </p>
          </div>
          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.6fr)]">
            <div className="space-y-3">
              <h3 className="font-semibold">Classes</h3>
              {attendanceClasses.map((liveClass) => (
                <button
                  key={liveClass.classId}
                  type="button"
                  onClick={() => void openAttendanceClass(liveClass)}
                  className={`w-full rounded-2xl border bg-background p-4 text-left hover:border-primary ${selectedAttendanceClass?.classId === liveClass.classId ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  <span className="font-medium">{liveClass.subject}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {liveClass.grade} · {liveClass.tutorName}
                  </span>
                  <span className="mt-3 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    <span>{liveClass.completedSessions} sessions</span>
                    <span>{liveClass.sessionsTaught} taught</span>
                    <span>{liveClass.registeredLearners} learners</span>
                  </span>
                </button>
              ))}
              {!attendanceClasses.length ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No class attendance records are available.
                </p>
              ) : null}
            </div>
            <div className="min-w-0 rounded-2xl border bg-background p-4 sm:p-5">
              {selectedAttendanceClass ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {selectedAttendanceClass.subject} · {selectedAttendanceClass.grade}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedAttendanceClass.sessionsTaught} of{" "}
                        {selectedAttendanceClass.completedSessions} sessions taught
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedAttendanceClass(null);
                        setAttendance(null);
                        setSelectedAttendanceRoom(null);
                        setSessionAttendance(null);
                      }}
                    >
                      Close
                    </Button>
                  </div>
                  {attendanceLoading && !attendance ? (
                    <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                      Loading sessions…
                    </p>
                  ) : null}
                  {attendance ? (
                    <>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <AttendanceSummaryCard
                          label="Total booked sessions"
                          value={attendance.summary.totalSessions ?? attendance.summary.totalRecords}
                        />
                        <AttendanceSummaryCard
                          label="Attended sessions"
                          value={attendance.summary.attendedSessions ?? attendance.summary.attended}
                        />
                        <AttendanceSummaryCard
                          label="Missed sessions"
                          value={attendance.summary.missedSessions ?? attendance.summary.missed}
                        />
                      </div>
                      <div className="mt-5 space-y-3">
                        {groupAttendanceSessions(attendance.records).map((session) => (
                          <article key={session.roomId} className="rounded-xl border p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">
                                  {new Date(session.startedAt).toLocaleString()}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Tutor: {session.tutor?.attended ? "Taught" : "Missed"} ·{" "}
                                  {session.learners.filter((record) => record.attended).length}{" "}
                                  attended ·{" "}
                                  {session.learners.filter((record) => !record.attended).length}{" "}
                                  missed
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void openAttendanceSession(session.roomId)}
                              >
                                View session
                              </Button>
                            </div>
                            {selectedAttendanceRoom === session.roomId ? (
                              <div className="mt-4 overflow-x-auto rounded-lg border">
                                <table className="w-full min-w-[560px] text-left text-sm">
                                  <thead className="border-b bg-muted/40 text-muted-foreground">
                                    <tr>
                                      <th className="p-3 font-medium">Registered learner</th>
                                      <th className="p-3 font-medium">Attendance</th>
                                      <th className="p-3 font-medium">Time attended</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sessionAttendanceLoading ? (
                                      <tr>
                                        <td colSpan={3} className="p-4 text-muted-foreground">
                                          Loading session records…
                                        </td>
                                      </tr>
                                    ) : (
                                      sessionAttendance
                                        ?.filter((record) => record.role === "learner")
                                        .map((record) => (
                                          <tr
                                            key={record.userId}
                                            className="border-b last:border-0"
                                          >
                                            <td className="p-3">{record.participantName}</td>
                                            <td
                                              className={`p-3 ${record.attended ? "text-emerald-700" : "text-destructive"}`}
                                            >
                                              {record.attended ? "Attended" : "Missed"}
                                            </td>
                                            <td className="p-3">
                                              {formatDuration(record.durationSeconds)}
                                            </td>
                                          </tr>
                                        ))
                                    )}
                                    {!sessionAttendanceLoading &&
                                    !sessionAttendance?.some(
                                      (record) => record.role === "learner",
                                    ) ? (
                                      <tr>
                                        <td colSpan={3} className="p-4 text-muted-foreground">
                                          No registered learners were recorded for this session.
                                        </td>
                                      </tr>
                                    ) : null}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}
                          </article>
                        ))}
                      </div>
                      {attendance.records.length < attendance.summary.totalRecords ? (
                        <Button
                          variant="outline"
                          className="mt-4 w-full"
                          onClick={() => void loadMoreAttendance()}
                          disabled={attendanceLoading}
                        >
                          {attendanceLoading ? "Loading…" : "Load more session history"}
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : (
                <div className="grid min-h-56 place-items-center text-center text-sm text-muted-foreground">
                  Select a class to review its tutor sessions and learner attendance.
                </div>
              )}
            </div>
          </div>
        </section>

        <section hidden={section !== "reports"} className="mt-10 rounded-3xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Admin reports</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Review current platform usage, active lessons, and participant metrics.
              </p>
              {reports ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Updated {new Date(reports.generatedAt).toLocaleTimeString()}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-3xl border border-border bg-background p-5">
              <p className="text-sm font-semibold text-muted-foreground">Active classes</p>
              <p className="mt-3 text-3xl font-bold">{reports ? reports.totalClasses : "—"}</p>
            </article>
            <article className="rounded-3xl border border-border bg-background p-5">
              <p className="text-sm font-semibold text-muted-foreground">Active conferences</p>
              <p className="mt-3 text-3xl font-bold">{reports ? reports.activeConferences : "—"}</p>
            </article>
            <article className="rounded-3xl border border-border bg-background p-5">
              <p className="text-sm font-semibold text-muted-foreground">
                Unique learner attendees
              </p>
              <p className="mt-3 text-3xl font-bold">{reports ? reports.totalParticipants : "—"}</p>
            </article>
            <article className="rounded-3xl border border-border bg-background p-5">
              <p className="text-sm font-semibold text-muted-foreground">Currently online</p>
              <p className="mt-3 text-3xl font-bold">
                {reports ? reports.onlineParticipants : "—"}
              </p>
            </article>
            <article className="rounded-3xl border border-border bg-background p-5">
              <p className="text-sm font-semibold text-muted-foreground">Users by role</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {reports
                  ? Object.entries(reports.usersByRole)
                      .map(
                        ([role, count]) => `${role === "other" ? "Other roles" : role}: ${count}`,
                      )
                      .join(" · ")
                  : "Loading…"}
              </p>
            </article>
            <article className="rounded-3xl border border-border bg-background p-5">
              <p className="text-sm font-semibold text-muted-foreground">Available resources</p>
              <p className="mt-3 text-3xl font-bold">{reports ? reports.totalResources : "—"}</p>
            </article>
            <article className="rounded-3xl border border-border bg-background p-5">
              <p className="text-sm font-semibold text-muted-foreground">Verified M-Pesa revenue</p>
              <p className="mt-3 text-3xl font-bold">
                {reports ? `Ksh ${reports.verifiedRevenueKes.toLocaleString()}` : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {reports ? `${reports.verifiedPayments} receipt-confirmed payments` : "Loading…"}
              </p>
            </article>
          </div>
        </section>

        <section hidden={section !== "health"} className="mt-10 rounded-3xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Platform health</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Live database-backed service and activity counts, refreshed every 30 seconds.
              </p>
            </div>
          </div>

          {platformHealth ? (
            <>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-800">
                  Database connected
                </span>
                <span className="text-muted-foreground">
                  Checked {new Date(platformHealth.checkedAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Registered users", platformHealth.totalUsers],
                  ["Active classes", platformHealth.activeClasses],
                  ["Resources", platformHealth.resources],
                  ["Live conferences", platformHealth.activeConferences],
                  ["Online participants", platformHealth.onlineParticipants],
                  ["Pending payments", platformHealth.pendingPayments],
                ].map(([label, value]) => (
                  <article key={label} className="rounded-2xl border bg-background p-4">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-semibold">{value}</p>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p role="status" className="mt-5 rounded-xl border p-4 text-sm text-muted-foreground">
              Live health metrics are unavailable; no healthy status is being assumed.
            </p>
          )}

          <h3 className="mt-8 text-lg font-semibold">Live conference monitor</h3>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4">
              <h3 className="text-sm font-medium">Active conferences</h3>
              <ul className="mt-3 text-sm">
                {activeConferences.length === 0 ? (
                  <li className="text-muted-foreground">No active conferences</li>
                ) : (
                  activeConferences.map((c) => (
                    <li key={c.id} className="py-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {c.subject} ({c.grade})
                          </div>
                          <div className="text-xs text-muted-foreground">{c.roomName}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Started: {new Date(c.startedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <h3 className="text-sm font-medium">Recent conference events (24 hours)</h3>
              <div className="mt-3 max-h-52 overflow-auto text-xs">
                {conferenceLogs.length === 0 ? (
                  <div className="text-muted-foreground">No recent conference events</div>
                ) : (
                  <ul>
                    {conferenceLogs.map((l) => (
                      <li key={l.id} className="border-b py-2 last:border-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{l.eventType}</div>
                            <div className="text-muted-foreground">
                              Room: {l.roomId ?? "—"} · Participant: {l.participantId ?? "—"}
                            </div>
                          </div>
                          <div className="text-muted-foreground">
                            {new Date(l.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        <section hidden={section !== "reports"} className="mt-10 rounded-3xl border bg-card p-6">
          <div>
            <h2 className="text-xl font-semibold">Lesson attendance reports</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The most recent 50 sessions are shown. Live presence uses recent heartbeats;
              disconnected sessions end at their last recorded activity.
            </p>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="p-3">Lesson</th>
                  <th className="p-3">Tutor</th>
                  <th className="p-3">Tutor presence</th>
                  <th className="p-3">Learners</th>
                  <th className="p-3">Session</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {(reports?.sessions ?? []).map((session) => (
                  <tr key={session.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">
                      {session.subject}
                      <span className="block text-xs text-muted-foreground">{session.grade}</span>
                    </td>
                    <td className="p-3">{session.tutorName}</td>
                    <td className="p-3">
                      <span
                        className={session.tutorPresent ? "text-green-700" : "text-destructive"}
                      >
                        {session.tutorPresent
                          ? `Present now · ${formatDuration(session.tutorSeconds)}`
                          : session.tutorSeconds > 0
                            ? `Not present · ${formatDuration(session.tutorSeconds)} recorded`
                            : "No tutor attendance"}
                      </span>
                    </td>
                    <td className="p-3">
                      {session.learnerCount} · {formatDuration(session.learnerSeconds)}
                    </td>
                    <td className="p-3">
                      {new Date(session.startedAt).toLocaleString()}
                      <span className="block text-xs text-muted-foreground">
                        {session.endedAt ? "Ended" : "Live now"}
                      </span>
                    </td>
                    <td className="p-3">
                      {!session.endedAt ? (
                        <Link
                          className="text-primary hover:underline"
                          to="/conference/$classId"
                          params={{ classId: String(session.classId) }}
                        >
                          Supervise
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {reports && reports.sessions.length === 0 ? (
                  <tr>
                    <td className="p-5 text-muted-foreground" colSpan={6}>
                      No class sessions have been recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}

function AttendanceSummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function groupAttendanceSessions(records: AttendanceRecord[]) {
  const grouped = new Map<number, AttendanceRecord[]>();
  for (const record of records) {
    grouped.set(record.roomId, [...(grouped.get(record.roomId) ?? []), record]);
  }
  return [...grouped.entries()].map(([roomId, sessionRecords]) => ({
    roomId,
    startedAt: sessionRecords[0].startedAt,
    tutor: sessionRecords.find((record) => record.role === "tutor"),
    learners: sessionRecords.filter((record) => record.role === "learner"),
  }));
}
