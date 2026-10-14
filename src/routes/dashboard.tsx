import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Plus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell, type DashboardUser } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";

type LiveClass = {
  id: number;
  subject: string;
  grade: string;
  tutorName: string;
  scheduleLabel: string;
  priceKes: number;
  tutorUserId?: number | null;
  isLive?: boolean;
};
type Assignment = {
  id: number;
  title: string;
  status: string;
  grade: number | null;
  feedback: string | null;
  createdAt: string;
};

const copy = {
  learner: {
    title: "Ready for your next lesson?",
    description: "See what is next, keep assignments moving, and stay prepared.",
    primary: "Browse classes",
  },
  tutor: {
    title: "Teach with a clear plan.",
    description: "Keep your upcoming lessons and student work in one focused workspace.",
    primary: "Manage classes",
  },
  admin: {
    title: "Platform overview",
    description: "Monitor teaching activity and manage the platform from one place.",
    primary: "Open admin",
  },
} as const;

export const Route = createFileRoute("/dashboard")({
  component: DashboardRouteView,
  head: () => ({ meta: [{ title: "Dashboard | Elimusphere" }] }),
});

/**
 * Dashboard is a parent route for classes, students and messages. Render its
 * overview only at /dashboard; otherwise hand rendering to the matched child.
 */
function DashboardRouteView() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/dashboard" ? <DashboardPage /> : <Outlet />;
}

function DashboardPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        const data = response.ok ? await response.json() : null;
        const userData = data?.user ?? null;
        if (cancelled) return;
        setUser(userData);
        const classesResponse = await fetch(
          userData?.role === "learner" ? "/api/classes/subscribed" : "/api/classes",
          { credentials: "include" },
        );
        const classesData = classesResponse.ok ? await classesResponse.json() : null;
        if (!cancelled) setClasses(Array.isArray(classesData?.classes) ? classesData.classes : []);
      } catch {
        if (!cancelled) {
          setUser(null);
          setClasses([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshAll() {
    setLoading(true);
    try {
      const me = await fetch("/api/auth/me", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const userData = me?.user ?? null;
      setUser(userData);
      const classesRes = await fetch(
        userData?.role === "learner" ? "/api/classes/subscribed" : "/api/classes",
        { credentials: "include" },
      )
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      setClasses(Array.isArray(classesRes?.classes) ? classesRes.classes : []);
      if (userData) {
        const path = userData.role === "tutor" ? "/api/assignments/tutor" : "/api/assignments";
        const aRes = await fetch(path, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        setAssignments(Array.isArray(aRes?.assignments) ? aRes.assignments : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    const path = user.role === "tutor" ? "/api/assignments/tutor" : "/api/assignments";
    fetch(path, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAssignments(Array.isArray(d?.assignments) ? d.assignments : []))
      .catch(() => setAssignments([]));
  }, [user]);

  const visibleClasses = useMemo(
    () =>
      user?.role === "tutor" ? classes.filter((item) => item.tutorUserId === user.id) : classes,
    [classes, user],
  );
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[image:var(--gradient-dashboard)] text-sm text-muted-foreground">
        Loading your workspace…
      </main>
    );
  if (!user) return <Unauthenticated />;
  const content = copy[user.role] ?? copy.learner;
  const primaryTo = user.role === "admin" ? "/admin" : "/dashboard/classes";

  return (
    <DashboardShell user={user}>
      <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-10">
        <section className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Good to see you, {user.firstName}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{content.title}</h1>
            <p className="mt-3 max-w-xl text-muted-foreground">{content.description}</p>
          </div>
          <div className="flex gap-2">
            <Link to={primaryTo}>
              <Button className="w-full sm:w-auto">
                {content.primary}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" onClick={() => void refreshAll()}>
              Refresh
            </Button>
          </div>
        </section>

        <section className="mt-8 grid min-w-0 gap-4 sm:grid-cols-3">
          <Metric
            icon={CalendarDays}
            label={user.role === "tutor" ? "My upcoming classes" : "Upcoming classes"}
            value={String(visibleClasses.length)}
            note="Scheduled learning sessions"
          />
          <Metric
            icon={ClipboardList}
            label={user.role === "tutor" ? "Student submissions" : "Assignments"}
            value={String(assignments.length)}
            note={assignments.length ? "Needs your attention" : "Nothing pending right now"}
          />
          <Metric
            icon={CheckCircle2}
            label="Completed work"
            value={String(
              assignments.filter((item) => item.status === "reviewed" || item.grade !== null)
                .length,
            )}
            note="Reviewed or graded items"
          />
        </section>

        <section className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
          <Panel
            title={user.role === "tutor" ? "Your next classes" : "Upcoming classes"}
            action="View all"
            to="/dashboard/classes"
          >
            {visibleClasses.slice(0, 4).length ? (
              <div className="divide-y divide-border">
                {visibleClasses.slice(0, 4).map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex min-w-0 flex-col items-stretch gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold">
                        {lesson.subject}{" "}
                        <span className="font-normal text-muted-foreground">· {lesson.grade}</span>
                      </p>
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {lesson.scheduleLabel} · {lesson.tutorName}
                      </p>
                    </div>
                    <Link className="w-full shrink-0 sm:w-auto" to="/dashboard/classes">
                      <Button className="w-full sm:w-auto" variant="outline" size="sm">
                        {lesson.isLive ? "View live session" : "View sessions"}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : user.role === "tutor" ? (
              <div className="rounded-xl border border-dashed bg-card p-6 text-center">
                <p className="text-lg font-semibold">No classes assigned yet</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Classes must be assigned by an administrator to appear here. If you expect to be
                  assigned classes, ask your admin to assign them to your account; click Refresh to
                  re-check.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button onClick={() => void refreshAll()}>Refresh</Button>
                  <Link to="/contact">
                    <Button variant="outline">Contact admin</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <Empty text="No classes are scheduled yet." action="Browse available classes" />
            )}
          </Panel>
          <Panel title="Account reminders" action="View all" to="/notifications">
            <div className="space-y-3">
              <Reminder
                icon={CalendarDays}
                text={
                  visibleClasses.length
                    ? "Check the time for your next live lesson."
                    : "Choose a class to start your schedule."
                }
              />
              <Reminder
                icon={ClipboardList}
                text={
                  assignments.length
                    ? `${assignments.length} assignment${assignments.length === 1 ? "" : "s"} to review or follow up.`
                    : "You are all caught up on assignments."
                }
              />
              <Reminder icon={Users} text="Keep your profile and contact details current." />
            </div>
          </Panel>
        </section>

        <section className="mt-8 grid min-w-0 gap-6 lg:grid-cols-2">
          <Panel
            title={user.role === "tutor" ? "Recent student work" : "Recent assignments"}
            action="Notifications"
            to="/notifications"
          >
            {assignments.slice(0, 3).length ? (
              <div className="space-y-3">
                {assignments.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{item.title}</p>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                        {item.status}
                      </span>
                    </div>
                    {item.feedback ? (
                      <p className="mt-2 text-sm text-muted-foreground">{item.feedback}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="Recent assignment activity will appear here." />
            )}
          </Panel>
          <Panel title="Quick links">
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickLink
                icon={BookOpen}
                title="Class catalogue"
                text="Browse lessons and tutors."
                to="/dashboard/classes"
              />
              <QuickLink
                icon={CalendarDays}
                title="Notifications"
                text="See account reminders."
                to="/notifications"
              />
              {user.role === "admin" ? (
                <QuickLink
                  icon={Users}
                  title="Admin centre"
                  text="Platform reporting tools."
                  to="/admin"
                />
              ) : null}
            </div>
          </Panel>
        </section>
      </main>
    </DashboardShell>
  );
}

function Unauthenticated() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">Sign in to your workspace</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your lessons, reminders and account activity are waiting for you.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link to="/login">
            <Button className="w-full">Sign in</Button>
          </Link>
          <Link to="/signup">
            <Button variant="outline" className="w-full">
              Create account
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-5 text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </article>
  );
}
function Panel({
  title,
  action,
  to,
  children,
}: {
  title: string;
  action?: string;
  to?: "/dashboard/classes" | "/notifications";
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="min-w-0 break-words text-lg font-semibold">{title}</h2>
        {action && to ? (
          <Link to={to} className="shrink-0 text-sm font-medium text-primary hover:underline">
            {action}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
function Empty({ text, action }: { text: string; action?: string }) {
  return (
    <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
      {text}
      {action ? (
        <Link to="/dashboard/classes" className="ml-1 font-medium text-primary hover:underline">
          {action}
        </Link>
      ) : null}
    </div>
  );
}
function Reminder({ icon: Icon, text }: { icon: typeof CalendarDays; text: string }) {
  return (
    <div className="flex gap-3 rounded-xl bg-muted/45 p-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      {text}
    </div>
  );
}
function QuickLink({
  icon: Icon,
  title,
  text,
  to,
}: {
  icon: typeof BookOpen;
  title: string;
  text: string;
  to: "/dashboard/classes" | "/notifications" | "/admin";
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-border p-4 transition hover:border-primary/50 hover:bg-muted/40"
    >
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </Link>
  );
}
