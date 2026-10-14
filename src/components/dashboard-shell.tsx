import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  ClipboardList,
  CalendarDays,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export type DashboardRole = "learner" | "tutor" | "admin";
export type DashboardUser = { id: number; firstName: string; role: DashboardRole };

type NavItem = {
  label: string;
  to:
    | "/dashboard"
    | "/dashboard/classes"
    | "/dashboard/attendance"
    | "/dashboard/students"
    | "/dashboard/assignments"
    | "/dashboard/resources"
    | "/dashboard/messages"
    | "/notifications"
    | "/admin";
  icon: typeof LayoutDashboard;
};

function navigation(role: DashboardRole): NavItem[] {
  const items: NavItem[] = [
    { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
    {
      label: role === "tutor" ? "My classes" : "Classes",
      to: "/dashboard/classes",
      icon: CalendarDays,
    },
    ...(role === "tutor" || role === "learner" || role === "admin"
      ? [{ label: "Attendance", to: "/dashboard/attendance" as const, icon: ClipboardList }]
      : []),
    ...(role === "tutor"
      ? [{ label: "Students", to: "/dashboard/students" as const, icon: Users }]
      : []),
    ...(role === "tutor" || role === "learner"
      ? [{ label: "Assignments", to: "/dashboard/assignments" as const, icon: ClipboardList }]
      : []),
    ...((role === "learner" || role === "tutor")
      ? [{ label: "My Resources", to: "/dashboard/resources" as const, icon: BookOpen }]
      : []),
    ...(role === "tutor" || role === "learner"
      ? [{ label: "Messages", to: "/dashboard/messages" as const, icon: MessageCircle }]
      : []),
  ];
  if (role === "admin") items.splice(1, 0, { label: "Admin", to: "/admin", icon: Users });
  return items;
}

export function DashboardShell({
  user,
  children,
}: {
  user: DashboardUser;
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    let timeoutId = 0;
    let lastActivityAt = 0;
    const logout = async () => {
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Could not end your session.");
        window.location.replace("/login?reason=inactivity");
      } catch (error) {
        console.error("Automatic sign out failed.", error);
        toast.error("Automatic sign out failed. Please check your connection and sign out.");
        timeoutId = window.setTimeout(() => void logout(), 60_000);
      }
    };
    const scheduleLogout = () => {
      window.clearTimeout(timeoutId);
      lastActivityAt = Date.now();
      timeoutId = window.setTimeout(() => void logout(), INACTIVITY_TIMEOUT_MS);
    };
    const onActivity = () => {
      if (Date.now() - lastActivityAt >= 1000) scheduleLogout();
    };
    const activityEvents = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];

    scheduleLogout();
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }
    return () => {
      window.clearTimeout(timeoutId);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, onActivity);
      }
    };
  }, [user.id]);
  useEffect(() => {
    if (user.role === "admin") return;
    const load = () =>
      fetch("/api/chat/unread-count", { credentials: "include" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => setUnreadCount(Number(data?.count ?? 0)))
        .catch(() => undefined);
    void load();
    window.addEventListener("tusome:messages-read", load);
    const interval = window.setInterval(load, 15000);
    return () => {
      window.removeEventListener("tusome:messages-read", load);
      window.clearInterval(interval);
    };
  }, [user.role]);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = navigation(user.role);
  const isActive = (to: string) => pathname === to;
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  };

  return (
    <div
      data-dashboard-role={user.role}
      className="min-h-screen min-w-0 overflow-x-clip bg-[image:var(--gradient-dashboard)] text-foreground"
    >
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/dashboard" aria-label="Dashboard home" className="flex shrink-0 items-center">
            <BrandLogo
              className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]"
              imageClassName="h-full w-full"
            />
          </Link>
          <nav className="hidden min-w-0 items-center gap-1 xl:flex">
            {items.map(({ label, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive(to) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4" />
                {to === "/dashboard/messages" && unreadCount ? (
                  <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              to="/notifications"
              aria-current={isActive("/notifications") ? "page" : undefined}
              aria-label="Notifications"
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition sm:px-3 ${isActive("/notifications") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <Bell className="h-4 w-4 shrink-0" />
              <span>Notifications</span>
            </Link>
            <ThemeToggle />
            <div className="hidden items-center gap-2 border-l pl-3 xl:flex">
              <span className="text-sm font-medium">{user.firstName}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                {user.role}
              </span>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="xl:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </header>
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-[100] xl:hidden" role="presentation">
          <button
            className="absolute inset-0 bg-foreground/35 backdrop-blur-[1px]"
            aria-label="Close navigation"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[min(19rem,calc(100vw-2.5rem))] max-w-full flex-col overflow-y-auto border-r bg-background pb-[max(1rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] shadow-2xl"
            aria-label="Dashboard navigation"
          >
            <div className="flex h-20 shrink-0 items-center justify-between border-b px-4">
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Dashboard home"
              >
                <BrandLogo className="h-16 w-16" imageClassName="h-full w-full" />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation"
              >
                <X />
              </Button>
            </div>
            <div className="flex-1 space-y-1 p-3">
              {items.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex min-h-12 items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${isActive(to) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {to === "/dashboard/messages" && unreadCount ? (
                    <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                  {label}
                </Link>
              ))}
              <button
                onClick={signOut}
                className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}
      {children}
    </div>
  );
}
