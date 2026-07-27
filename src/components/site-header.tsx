import { Link } from "@tanstack/react-router";
import { Menu, X, User } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type Me = { user: { id: number; firstName: string; lastName: string; email: string } | null };

const nav = [
  { to: "/", label: "Home" },
  { to: "/classes", label: "Classes" },
  { to: "/tutors", label: "Tutors" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (mounted) setMe(data as Me);
      } catch (e) {
        if (mounted) setMe(null);
      }
    })();
    const handler = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (mounted) setMe(data as Me);
      } catch (e) {
        if (mounted) setMe(null);
      }
    };
    window.addEventListener('tusome:auth-changed', handler as EventListener);
    return () => {
      mounted = false;
      window.removeEventListener('tusome:auth-changed', handler as EventListener);
    };
  }, []);
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="Tusome Live home" className="flex min-w-0 shrink-0 items-center">
          <BrandLogo imageClassName="h-12 w-36 sm:w-44 lg:w-48" />
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex xl:gap-7">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              activeProps={{ className: "text-foreground font-medium" }}
              className="hover:text-foreground transition"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {me?.user ? (
            <div className="hidden lg:flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-5 w-5" />
                <span className="font-medium">{me.user.firstName}</span>
              </div>
              <Button
                variant="ghost"
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                  setMe(null);
                  window.location.href = '/';
                }}
              >
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
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-6 py-4 flex flex-col gap-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="text-foreground py-1"
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
