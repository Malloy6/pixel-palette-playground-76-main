import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHero } from "@/components/page-shell";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy | Elimusphere" },
      {
        name: "description",
        content:
          "Read Elimusphere's privacy policy and learn how we protect learner and family data.",
      },
      { property: "og:title", content: "Privacy Policy | Elimusphere" },
      {
        property: "og:description",
        content: "Learn how Elimusphere collects and protects personal information.",
      },
    ],
  }),
});

function PrivacyPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Privacy policy"
        title={
          <>
            How we protect your{" "}
            <span className="bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">
              information
            </span>
            .
          </>
        }
        subtitle="Elimusphere takes privacy seriously. Learn how we handle learner, parent, and tutor data."
      />

      <section className="mx-auto max-w-5xl px-6 py-16 space-y-6">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h2 className="text-2xl font-semibold">Data we collect</h2>
          <p className="mt-4 text-muted-foreground">
            We collect information needed to provide classes, communicate with learners and tutors,
            and deliver a secure learning experience.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Name and contact details</li>
            <li>Class and tutor preferences</li>
            <li>Learning progress and attendance</li>
            <li>Payment records</li>
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h2 className="text-2xl font-semibold">How we use your data</h2>
          <p className="mt-4 text-muted-foreground">
            Your information helps us match learners with tutors, schedule lessons, provide support,
            and improve our learning services.
          </p>
          <p className="mt-4 text-muted-foreground">
            We do not sell personal information to third parties.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h2 className="text-2xl font-semibold">Keeping information safe</h2>
          <p className="mt-4 text-muted-foreground">
            We use industry-standard security practices and limit access to your data to authorized
            team members only.
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
