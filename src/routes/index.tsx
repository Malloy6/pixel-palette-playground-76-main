import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-student.jpg";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  Video,
  BookOpen,
  CalendarCheck,
  MessagesSquare,
  LineChart,
  Wallet,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Tusome Live — Live CBE Tuition for Grades 7, 8 & 9 in Kenya" },
      {
        name: "description",
        content:
          "Affordable live online CBE tuition for Kenyan learners. Qualified tutors, homework help, revision materials, and parent progress tracking.",
      },
      { property: "og:title", content: "Tusome Live — Live CBE Tuition in Kenya" },
      {
        property: "og:description",
        content:
          "Connect with qualified CBE tutors for evening, weekend, and holiday classes via Google Meet.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700;800&display=swap",
      },
    ],
  }),
});

const features = [
  {
    icon: Video,
    title: "Live Online Classes",
    desc: "Group & one-on-one sessions via Google Meet with qualified CBE tutors.",
  },
  {
    icon: BookOpen,
    title: "CBE Learning Materials",
    desc: "Notes, revision papers and assignments aligned with the CBE curriculum.",
  },
  {
    icon: MessagesSquare,
    title: "Homework Help",
    desc: "Submit questions and get step-by-step guidance from real tutors.",
  },
  {
    icon: CalendarCheck,
    title: "Easy Class Booking",
    desc: "Browse tutors, check availability and book sessions in minutes.",
  },
  {
    icon: LineChart,
    title: "Progress Tracking",
    desc: "Parents monitor attendance, assignments and performance reports.",
  },
  {
    icon: Wallet,
    title: "M-Pesa Payments",
    desc: "Pay per session or subscribe to affordable monthly packages.",
  },
];

const steps = [
  {
    n: "01",
    title: "Create your account",
    desc: "Sign up as a parent, learner or tutor in under a minute.",
  },
  {
    n: "02",
    title: "Find your tutor",
    desc: "Browse verified CBE tutors by subject, rating and availability.",
  },
  {
    n: "03",
    title: "Book & join on Meet",
    desc: "Pay via M-Pesa and join live classes from any device.",
  },
  {
    n: "04",
    title: "Track & grow",
    desc: "Get reports, revision materials and homework support every week.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* Hero */}
      <section
        className="relative min-h-[calc(100svh-4.5rem)] overflow-hidden bg-hero bg-cover bg-no-repeat text-hero-foreground lg:bg-fixed"
        style={{ backgroundImage: `url(${heroImg})`, backgroundPosition: "62% center" }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.16_0.055_255_/_.94)_0%,oklch(0.2_0.07_255_/_.82)_38%,oklch(0.16_0.055_255_/_.38)_72%,oklch(0.16_0.055_255_/_.18)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,oklch(0.16_0.055_255_/_.14)_62%,oklch(0.16_0.055_255)_100%)]" />

        <div className="relative mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-7xl items-center px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-3xl py-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-white/5 px-4 py-1.5 text-xs font-medium text-accent">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Built for CBE Grades 7, 8 & 9
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl md:leading-[1.05]">
              Live online tuition that grows with every{" "}
              <span className="block bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">
                Kenyan learner.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/78 sm:mt-6 sm:text-lg">
              Tusome Live connects CBE learners with qualified tutors for affordable evening,
              weekend and holiday classes — with homework help, revision materials and parent
              progress reports built in.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/classes" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-elegant)] hover:bg-accent/90 sm:w-auto"
                >
                  Book your first class <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/signup" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full border-accent/50 bg-transparent text-accent hover:bg-accent/10 hover:text-accent sm:w-auto"
                >
                  Become a tutor
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-white/70">
              {["Verified tutors", "M-Pesa payments", "Google Meet classes"].map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" /> {t}
                </div>
              ))}
            </div>

            <div className="mt-8 grid max-w-2xl gap-3 sm:mt-10 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/10 p-4 shadow-[var(--shadow-elegant)] backdrop-blur-md">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-accent">
                  <LineChart className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-white/65">This week</p>
                  <p className="text-sm font-semibold text-white">+18% in Math scores</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/10 p-4 shadow-[var(--shadow-elegant)] backdrop-blur-md">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-white/65">Live now</p>
                  <p className="text-sm font-semibold text-white">Grade 8 Integrated Science</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-10 min-[420px]:grid-cols-2 sm:px-6 md:grid-cols-4 md:gap-6 md:py-12">
        {[
          { k: "50", v: "Verified CBE tutors" },
          { k: "Grades 7–9", v: "CBE focused" },
          { k: "1:1 & Group", v: "Class formats" },
          { k: "Kshs. 200", v: "Sessions from" },
        ].map((s) => (
          <div key={s.v} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <p className="font-display text-2xl font-bold text-primary sm:text-3xl">{s.k}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.v}</p>
          </div>
        ))}
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">
            The challenge
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            CBE learning shouldn't be a guessing game for parents.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:mt-12 md:grid-cols-3">
          {[
            "Limited access to qualified CBE tutors",
            "Expensive private tuition services",
            "Lack of personalized academic support",
            "Difficulty tracking learner progress",
            "Inadequate revision materials",
            "No timely homework assistance",
          ].map((p) => (
            <div
              key={p}
              className="rounded-2xl border border-border bg-card p-6 hover:shadow-[var(--shadow-card)] transition"
            >
              <ShieldCheck className="h-6 w-6 text-primary" />
              <p className="mt-3 font-medium">{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[image:var(--gradient-soft)] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">
              Platform features
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              Everything your child needs to thrive.
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              From booking the first lesson to tracking long-term performance — one platform, built
              around the CBE learner.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)] sm:p-7"
              >
                <div className="h-12 w-12 rounded-xl bg-[image:var(--gradient-hero)] text-primary-foreground flex items-center justify-center shadow-[var(--shadow-card)]">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="lg:sticky lg:top-24">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              From sign-up to top of the class in four steps.
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Designed for busy Kenyan families — start tonight, see results by the next CAT.
            </p>
            <Button size="lg" className="mt-8 w-full rounded-full sm:w-auto">
              Start free — get matched <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-4">
            {steps.map((s) => (
              <div key={s.n} className="flex gap-4 rounded-2xl border border-border bg-card p-5 sm:gap-5 sm:p-6">
                <span className="shrink-0 font-display text-2xl font-bold text-primary/30 sm:text-3xl">
                  {s.n}
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-lg">{s.title}</h3>
                  <p className="text-muted-foreground mt-1">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tutor CTA */}
      <section id="tutors" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="relative overflow-hidden rounded-2xl bg-[image:var(--gradient-hero)] p-6 text-primary-foreground shadow-[var(--shadow-elegant)] sm:rounded-3xl sm:p-10 md:p-16">
          <div className="relative max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider opacity-80">For tutors</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              Teach what you love. Reach learners across Kenya.
            </h2>
            <p className="mt-4 text-base opacity-90 sm:text-lg">
              Join a community of qualified CBE tutors. Set your hours, manage bookings, and get
              paid weekly via M-Pesa.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="secondary" className="w-full rounded-full sm:w-auto">
                Apply as a tutor
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-full bg-transparent border-white/40 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground sm:w-auto"
              >
                Learn more
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
