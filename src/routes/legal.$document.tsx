import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHero, PageShell } from "@/components/page-shell";

const legalDocuments = {
  "terms-of-service": {
    title: "Terms of Service",
    eyebrow: "Terms of Use",
    subtitle: "The terms governing your use of the Elimusphere platform.",
  },
  "teacher-agreement": {
    title: "Teacher Agreement",
    eyebrow: "For tutors",
    subtitle: "The agreement for tutors who offer educational services through Elimusphere.",
  },
  "student-agreement": {
    title: "Student Agreement",
    eyebrow: "For learners",
    subtitle: "The agreement for learners using Elimusphere educational services.",
  },
  "privacy-policy": {
    title: "Privacy Policy",
    eyebrow: "Your privacy",
    subtitle: "How Elimusphere collects, uses, stores, and protects personal information.",
  },
  "cookie-policy": {
    title: "Cookie Policy",
    eyebrow: "Cookies and tracking",
    subtitle: "How cookies and similar technologies support the Elimusphere platform.",
  },
} as const;

type LegalDocumentId = keyof typeof legalDocuments;

export const Route = createFileRoute("/legal/$document")({
  beforeLoad: ({ params }) => {
    if (!Object.hasOwn(legalDocuments, params.document)) throw notFound();
  },
  component: LegalDocumentPage,
  head: ({ params }) => {
    const doc = legalDocuments[params.document as LegalDocumentId];
    return {
      meta: [
        { title: `${doc.title} | Elimusphere` },
        { name: "description", content: doc.subtitle },
      ],
    };
  },
});

function LegalDocumentPage() {
  const { document } = Route.useParams();
  const doc = legalDocuments[document as LegalDocumentId];
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/legal/${document}.html`)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${doc.title}.`);
        return response.text();
      })
      .then((html) => {
        const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1];
        if (!main) throw new Error(`The ${doc.title} document is malformed.`);
        const article = main
          .replace(/<header[\s\S]*?<\/header>/i, "")
          .replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, "");
        if (active) setContent(article);
      })
      .catch((loadError: unknown) => {
        console.error(`Failed to load legal document "${document}":`, loadError);
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [document, doc.title]);

  return (
    <PageShell>
      <PageHero eyebrow={doc.eyebrow} title={doc.title} subtitle={doc.subtitle} />
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <article className="legal-document rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-10 md:p-14">
          {error ? (
            <p role="alert" className="text-destructive">
              This document could not be loaded. Please refresh the page or try again later.
            </p>
          ) : content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <p className="text-muted-foreground" aria-live="polite">
              Loading document…
            </p>
          )}
        </article>
      </section>
    </PageShell>
  );
}
