import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DashboardShell, type DashboardUser } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";

type LiveClass = { id: number; subject: string; grade: string; scheduleLabel: string };
type Assignment = { id: number; title: string; status: string; createdAt: string };
type TimelineEvent = {
  id: number;
  title: string;
  description: string | null;
  eventType?: string;
  eventDate?: string;
};
type Notice = {
  icon: typeof Bell;
  title: string;
  text: string;
  action?: string;
  to?: "/dashboard/classes" | "/dashboard" | "/admin";
};

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications | Elimusphere" }] }),
});

function NotificationsPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!user) return;
    const requests: Promise<void>[] = [
      fetch("/api/timeline", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setTimelineEvents(d?.events ?? []))
        .catch(() => undefined),
    ];
    if (user.role !== "admin") {
      requests.push(
        fetch(user.role === "tutor" ? "/api/classes" : "/api/classes/subscribed", {
          credentials: "include",
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => setClasses(d?.classes ?? []))
          .catch(() => undefined),
        fetch(user.role === "tutor" ? "/api/assignments/tutor" : "/api/assignments", {
          credentials: "include",
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => setAssignments(d?.assignments ?? []))
          .catch(() => undefined),
      );
    }
    void Promise.all(requests);
  }, [user]);
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[image:var(--gradient-dashboard)]">
        Loading notifications…
      </main>
    );
  if (!user)
    return (
      <main className="grid min-h-screen place-items-center">
        <Link to="/login">
          <Button>Sign in to view notifications</Button>
        </Link>
      </main>
    );
  const notices: Notice[] = [
    ...timelineEvents.slice(0, 12).map((event) => ({
      icon: event.eventType?.includes("payment")
        ? CreditCard
        : event.eventType?.includes("approval")
          ? ShieldCheck
          : event.eventType?.includes("class")
            ? CalendarDays
            : event.eventType?.includes("assignment")
              ? CheckCircle2
              : Bell,
      title: event.title,
      text: event.description ?? "A new classroom activity update is available.",
      action:
        event.eventType === "approval_request" || event.eventType === "payment_received"
          ? "Open admin centre"
          : "View dashboard",
      to:
        event.eventType === "approval_request" || event.eventType === "payment_received"
          ? "/admin"
          : "/dashboard",
    })),
    !timelineEvents.length && user.role !== "admin" && classes.length
      ? {
          icon: CalendarDays,
          title: "Upcoming lesson",
          text: `${classes[0].subject} · ${classes[0].grade} is scheduled for ${classes[0].scheduleLabel}.`,
          action: "View classes",
          to: "/dashboard/classes",
        }
      : {
          icon: BookOpen,
          title: "Build your schedule",
          text: "Browse live classes and add a lesson to your learning plan.",
          action: "Browse classes",
          to: "/dashboard/classes",
        },
    !timelineEvents.length && user.role !== "admin" && assignments.length
      ? {
          icon: CheckCircle2,
          title: "Assignment update",
          text: `${assignments.length} assignment${assignments.length === 1 ? " needs" : "s need"} attention.`,
          action: "Open dashboard",
          to: "/dashboard",
        }
      : !timelineEvents.length && user.role !== "admin"
        ? {
            icon: CheckCircle2,
            title: "You’re all caught up",
            text: "There are no assignment reminders at the moment.",
          }
        : !timelineEvents.length
          ? {
              icon: UserRound,
              title: "Administrator updates",
              text: "Review approvals, classes, reports and platform health from the admin centre.",
              action: "Open admin",
              to: "/dashboard",
            }
          : null,
  ].filter(Boolean) as Notice[];
  return (
    <DashboardShell user={user}>
      <main className="mx-auto max-w-3xl px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-10">
        <p className="text-sm font-medium text-primary">Account centre</p>
        <h1 className="mt-2 text-3xl font-bold">Notifications</h1>
        <p className="mt-3 text-muted-foreground">
          Timely reminders about your classes, learning activity and account.
        </p>
        <section className="mt-8 space-y-3">
          {notices.map(({ icon: Icon, title, text, action, to }) => (
            <article key={title} className="flex gap-4 rounded-2xl border bg-card p-5 shadow-sm">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                {action && to ? (
                  <Link
                    to={to}
                    className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    {action}
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}
