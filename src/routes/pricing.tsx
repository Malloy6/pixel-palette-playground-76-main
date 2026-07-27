import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHero } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — Affordable CBE Tuition | Tusome Live" },
      { name: "description", content: "Affordable per-session and monthly subscription packages for CBE tuition. Pay easily with M-Pesa." },
      { property: "og:title", content: "Pricing | Tusome Live" },
      { property: "og:description", content: "Pay per session or subscribe monthly." },
    ],
  }),
});

const plans = [
  {
    name: "Pay as you go",
    price: "Ksh 300",
    unit: "/session",
    desc: "Perfect for trying a class or occasional homework help.",
    features: [
      "Book any group class",
      "Homework help per question",
      "Pay via M-Pesa per session",
      "Free sample notes",
    ],
    cta: "Start booking",
    featured: false,
  },
  {
    name: "Learner Monthly",
    price: "Ksh 2,500",
    unit: "/month",
    desc: "Our most popular plan for committed learners.",
    features: [
      "Up to 12 group classes / month",
      "Unlimited homework support",
      "All revision notes & papers",
      "Recorded lessons access",
      "Parent progress reports",
    ],
    cta: "Get Learner Monthly",
    featured: true,
  },
  {
    name: "1-on-1 Premium",
    price: "Ksh 5,500",
    unit: "/month",
    desc: "Personalized attention for top-performing learners.",
    features: [
      "8 one-on-one sessions / month",
      "Dedicated tutor match",
      "Custom learning plan",
      "Everything in Learner Monthly",
      "Priority homework support",
    ],
    cta: "Go Premium",
    featured: false,
  },
];

function PricingPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Pricing"
        title={<>Simple, family-friendly <span className="bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">pricing</span>.</>}
        subtitle="Pay per session or subscribe monthly. All plans include access to qualified CBE tutors and easy M-Pesa payments."
      />

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-3xl p-8 border ${
                p.featured
                  ? "bg-[image:var(--gradient-hero)] text-primary-foreground border-transparent shadow-[var(--shadow-elegant)] md:-translate-y-2"
                  : "bg-card border-border"
              }`}
            >
              {p.featured && (
                <span className="absolute top-4 right-4 text-xs font-semibold bg-white/20 backdrop-blur px-3 py-1 rounded-full">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-2xl font-bold">{p.name}</h3>
              <p className={`mt-2 text-sm ${p.featured ? "opacity-90" : "text-muted-foreground"}`}>{p.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">{p.price}</span>
                <span className={p.featured ? "opacity-80" : "text-muted-foreground"}>{p.unit}</span>
              </div>
              <Link to="/signup">
                <Button
                  className="mt-6 w-full rounded-full"
                  variant={p.featured ? "secondary" : "default"}
                >
                  {p.cta}
                </Button>
              </Link>
              <ul className="mt-8 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`h-4 w-4 mt-0.5 ${p.featured ? "text-primary-foreground" : "text-primary"}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {[
            { q: "How do I pay?", a: "All payments are processed securely via M-Pesa. You'll get an STK push to confirm." },
            { q: "Can I cancel anytime?", a: "Yes. Monthly plans can be paused or cancelled before the next billing cycle." },
            { q: "Are materials really free for enrolled learners?", a: "Yes — learners on the Monthly or Premium plans get all notes and recordings included." },
          ].map((f) => (
            <div key={f.q} className="rounded-2xl border border-border bg-card p-6">
              <p className="font-semibold">{f.q}</p>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}