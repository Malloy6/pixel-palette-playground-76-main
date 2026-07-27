import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHero } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Star, BookOpen, Award } from "lucide-react";

export const Route = createFileRoute("/tutors")({
  component: TutorsPage,
  head: () => ({
    meta: [
      { title: "Meet our CBE Tutors | Tusome Live" },
      { name: "description", content: "Verified, qualified CBE tutors teaching Grade 7, 8 and 9 learners across Kenya." },
      { property: "og:title", content: "Meet our CBE Tutors | Tusome Live" },
      { property: "og:description", content: "Browse verified Kenyan CBE tutors." },
    ],
  }),
});

const tutors = [
  { name: "Mr. Kamau", subjects: ["Mathematics", "Pre-Technical"], exp: "8 yrs", rating: 4.9, reviews: 142, initials: "JK" },
  { name: "Ms. Wanjiru", subjects: ["Integrated Science", "Agriculture"], exp: "6 yrs", rating: 4.8, reviews: 98, initials: "AW" },
  { name: "Mr. Otieno", subjects: ["English", "Literature"], exp: "10 yrs", rating: 5.0, reviews: 210, initials: "DO" },
  { name: "Ms. Mwende", subjects: ["Kiswahili"], exp: "5 yrs", rating: 4.9, reviews: 76, initials: "PM" },
  { name: "Mr. Njoroge", subjects: ["Social Studies", "CRE"], exp: "7 yrs", rating: 4.7, reviews: 120, initials: "SN" },
  { name: "Ms. Achieng", subjects: ["Pre-Technical", "Computer Science"], exp: "4 yrs", rating: 4.8, reviews: 64, initials: "LA" },
];

const colors = [
  "from-teal-500 to-emerald-500",
  "from-amber-500 to-orange-500",
  "from-indigo-500 to-blue-500",
  "from-rose-500 to-pink-500",
  "from-cyan-500 to-sky-500",
  "from-fuchsia-500 to-purple-500",
];

function TutorsPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Our tutors"
        title={<>Qualified, verified, and <span className="bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">passionate about CBE</span>.</>}
        subtitle="Every tutor on Tusome Live is interviewed, background-checked and trained in the Competency Based Education framework."
      />

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tutors.map((t, i) => (
            <div key={t.name} className="rounded-2xl border border-border bg-card p-6 hover:shadow-[var(--shadow-elegant)] transition">
              <div className="flex items-center gap-4">
                <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${colors[i]} text-white font-display font-bold text-xl flex items-center justify-center shadow-[var(--shadow-card)]`}>
                  {t.initials}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{t.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-accent text-accent" /> {t.rating} · {t.reviews} reviews
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                <p className="flex items-start gap-2"><BookOpen className="h-4 w-4 text-primary mt-0.5" /> {t.subjects.join(", ")}</p>
                <p className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> {t.exp} CBE experience</p>
              </div>
              <Button variant="outline" className="mt-6 w-full rounded-full">View profile</Button>
            </div>
          ))}
        </div>

        <div className="mt-20 rounded-3xl border border-border bg-card p-10 md:p-14 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">Join the team</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold">Are you a qualified CBE tutor?</h2>
            <p className="mt-4 text-muted-foreground">
              Set your own hours, manage bookings, and get paid weekly via M-Pesa. We handle the platform and the parents — you focus on great teaching.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link to="/signup"><Button size="lg" className="rounded-full">Apply as a tutor</Button></Link>
            <Link to="/contact"><Button size="lg" variant="outline" className="rounded-full">Ask a question</Button></Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}