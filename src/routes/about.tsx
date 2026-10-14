import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHero } from "@/components/page-shell";
import { ArrowUpRight, Target, Heart, Lightbulb, Users } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About Elimusphere — Our mission for CBE learners" },
      {
        name: "description",
        content:
          "Elimusphere's mission is to make quality CBE classes affordable and accessible across Kenya.",
      },
      { property: "og:title", content: "About Elimusphere" },
      {
        property: "og:description",
        content: "Quality CBE classes, made affordable for every Kenyan family.",
      },
    ],
  }),
});

const values = [
  {
    icon: Target,
    title: "Outcomes first",
    desc: "Every class, note and conversation is designed to move the learner forward.",
  },
  {
    icon: Heart,
    title: "Affordable access",
    desc: "Pricing built for Kenyan families — pay per session or subscribe monthly.",
  },
  {
    icon: Lightbulb,
    title: "CBE expertise",
    desc: "Tutors trained in the Competency Based Education framework for Grades 7–9.",
  },
  {
    icon: Users,
    title: "Parents in the loop",
    desc: "Real progress reports so guardians always know how their learner is doing.",
  },
];

const founders = [
  {
    name: "Joseph Wandera",
    role: "Founder & CEO",
    image: "/founder-stephen-owiti-omondi.png",
    bio: "Joseph is an educator and entrepreneur passionate about transforming education through technology. He provides the strategic vision for Elimusphere Systems, oversees curriculum development, drives innovation, and builds partnerships that expand access to quality education.",
  },
  {
    name: "Stephen Owiti Omondi",
    role: "Co-Founder & Chief Operating Officer",
    image: "/founder-joseph-wandera.jpg",
    bio: "Stephen manages the day-to-day operations of Elimusphere Systems, ensuring excellence in programme delivery, tutor coordination, learner support, and operational efficiency.",
  },
];

function AboutPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="About us"
        title={
          <>
            Building Kenya's most trusted{" "}
            <span className="bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">
              CBE learning home
            </span>
            .
          </>
        }
        subtitle="Elimusphere started with a simple belief: every learner in Kenya deserves a great tutor — no matter where they live, or what their family can afford."
      />

      <section className="mx-auto max-w-7xl px-6 py-20 grid lg:grid-cols-2 gap-12">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold">Our story</h2>
          <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
            <p>
              The shift to CBE left many Kenyan families searching for trustworthy academic support.
              Private tutors are often unaffordable, hard to vet, and rarely aligned with the new
              competency-based curriculum.
            </p>
            <p>
              We built Elimusphere to change that. Our platform connects Grade 7, 8 and 9 learners
              with qualified CBE tutors for live online lessons — delivered through Google Meet,
              paid for via Safaricom, and supported with notes, assignments and homework help.
            </p>
            <p>
              Whether it's a quick homework rescue at 7pm on a school night or a full holiday
              revision programme, Elimusphere is the always-on academic partner Kenyan families have
              been waiting for.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h3 className="text-2xl font-bold">Our vision</h3>
          <p className="mt-4 text-muted-foreground">
            To become Kenya's leading online CBE classes and learning support platform — making
            quality education affordable and accessible to every learner, while giving them the
            timely guidance and structured materials they need to thrive.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { k: "Grades 1–12", v: "CBE focus" },
              { k: "1:1 & Group", v: "Class formats" },
              { k: "Evenings", v: "Weekends & holidays" },
              { k: "Safaricom", v: "Easy payments" },
            ].map((s) => (
              <div key={s.v} className="rounded-2xl bg-secondary p-4">
                <p className="font-display font-bold text-primary">{s.k}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-border bg-[image:var(--gradient-soft)] py-20 sm:py-24">
        <div className="pointer-events-none absolute -right-24 top-16 h-64 w-64 rounded-full border-[24px] border-accent/10" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-primary/5" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="max-w-2xl animate-card-fade-in">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Meet our founders
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              The people behind the purpose.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Elimusphere is shaped by educators and operators who believe technology should make
              learning more human, more reachable, and more effective.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {founders.map((founder, index) => (
              <article
                key={founder.name}
                className={`group overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)] ${index === 0 ? "animate-section-slide-in-left" : "animate-section-slide-in-right"}`}
              >
                <div className="relative aspect-[1.15] overflow-hidden bg-secondary">
                  <img
                    src={founder.image}
                    alt={founder.name}
                    className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/55 via-transparent to-transparent opacity-70" />
                  <div className="absolute bottom-5 left-5 rounded-full bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent-foreground">
                    {founder.role}
                  </div>
                </div>
                <div className="p-7 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-2xl font-bold text-foreground">
                        {founder.name}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-primary">{founder.role}</p>
                    </div>
                    <ArrowUpRight
                      className="mt-1 h-5 w-5 shrink-0 text-accent transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-5 leading-relaxed text-muted-foreground">{founder.bio}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-3xl text-center">
            <p className="text-xl font-semibold leading-relaxed text-foreground sm:text-2xl">
              Together, the founders share a vision of making quality education accessible,
              affordable, and impactful for every learner through technology and innovation.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[image:var(--gradient-soft)] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl md:text-4xl font-bold max-w-2xl">What we stand for.</h2>
          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {values.map((v) => (
              <div key={v.title} className="rounded-2xl border border-border bg-card p-6">
                <div className="h-12 w-12 rounded-xl bg-[image:var(--gradient-hero)] text-primary-foreground flex items-center justify-center">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-semibold text-lg">{v.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
