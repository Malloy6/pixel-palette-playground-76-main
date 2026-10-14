import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Clock, Users, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell, type DashboardUser } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { getClassSessionStartWaitDays, isClassSessionStartAllowed } from "@/lib/class-schedule";

type LiveClass = {
  id: number;
  subject: string;
  grade: string;
  tutorName: string;
  tutorUserId?: number | null;
  scheduleLabel: string;
  seatsTaken: number;
  seatsTotal: number;
  priceKes: number;
  isLive?: boolean;
  upcomingSessions?: Array<{
    id: number;
    scheduledAt: string;
    bookingCount: number;
    isBooked: boolean;
    isLive: boolean;
  }>;
};

type CustomServiceRequest = {
  id: number;
  learnerName: string;
  serviceType: string;
  packageType: string;
  grade: string;
  subjects: string[];
  lessonCount: number;
  amountKes: number;
  status: string;
  schedules: Array<{
    id: number;
    subject: string;
    scheduledAt: string;
    tutorName: string;
  }>;
};

export const Route = createFileRoute("/dashboard/classes")({
  component: DashboardClassesPage,
  head: () => ({ meta: [{ title: "Classes | Dashboard | Elimusphere" }] }),
});

function DashboardClassesPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [customRequests, setCustomRequests] = useState<CustomServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 15_000);
    let cancelled = false;
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" }).then((response) =>
        response.ok ? response.json() : null,
      ),
      fetch("/api/classes", { credentials: "include" }).then((response) =>
        response.ok ? response.json() : null,
      ),
    ])
      .then(([account, classPayload]) => {
        if (cancelled) return;
        setUser(account?.user ?? null);
        setClasses(Array.isArray(classPayload?.classes) ? classPayload.classes : []);
        if (account?.user) {
          fetch("/api/service-requests", { credentials: "include" })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
              if (!cancelled && Array.isArray(payload?.requests))
                setCustomRequests(payload.requests);
            })
            .catch(() => undefined);
        }
        if (account?.user?.role === "learner")
          fetch("/api/classes/subscribed", { credentials: "include" })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
              if (!cancelled && Array.isArray(payload?.classes)) setClasses(payload.classes);
            })
            .catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearInterval(clock);
    };
  }, []);

  const visibleClasses = useMemo(
    () =>
      user?.role === "tutor"
        ? classes.filter((liveClass) => liveClass.tutorUserId === user.id)
        : classes,
    [classes, user],
  );

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[image:var(--gradient-dashboard)]">
        Loading your classes…
      </main>
    );
  }
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center p-4">
        <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Sign in to see your classes</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your schedule and live lesson access are available in the dashboard.
          </p>
          <Link to="/login" className="mt-6 inline-block">
            <Button>Sign in</Button>
          </Link>
        </section>
      </main>
    );
  }

  const isTutor = user.role === "tutor";
  return (
    <DashboardShell user={user}>
      <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-10">
        <section className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Learning workspace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {isTutor ? "My classes" : "Your classes"}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              {isTutor
                ? "Keep track of the live sessions you are teaching and open a room when it is time to begin."
                : "Your registered classes appear here. Paid learners make a new M-Pesa payment for each live session."}
            </p>
          </div>
          <Link to="/classes">
            <Button variant="outline" className="w-full sm:w-auto">
              Browse public catalogue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </section>

        {customRequests.length ? (
          <section className="mt-8">
            <h2 className="text-xl font-semibold">Custom lessons and homework help</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paid requests and administrator-created schedules.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {customRequests.map((request) => (
                <article key={request.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {request.serviceType === "one_on_one"
                          ? "One-on-one classes"
                          : "Homework help"}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {request.packageType.replaceAll("_", " ")} · {request.grade} ·{" "}
                        {request.subjects.join(", ")}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">
                      {request.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {request.amountKes === 0
                      ? "Free"
                      : `KSh ${request.amountKes.toLocaleString("en-KE")} paid`}
                  </p>
                  {request.status === "pending_schedule" ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      An administrator is preparing your schedule. We’ll email you when the class
                      times are confirmed.
                    </p>
                  ) : null}
                  {request.schedules.length ? (
                    <div className="mt-4 space-y-2 border-t pt-3">
                      {request.schedules.map((schedule) => (
                        <div key={schedule.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                          <p className="font-medium">{schedule.subject}</p>
                          <p className="mt-1 text-muted-foreground">
                            {new Date(schedule.scheduledAt).toLocaleString("en-KE", {
                              dateStyle: "full",
                              timeStyle: "short",
                              timeZone: "Africa/Nairobi",
                            })}
                          </p>
                          <p className="text-muted-foreground">
                            {isTutor
                              ? `Learner: ${request.learnerName}`
                              : `Tutor: ${schedule.tutorName}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {visibleClasses.length ? (
          <section className="mt-8 grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleClasses.map((liveClass) => (
              <article key={liveClass.id} className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {liveClass.grade}
                  </span>
                  <span
                    className={
                      liveClass.isLive
                        ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                        : "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    }
                  >
                    {liveClass.isLive ? (
                      <>
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />{" "}
                        Live now
                      </>
                    ) : (
                      "Live class"
                    )}
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-semibold">{liveClass.subject}</h2>
                <p className="mt-1 text-sm text-muted-foreground">with {liveClass.tutorName}</p>
                <dl className="mt-6 space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    {liveClass.scheduleLabel}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {liveClass.seatsTaken} / {liveClass.seatsTotal} seats
                  </div>
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" />
                    Online via Jitsi Meet
                  </div>
                </dl>
                <div className="mt-6 flex items-center justify-between gap-4 border-t pt-5">
                  <span className="font-semibold">
                    {liveClass.priceKes === 0 ? "Free" : `Ksh ${liveClass.priceKes}`}
                    {liveClass.priceKes > 0 ? (
                      <span className="font-normal text-muted-foreground"> / session</span>
                    ) : null}
                  </span>
                  <div className="flex items-center gap-2">
                    {isTutor ? (
                      <Link to="/dashboard/students">
                        <Button size="sm" variant="outline">
                          Manage students
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-t pt-4">
                  <p className="text-sm font-medium">Upcoming sessions</p>
                  {(liveClass.upcomingSessions ?? []).slice(0, 3).map((slot) => (
                    <div
                      key={slot.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(slot.scheduledAt).toLocaleString("en-KE", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Africa/Nairobi",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {slot.bookingCount} learner{slot.bookingCount === 1 ? "" : "s"} booked
                          {isTutor ? "" : slot.isBooked ? " · You are booked" : ""}
                        </p>
                      </div>
                      {isTutor &&
                      (slot.isLive || isClassSessionStartAllowed(slot.scheduledAt, now)) ? (
                        <Link
                          to="/conference/$classId"
                          params={{ classId: String(liveClass.id) }}
                          search={{ sessionId: slot.id }}
                        >
                          <Button size="sm" variant="outline">
                            {slot.isLive ? "Join session" : "Start session"}
                          </Button>
                        </Link>
                      ) : isTutor ? (
                        <Button size="sm" variant="outline" disabled>
                          Starts in {getClassSessionStartWaitDays(slot.scheduledAt, now) ?? "—"}
                        </Button>
                      ) : slot.isBooked && slot.isLive ? (
                        <Link
                          to="/conference/$classId"
                          params={{ classId: String(liveClass.id) }}
                          search={{ sessionId: slot.id }}
                        >
                          <Button size="sm">Join · pay for this session</Button>
                        </Link>
                      ) : slot.isBooked ? (
                        <span className="text-xs font-medium text-primary">Booked</span>
                      ) : null}
                    </div>
                  ))}
                  {!liveClass.upcomingSessions?.length ? (
                    <p className="text-sm text-muted-foreground">
                      No future sessions scheduled. Ask an administrator to update this class
                      timetable.
                    </p>
                  ) : null}
                  {!isTutor ? (
                    <Link
                      to="/classes"
                      className="inline-block text-sm font-medium text-primary underline"
                    >
                      {user.role === "admin"
                        ? "Browse public class catalogue"
                        : "Browse and book another session"}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="mt-8 rounded-2xl border border-dashed bg-card p-8 text-center shadow-sm">
            <CalendarDays className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-4 text-xl font-semibold">
              {isTutor ? "No classes assigned yet" : "No classes scheduled yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {isTutor
                ? "Classes assigned by an administrator will appear here."
                : "Browse the catalogue to register for a class. Paid classes are charged one session at a time when you join a live lesson."}
            </p>
            {!isTutor ? (
              <Link to="/classes" className="mt-6 inline-block">
                <Button>Browse classes</Button>
              </Link>
            ) : null}
          </section>
        )}
      </main>
    </DashboardShell>
  );
}
