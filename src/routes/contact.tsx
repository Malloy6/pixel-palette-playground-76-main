import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHero } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact Tusome Live — Get in touch" },
      { name: "description", content: "Talk to the Tusome Live team about classes, tutoring opportunities or anything else." },
      { property: "og:title", content: "Contact Tusome Live" },
      { property: "og:description", content: "Reach out — we'd love to hear from you." },
    ],
  }),
});

function ContactPage() {
  const [sending, setSending] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success("Message sent! We'll get back to you within 24 hours.");
      (e.target as HTMLFormElement).reset();
    }, 800);
  };

  return (
    <PageShell>
      <PageHero
        eyebrow="Contact"
        title={<>We'd love to <span className="bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">hear from you</span>.</>}
        subtitle="Questions about classes, partnerships, or becoming a tutor? Send us a message."
      />

      <section className="mx-auto max-w-7xl px-6 py-16 grid lg:grid-cols-5 gap-10">
        <div className="lg:col-span-2 space-y-6">
          {[
            { icon: Mail, label: "Email", value: "Tusomelive@gmail" },
            { icon: Phone, label: "Phone / WhatsApp", value: "+254 700 000 000" },
            { icon: MapPin, label: "Office", value: "Westlands, Nairobi, Kenya" },
            { icon: Clock, label: "Hours", value: "Mon–Sat · 8am – 8pm EAT" },
          ].map((i) => (
            <div key={i.label} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <i.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{i.label}</p>
                <p className="font-medium mt-1">{i.value}</p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="lg:col-span-3 rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" required placeholder="Jane Mwangi" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required placeholder="jane@example.com" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" required placeholder="I'd like to book a class for my Grade 8 learner" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" rows={6} required placeholder="Tell us a little about what you need..." />
          </div>
          <Button type="submit" size="lg" className="rounded-full w-full sm:w-auto" disabled={sending}>
            {sending ? "Sending..." : "Send message"}
          </Button>
        </form>
      </section>
    </PageShell>
  );
}