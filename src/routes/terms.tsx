import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHero } from "@/components/page-shell";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms & Conditions | Elimusphere" },
      {
        name: "description",
        content: "Read the terms and conditions for using Elimusphere's tutoring platform.",
      },
      { property: "og:title", content: "Terms & Conditions | Elimusphere" },
      {
        property: "og:description",
        content: "Review the usage terms for Elimusphere learners and tutors.",
      },
    ],
  }),
});

function TermsPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Terms & conditions"
        title={
          <>
            Elimusphere{" "}
            <span className="bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">
              usage terms
            </span>
            .
          </>
        }
        subtitle="These terms explain how our tutoring platform works, what you can expect, and your responsibilities."
      />

      <section className="mx-auto max-w-5xl px-6 py-16 space-y-6">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h2 className="text-2xl font-semibold">Using Elimusphere</h2>
          <p className="mt-4 text-muted-foreground">
            By using Elimusphere, you agree to book and attend live classes in a respectful and
            timely manner. Our tutors are here to support learning and help learners succeed.
          </p>
          <a
            href="/legal/terms-of-service"
            className="mt-4 inline-flex font-medium text-primary underline underline-offset-4"
          >
            Read the complete Terms of Service
          </a>
        </div>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h2 className="text-2xl font-semibold">Payments and cancellations</h2>
          <p className="mt-4 text-muted-foreground">
            Payments are processed through the chosen payment channel. Please review the
            cancellation policy when booking a class or package.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h2 className="text-2xl font-semibold">Privacy and safety</h2>
          <p className="mt-4 text-muted-foreground">
            We are committed to protecting your privacy and ensuring a safe environment for
            learning. Please refer to our privacy policy for details.
          </p>
          <a
            href="/legal/privacy-policy"
            className="mt-4 inline-flex font-medium text-primary underline underline-offset-4"
          >
            Read the complete Privacy Policy
          </a>
        </div>
      </section>
    </PageShell>
  );
}
