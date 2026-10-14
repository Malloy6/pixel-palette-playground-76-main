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
      { title: "Contact Elimusphere — Get in touch" },
      {
        name: "description",
        content:
          "Talk to the Elimusphere team about classes, tutoring opportunities or anything else.",
      },
      { property: "og:title", content: "Contact Elimusphere" },
      { property: "og:description", content: "Reach out — we'd love to hear from you." },
    ],
  }),
});

function ContactPage() {
  const [sending, setSending] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          subject: formData.get("subject"),
          message: formData.get("message"),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "We couldn't send your message. Please try again.");
      }
      toast.success("Message sent! We'll get back to you within 24 hours.");
      form.reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "We couldn't send your message. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <PageShell>
      <PageHero
        eyebrow="Contact"
        title={
          <>
            We'd love to{" "}
            <span className="bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">
              hear from you
            </span>
            .
          </>
        }
        subtitle="Questions about classes, partnerships, or becoming a tutor? Send us a message."
      />

      <section className="mx-auto max-w-7xl px-6 py-16 grid lg:grid-cols-5 gap-10">
        <div className="lg:col-span-2 space-y-6">
          {[
            { icon: Mail, label: "Email", value: "info@elimusphere.co.ke" },
            { icon: Phone, label: "Phone / WhatsApp", value: "+254 712 155 312" },
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

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-3 rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)] space-y-5"
        >
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" name="name" required maxLength={120} placeholder="Jane Mwangi" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                maxLength={254}
                placeholder="jane@example.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              name="subject"
              required
              maxLength={200}
              placeholder="I'd like to book a class for my Grade 8 learner"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              rows={6}
              required
              maxLength={5000}
              placeholder="Tell us a little about what you need..."
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="rounded-full w-full sm:w-auto"
            disabled={sending}
          >
            {sending ? "Sending..." : "Send message"}
          </Button>
        </form>
      </section>
    </PageShell>
  );
}
