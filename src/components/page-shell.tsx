import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="min-w-0 flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-[image:var(--gradient-soft)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 md:py-28">
        <p className="text-sm font-semibold text-primary uppercase tracking-wider">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl md:text-6xl md:leading-[1.05]">
          {title}
        </h1>
        {subtitle && <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">{subtitle}</p>}
      </div>
    </section>
  );
}
