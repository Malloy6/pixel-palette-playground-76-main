import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, Menu, X, User } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

type Me = { user: { id: number; firstName: string; lastName: string; email: string } | null };

const nav = [
  { to: "/", label: "Home" },
  { to: "/classes", label: "Classes" },
  { to: "/resources", label: "Resources" },
  { to: "/tutors", label: "Tutors" },
  { to: "/about", label: "About Us" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (mounted) setMe(data as Me);
      } catch (e) {
        if (mounted) setMe(null);
      }
    })();
    const handler = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (mounted) setMe(data as Me);
      } catch (e) {
        if (mounted) setMe(null);
      }
    };
    window.addEventListener("tusome:auth-changed", handler as EventListener);
    return () => {
      mounted = false;
      window.removeEventListener("tusome:auth-changed", handler as EventListener);
    };
  }, []);
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setMe(null);
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="Elimusphere home" className="flex min-w-0 shrink-0 items-center">
          <BrandLogo
            className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]"
            imageClassName="h-full w-full"
          />
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex xl:gap-7">
          {nav.map((n, index) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              activeProps={{ className: "bg-nav-highlight/20 text-foreground font-medium border-nav-highlight/20" }}
              className={
                "transition-all duration-300 px-3 py-1 rounded-md hover:bg-nav-highlight/20 hover:text-foreground border border-transparent hover:border-nav-highlight/20 transform-gpu hover:scale-105 hover:shadow-[0_6px_14px_-6px_rgba(40,112,255,0.18)] hover:-translate-y-1"
              }
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {me?.user ? (
            <div className="hidden lg:flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-5 w-5" />
                <span className="font-medium">{me.user.firstName}</span>
              </div>
              <Link to="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Button variant="ghost" onClick={signOut}>
                Sign out
              </Button>
            </div>
          ) : (
            <>
              <Link to="/login" className="hidden lg:inline-flex">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link to="/signup" className="hidden sm:inline-flex">
                <Button className="rounded-full">Get started</Button>
              </Link>
            </>
          )}
          <button
            className="p-2 -mr-2 lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <div className="px-6 py-4 flex flex-col gap-3">
              {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="text-foreground py-2 px-3 rounded-md transition-colors duration-200 hover:bg-nav-highlight/20 border border-transparent hover:border-nav-highlight/20 transform-gpu transition-transform duration-150 ease-out hover:scale-105 hover:shadow-[0_6px_14px_-6px_rgba(40,112,255,0.18)]"
              >
                {n.label}
              </Link>
            ))}
            {!me?.user ? (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-4">
                <Link to="/login" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup" onClick={() => setOpen(false)}>
                  <Button className="w-full">Get started</Button>
                </Link>
              </div>
            ) : (
              <div className="mt-2 grid gap-2 border-t pt-4">
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2 py-2 font-medium text-foreground hover:bg-muted"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Button variant="outline" className="justify-start" onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
