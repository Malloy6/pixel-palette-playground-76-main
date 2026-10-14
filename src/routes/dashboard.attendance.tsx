import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Flame, Users } from "lucide-react";
import { DashboardShell, type DashboardUser } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { getClassSessionStartWaitDays, isClassSessionStartAllowed } from "@/lib/class-schedule";

type AttendanceClass = {
  classId: number;
  subject: string;
  grade: string;
  tutorName: string;
  scheduleLabel: string;
  scheduleDays: number[];
  startTime: string | null;
  registeredLearners: number;
  completedSessions: number;
  sessionsTaught: number;
};

type ScheduledClassSession = {
  id: number;
  classId: number;
  scheduledAt: string;
  bookingCount: number;
  isBooked: boolean;
  roomId: number | null;
  isLive: boolean;
};

type AttendanceRecord = {
  roomId: number;
  classSessionId: number | null;
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
  scheduledAt: string;
  completedAt: string;
};

type AttendanceResponse = {
  summary: {
    totalRecords: number;
    totalSessions: number;
    attended: number;
    attendedSessions: number;
    missed: number;
    missedSessions: number;
    currentStreak: number;
  };
  records: AttendanceRecord[];
};

export const Route = createFileRoute("/dashboard/attendance")({
  component: AttendancePage,
  head: () => ({ meta: [{ title: "Attendance | Dashboard | Elimusphere" }] }),
});

function AttendancePage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [learnerStreak, setLearnerStreak] = useState(0);
  const [selectedClass, setSelectedClass] = useState<AttendanceClass | null>(null);
  const [classAttendance, setClassAttendance] = useState<AttendanceResponse | null>(null);
  const [selectedSession, setSelectedSession] = useState<AttendanceRecord[] | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<ScheduledClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 15_000);
    let cancelled = false;
    async function load() {
      try {
        const authResponse = await fetch("/api/auth/me", { credentials: "include" });
        const auth = await authResponse.json().catch(() => ({}));
        if (!authResponse.ok || !auth.user) throw new Error("Please sign in to view attendance.");
        const currentUser = auth.user as DashboardUser;
        if (cancelled) return;
        setUser(currentUser);

        if (currentUser.role === "learner") {
          const response = await fetch("/api/attendance?limit=1", { credentials: "include" });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok)
            throw new Error(payload.message ?? "Attendance streak could not be loaded.");
          if (!cancelled) setLearnerStreak(Number(payload.summary?.currentStreak ?? 0));
        } else {
          const classesPath =
            currentUser.role === "admin"
              ? "/api/admin/attendance/classes"
              : "/api/attendance/classes";
          const response = await fetch(classesPath, { credentials: "include" });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok)
            throw new Error(payload.message ?? "Attendance classes could not be loaded.");
          if (!cancelled) setClasses(Array.isArray(payload.classes) ? payload.classes : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Attendance could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      window.clearInterval(clock);
    };
  }, []);

  const groupedSessions = useMemo(() => {
    const groups = new Map<number, AttendanceRecord[]>();
    for (const record of classAttendance?.records ?? []) {
      groups.set(record.roomId, [...(groups.get(record.roomId) ?? []), record]);
    }
    return [...groups.entries()].map(([roomId, records]) => ({
      roomId,
      records,
      tutor: records.find((record) => record.role === "tutor"),
      session: records[0],
    }));
  }, [classAttendance]);

  async function openClass(liveClass: AttendanceClass) {
    setSelectedClass(liveClass);
    setSelectedSession(null);
    setClassAttendance(null);
    setUpcomingSessions([]);
    setDetailLoading(true);
    setError(null);
    try {
      const basePath = user?.role === "admin" ? "/api/admin/attendance" : "/api/attendance";
      const [attendanceResponse, scheduledResponse] = await Promise.all([
        fetch(`${basePath}?classId=${liveClass.classId}&limit=200&offset=0`, {
          credentials: "include",
        }),
        fetch(`/api/classes/${liveClass.classId}/sessions`, { credentials: "include" }),
      ]);
      const [payload, scheduledPayload] = await Promise.all([
        attendanceResponse.json().catch(() => ({})),
        scheduledResponse.json().catch(() => ({})),
      ]);
      if (!attendanceResponse.ok) {
        throw new Error(payload.message ?? "Class sessions could not be loaded.");
      }
      if (!scheduledResponse.ok) {
        throw new Error(scheduledPayload.message ?? "Upcoming sessions could not be loaded.");
      }
      setClassAttendance(payload);
      setUpcomingSessions(
        Array.isArray(scheduledPayload.sessions) ? scheduledPayload.sessions : [],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Class sessions could not be loaded.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function openSession(roomId: number) {
    if (!selectedClass) return;
    setDetailLoading(true);
    setSelectedSession(null);
    setError(null);
    try {
      const basePath = user?.role === "admin" ? "/api/admin/attendance" : "/api/attendance";
      const response = await fetch(
        `${basePath}?classId=${selectedClass.classId}&roomId=${roomId}&limit=200&offset=0`,
        { credentials: "include" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.message ?? "Session attendance could not be loaded.");
      setSelectedSession(payload.records ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Session attendance could not be loaded.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadMoreSessions() {
    if (!selectedClass || !classAttendance) return;
    setDetailLoading(true);
    setError(null);
    try {
      const basePath = user?.role === "admin" ? "/api/admin/attendance" : "/api/attendance";
      const response = await fetch(
        `${basePath}?classId=${selectedClass.classId}&limit=200&offset=${classAttendance.records.length}`,
        { credentials: "include" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "More sessions could not be loaded.");
      setClassAttendance((current) =>
        current ? { ...payload, records: [...current.records, ...payload.records] } : payload,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "More sessions could not be loaded.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center">Loading attendance…</main>;
  }
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center">{error ?? "Sign in required."}</main>
    );
  }

  if (user.role === "learner") {
    return (
      <DashboardShell user={user}>
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <header className="mb-8">
            <p className="text-sm font-medium text-primary">Learning record</p>
            <h1 className="mt-2 text-3xl font-bold">Attendance streak</h1>
            <p className="mt-2 text-muted-foreground">
              Your streak is based on completed sessions for classes you are registered in.
            </p>
          </header>
          {error ? (
            <p
              role="alert"
              className="mb-5 rounded-xl border border-destructive/30 p-4 text-destructive"
            >
              {error}
            </p>
          ) : null}
          <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Flame className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Current attendance streak</p>
                <p className="mt-1 text-4xl font-bold">{learnerStreak}</p>
              </div>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              {learnerStreak === 1
                ? "You attended your latest completed class session."
                : learnerStreak > 1
                  ? `You attended your last ${learnerStreak} completed class sessions in a row.`
                  : "Attend a registered class session to start your streak."}
            </p>
          </section>
        </main>
      </DashboardShell>
    );
  }

  const totalSessions = classes.reduce((sum, liveClass) => sum + liveClass.completedSessions, 0);
  const sessionsTaught = classes.reduce((sum, liveClass) => sum + liveClass.sessionsTaught, 0);
  const sessionsMissed = Math.max(0, totalSessions - sessionsTaught);
  const selectedSessions = new Set(groupedSessions.map((session) => session.roomId));

  return (
    <DashboardShell user={user}>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8">
          <p className="text-sm font-medium text-primary">
            {user.role === "admin" ? "Platform records" : "Teaching record"}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Class attendance</h1>
          <p className="mt-2 text-muted-foreground">
            Choose a class and a completed session to review registered learners, attendance time,
            and missed sessions.
          </p>
        </header>
        {error ? (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-destructive/30 p-4 text-destructive"
          >
            {error}
          </p>
        ) : null}
        <section className="mb-7 grid gap-3 sm:grid-cols-3">
          <AttendanceMetric label="Total sessions" value={totalSessions} icon={<CalendarDays />} />
          <AttendanceMetric label="Sessions taught" value={sessionsTaught} icon={<Clock />} />
          <AttendanceMetric label="Sessions missed" value={sessionsMissed} icon={<Users />} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.5fr)]">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Assigned classes</h2>
            {classes.map((liveClass) => (
              <button
                key={liveClass.classId}
                type="button"
                onClick={() => void openClass(liveClass)}
                className={`w-full rounded-2xl border bg-card p-4 text-left transition hover:border-primary ${selectedClass?.classId === liveClass.classId ? "border-primary ring-1 ring-primary" : ""}`}
              >
                <span className="font-semibold">{liveClass.subject}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {liveClass.grade} · {liveClass.tutorName}
                </span>
                <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{liveClass.completedSessions} sessions</span>
                  <span>{liveClass.sessionsTaught} taught</span>
                  <span>{liveClass.registeredLearners} registered learners</span>
                </span>
              </button>
            ))}
            {classes.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                No classes with attendance records are assigned to you yet.
              </p>
            ) : null}
          </section>

          <section className="min-w-0 rounded-3xl border bg-card p-5 sm:p-6">
            {selectedClass ? (
              <>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {selectedClass.subject} · {selectedClass.grade}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedClass.sessionsTaught} of {selectedClass.completedSessions} completed
                      sessions taught
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setSelectedClass(null)}>
                    Close class
                  </Button>
                </div>
                {detailLoading && !classAttendance ? (
                  <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                    Loading class sessions…
                  </p>
                ) : null}
                <div className="space-y-3">
                  {groupedSessions.map(({ roomId, session, tutor }) => (
                    <article key={roomId} className="rounded-2xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {new Date(session.scheduledAt).toLocaleString("en-KE", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "Africa/Nairobi",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Started{" "}
                            {new Date(session.startedAt).toLocaleString("en-KE", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "Africa/Nairobi",
                            })}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Tutor: {tutor?.attended ? "Taught" : "Missed"} ·{" "}
                            {formatDuration(tutor?.durationSeconds ?? 0)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void openSession(roomId)}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          View learners
                        </Button>
                      </div>
                      {selectedSession?.[0]?.roomId === roomId ? (
                        <div className="mt-4 overflow-x-auto rounded-xl border">
                          <table className="w-full min-w-[560px] text-left text-sm">
                            <thead className="border-b bg-muted/40 text-muted-foreground">
                              <tr>
                                <th className="p-3 font-medium">Registered learner</th>
                                <th className="p-3 font-medium">Attendance</th>
                                <th className="p-3 font-medium">Time attended</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedSession
                                .filter((record) => record.role === "learner")
                                .map((record) => (
                                  <tr key={record.userId} className="border-b last:border-0">
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
                                ))}
                              {selectedSession.filter((record) => record.role === "learner")
                                .length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="p-4 text-muted-foreground">
                                    No learners were registered for this session.
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
                {classAttendance &&
                classAttendance.records.length < classAttendance.summary.totalRecords ? (
                  <Button
                    className="mt-4 w-full"
                    variant="outline"
                    disabled={detailLoading}
                    onClick={() => void loadMoreSessions()}
                  >
                    {detailLoading ? "Loading…" : "Load more session history"}
                  </Button>
                ) : null}
                {classAttendance && selectedSessions.size === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No completed sessions have been recorded for this class yet.
                  </p>
                ) : null}
                {upcomingSessions.length ? (
                  <div className="mt-7">
                    <h3 className="mb-3 font-semibold">Upcoming scheduled sessions</h3>
                    <ul className="space-y-2">
                      {upcomingSessions.map((slot) => (
                        <li
                          key={slot.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                        >
                          <div>
                            <p className="font-medium">
                              {new Date(slot.scheduledAt).toLocaleString("en-KE", {
                                dateStyle: "medium",
                                timeStyle: "short",
                                timeZone: "Africa/Nairobi",
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {slot.bookingCount} registered learner
                              {slot.bookingCount === 1 ? "" : "s"}
                            </p>
                          </div>
                          {user.role === "tutor" &&
                          (slot.isLive || isClassSessionStartAllowed(slot.scheduledAt, now)) ? (
                            <Link
                              to="/conference/$classId"
                              params={{ classId: String(selectedClass.classId) }}
                              search={{ sessionId: slot.id }}
                            >
                              <Button size="sm" variant="outline">
                                {slot.isLive ? "Join session" : "Start session"}
                              </Button>
                            </Link>
                          ) : user.role === "tutor" ? (
                            <Button size="sm" variant="outline" disabled>
                              Starts in {getClassSessionStartWaitDays(slot.scheduledAt, now) ?? "—"}
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="grid min-h-64 place-items-center text-center text-sm text-muted-foreground">
                Select a class to browse its completed sessions.
              </div>
            )}
          </section>
        </div>
      </main>
    </DashboardShell>
  );
}

function AttendanceMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border bg-card p-5">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </div>
    </article>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return "<1 min";
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}
