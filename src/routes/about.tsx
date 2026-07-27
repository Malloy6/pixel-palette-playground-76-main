import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHero } from "@/components/page-shell";
import { Target, Heart, Lightbulb, Users } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About Tusome Live — Our mission for CBE learners" },
      { name: "description", content: "Tusome Live's mission is to make quality CBE tuition affordable and accessible across Kenya." },
      { property: "og:title", content: "About Tusome Live" },
      { property: "og:description", content: "Quality CBE tuition, made affordable for every Kenyan family." },
    ],
  }),
});

const values = [
  { icon: Target, title: "Outcomes first", desc: "Every class, note and conversation is designed to move the learner forward." },
  { icon: Heart, title: "Affordable access", desc: "Pricing built for Kenyan families — pay per session or subscribe monthly." },
  { icon: Lightbulb, title: "CBE expertise", desc: "Tutors trained in the Competency Based Education framework for Grades 7–9." },
  { icon: Users, title: "Parents in the loop", desc: "Real progress reports so guardians always know how their learner is doing." },
];

function AboutPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="About us"
        title={<>Building Kenya's most trusted <span className="bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">CBE learning home</span>.</>}
        subtitle="Tusome Live started with a simple belief: every learner in Kenya deserves a great tutor — no matter where they live, or what their family can afford."
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
              We built Tusome Live to change that. Our platform connects Grade 7, 8 and 9 learners
              with qualified CBE tutors for live online lessons — delivered through Google Meet, paid
              for via M-Pesa, and supported with notes, assignments and homework help.
            </p>
            <p>
              Whether it's a quick homework rescue at 7pm on a school night or a full holiday
              revision programme, Tusome Live is the always-on academic partner Kenyan families
              have been waiting for.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h3 className="text-2xl font-bold">Our vision</h3>
          <p className="mt-4 text-muted-foreground">
            To become Kenya's leading online CBE tuition and learning support platform — making
            quality education affordable and accessible to every learner, while giving them the
            timely guidance and structured materials they need to thrive.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { k: "Grades 7–9", v: "CBE focus" },
              { k: "1:1 & Group", v: "Class formats" },
              { k: "Evenings", v: "Weekends & holidays" },
              { k: "M-Pesa", v: "Easy payments" },
            ].map((s) => (
              <div key={s.v} className="rounded-2xl bg-secondary p-4">
                <p className="font-display font-bold text-primary">{s.k}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.v}</p>
              </div>
            ))}
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