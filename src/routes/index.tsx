import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-student.webp";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CBE_SUBJECTS } from "@/lib/subjects";
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
      { title: "Elimusphere — Learn Smarter. Achieve More." },
      {
        name: "description",
        content:
          "Elimusphere offers live online CBE classes, expert tutors, homework support, revision resources and personalized learning for Kenyan learners.",
      },
      { property: "og:title", content: "Elimusphere — Learn Smarter. Achieve More." },
      {
        property: "og:description",
        content:
          "Live online classes, affordable packages, and CBE-aligned tutoring for Grades 7–9 learners across Kenya.",
      },
    ],
    links: [{ rel: "preload", as: "image", href: heroImg, fetchPriority: "high" }],
  }),
});

const features = [
  {
    icon: ShieldCheck,
    title: "Qualified & Experienced Teachers",
    desc: "Tutors trained in CBE delivery, with strong classroom and online teaching experience.",
  },
  {
    icon: Video,
    title: "Live Interactive Online Classes",
    desc: "Real-time lessons with practice, feedback and learner participation.",
  },
  {
    icon: Wallet,
    title: "Affordable Learning Packages",
    desc: "Flexible pricing for one-on-one, group and holiday revision programmes.",
  },
  {
    icon: BookOpen,
    title: "Learn from Anywhere",
    desc: "Attend lessons from home on mobile or desktop with easy internet access.",
  },
  {
    icon: MessagesSquare,
    title: "Homework Assistance",
    desc: "Get fast support, error correction and answer explanations from tutors.",
  },
  {
    icon: LineChart,
    title: "Regular Assessments & Tracking",
    desc: "Monitor performance with clear progress reports and structured revision.",
  },
];

const programmes = [
  {
    icon: "♟",
    title: "Chess Programme",
    coach: "Coach: Tr. Juster",
    desc: "Develop strategic thinking, concentration, confidence, discipline, and problem-solving skills through engaging chess lessons and competitions.",
  },
  {
    icon: "💻",
    title: "Coding Programme",
    coach: "Instructor: Tr. Joseph",
    desc: "Introduce learners to coding, computational thinking, and digital innovation through fun, project-based lessons that prepare them for the future.",
  },
];

const testimonials = [
  {
    name: "Amina Mwangi",
    role: "Parent",
    quote: "My child’s confidence in Mathematics improved within weeks. The tutor explains CBE topics clearly and the homework support is excellent.",
  },
  {
    name: "Juma Odhiambo",
    role: "Learner",
    quote: "I enjoy the live classes and the revision notes helped me prepare well for my CATs. I can ask questions anytime and the tutor answers kindly.",
  },
  {
    name: "Grace Njeri",
    role: "Parent",
    quote: "Elimusphere made learning more affordable and consistent. The progress updates keep me informed and the school work is much easier now.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section
        className="relative min-h-[calc(100svh-4.5rem)] overflow-hidden bg-hero text-hero-foreground"
      >
        <img
          src={heroImg}
          alt="Student learning on a laptop"
          className="absolute inset-0 h-full w-full object-cover object-[60%_center] brightness-110 contrast-105"
          width={1024}
          height={1024}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.16_0.055_255_/_.88)_0%,oklch(0.16_0.055_255_/_.68)_38%,oklch(0.16_0.055_255_/_.18)_68%,transparent_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_54%,oklch(0.16_0.055_255_/_.28)_100%)]" />

        <div className="relative mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-7xl items-center px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-3xl py-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-white/5 px-4 py-1.5 text-xs font-medium text-accent">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Live online CBE learning for Kenyan learners
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl md:leading-[1.05]">
              Learn Smarter. Achieve More with <span className="block bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">Elimusphere.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/78 sm:mt-6 sm:text-lg">
              Live online classes, expert tutors, homework support, revision resources, and personalized learning designed to help every learner succeed under Kenya's Competency Based Education (CBE).
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/classes" className="w-full sm:w-auto">
                <Button size="lg" className="w-full rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-elegant)] hover:bg-accent/90 sm:w-auto">
                  Book a Class
                </Button>
              </Link>
              <Link to="/classes" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full rounded-full border-accent/50 bg-transparent text-accent hover:bg-accent/10 hover:text-accent sm:w-auto">
                  Learning Resources
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-white/70">
              {[
                "Verified tutors",
                "Homework support",
                "Flexible packages",
                "CBE-aligned learning",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" /> {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-bold text-primary uppercase tracking-wider inline-block bg-accent/10 px-3 py-0.5 rounded-md">Why choose Elimusphere</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl md:text-5xl">
              Support that makes learning easier, faster, and more confident.
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              We combine qualified teachers, live CBE lessons, homework coaching and progress tracking — all in one learner-friendly platform.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                <div className="h-12 w-12 rounded-xl bg-[image:var(--gradient-hero)] text-primary-foreground grid place-items-center">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[image:var(--gradient-soft)] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-primary uppercase tracking-wider inline-block bg-accent/10 px-3 py-0.5 rounded-md">Our academic subjects</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl md:text-5xl">Aligned with the CBE curriculum for every learner.</h2>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CBE_SUBJECTS.map((subject) => (
              <div
                key={subject}
                className="rounded-2xl border border-border bg-card p-5 text-sm font-semibold text-foreground sm:p-6 sm:text-base"
              >
                {subject}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="text-sm font-bold text-primary uppercase tracking-wider inline-block bg-accent/10 px-3 py-0.5 rounded-md">Special programmes</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl md:text-5xl">Choose a programme that builds skills and confidence.</h2>
          </div>
          <div className="text-muted-foreground">
            Select from enrichment programmes that boost thinking, digital skills and exam readiness.
          </div>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {programmes.map((program) => (
            <div key={program.title} className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-secondary text-2xl">{program.icon}</div>
              <h3 className="mt-5 text-2xl font-semibold">{program.title}</h3>
              <p className="mt-2 font-medium text-primary">{program.coach}</p>
              <p className="mt-4 text-muted-foreground">{program.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[image:var(--gradient-soft)] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-5 lg:items-end">
            <div className="lg:col-span-2">
              <p className="text-sm font-bold text-primary uppercase tracking-wider inline-block bg-accent/10 px-3 py-0.5 rounded-md">How Elimusphere works</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl md:text-5xl">From sign-up to top of the class in four easy steps.</h2>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                Start with a subject, choose your package, book a lesson, and join live classes with confidence.
              </p>
            </div>
            <div className="lg:col-span-3 grid gap-4">
              {[
                "Choose your subject  / programme or package",
                "Book your session.",
                "Make your payments.",
                "Join a live class and start learning.",
              ].map((step, index) => (
                <div key={step} className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-accent text-accent-foreground flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <p className="font-semibold">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-bold text-primary uppercase tracking-wider inline-block bg-accent/10 px-3 py-0.5 rounded-md">Testimonials</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl md:text-5xl">Parents and learners trust Elimusphere.</h2>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div key={testimonial.name} className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary grid place-items-center font-semibold text-xl">
                  {testimonial.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">“{testimonial.quote}”</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[image:var(--gradient-hero)] py-16 sm:py-24 text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-sm font-bold uppercase tracking-wider text-primary/80 inline-block bg-accent/10 px-3 py-0.5 rounded-md">Our promise</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl md:text-5xl">Give your child the best learning experience today.</h2>
          <p className="mt-5 text-base opacity-90 sm:text-lg">
            Elimusphere delivers engaging, affordable, technology-driven education that inspires confidence, nurtures talent, and prepares learners for lifelong success.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/classes">
              <Button size="lg" className="rounded-full">Join Elimusphere</Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" className="rounded-full shadow-[var(--shadow-elegant)]">Contact Us</Button>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
