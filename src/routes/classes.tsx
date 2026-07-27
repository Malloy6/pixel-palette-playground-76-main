import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHero } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Clock, Users, Video, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/classes")({
  component: ClassesPage,
  head: () => ({
    meta: [
      { title: "Live CBE Classes — Grades 7, 8 & 9 | Tusome Live" },
      {
        name: "description",
        content:
          "Browse live online CBE classes for Grade 7, 8 and 9 learners. Group and one-on-one sessions via Google Meet.",
      },
      { property: "og:title", content: "Live CBE Classes | Tusome Live" },
      {
        property: "og:description",
        content: "Book live online tuition with qualified CBE tutors.",
      },
    ],
  }),
});

type LiveClass = {
  id: number;
  subject: string;
  grade: string;
  tutorName: string;
  scheduleLabel: string;
  seatsTaken: number;
  seatsTotal: number;
  priceKes: number;
};

const fallbackClasses: LiveClass[] = [
  {
    id: 1,
    subject: "Mathematics",
    grade: "Grade 7",
    tutorName: "Mr. Kamau",
    scheduleLabel: "Mon & Wed · 6:00pm",
    seatsTaken: 4,
    seatsTotal: 8,
    priceKes: 400,
  },
  {
    id: 2,
    subject: "Integrated Science",
    grade: "Grade 8",
    tutorName: "Ms. Wanjiru",
    scheduleLabel: "Tue & Thu · 5:00pm",
    seatsTaken: 6,
    seatsTotal: 10,
    priceKes: 350,
  },
  {
    id: 3,
    subject: "English",
    grade: "Grade 9",
    tutorName: "Mr. Otieno",
    scheduleLabel: "Sat · 10:00am",
    seatsTaken: 3,
    seatsTotal: 8,
    priceKes: 450,
  },
  {
    id: 4,
    subject: "Kiswahili",
    grade: "Grade 7",
    tutorName: "Ms. Mwende",
    scheduleLabel: "Fri · 4:30pm",
    seatsTaken: 5,
    seatsTotal: 10,
    priceKes: 350,
  },
  {
    id: 5,
    subject: "Social Studies",
    grade: "Grade 8",
    tutorName: "Mr. Njoroge",
    scheduleLabel: "Wed · 6:30pm",
    seatsTaken: 7,
    seatsTotal: 12,
    priceKes: 300,
  },
  {
    id: 6,
    subject: "Pre-Technical",
    grade: "Grade 9",
    tutorName: "Ms. Achieng",
    scheduleLabel: "Sat · 2:00pm",
    seatsTaken: 2,
    seatsTotal: 8,
    priceKes: 450,
  },
];

function ClassesPage() {
  const [classes, setClasses] = useState(fallbackClasses);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/classes")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.classes)) {
          setClasses(payload.classes);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageShell>
      <PageHero
        eyebrow="Live classes"
        title={
          <>
            Pick a class. Join from{" "}
            <span className="bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">
              anywhere in Kenya
            </span>
            .
          </>
        }
        subtitle="Live, interactive CBE tuition with qualified tutors. Group sessions for collaborative learning or one-on-one for focused attention."
      />

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-wrap gap-2 mb-8">
          {["All", "Grade 7", "Grade 8", "Grade 9", "Mathematics", "Sciences", "Languages"].map(
            (tag, i) => (
              <button
                key={tag}
                className={`rounded-full px-4 py-2 text-sm border transition ${
                  i === 0
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {tag}
              </button>
            ),
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((c) => (
            <div
              key={c.id}
              className="group rounded-2xl border border-border bg-card p-6 hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)] transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {c.grade}
                </span>
                <span className="text-xs rounded-full bg-accent/20 text-accent-foreground px-2.5 py-1">
                  Live
                </span>
              </div>
              <h3 className="mt-3 text-xl font-semibold">{c.subject}</h3>
              <p className="text-sm text-muted-foreground">with {c.tutorName}</p>
              <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> {c.scheduleLabel}
                </p>
                <p className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> {c.seatsTaken} / {c.seatsTotal} seats
                </p>
                <p className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" /> Jitsi Meet
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="font-display font-bold text-lg">
                  Ksh {c.priceKes}
                  <span className="text-xs text-muted-foreground font-normal">/session</span>
                </span>
                <Link to="/conference/$classId" params={{ classId: String(c.id) }}>
                  <Button size="sm" className="rounded-full">
                    Join <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-3xl bg-[image:var(--gradient-hero)] p-10 md:p-14 text-primary-foreground shadow-[var(--shadow-elegant)] text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Need a class that's not listed?</h2>
          <p className="mt-3 opacity-90 max-w-xl mx-auto">
            Request a custom session and we'll match you with the right CBE tutor for your learner.
          </p>
          <Link to="/contact" className="inline-block mt-6">
            <Button size="lg" variant="secondary" className="rounded-full">
              Request a class
            </Button>
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
