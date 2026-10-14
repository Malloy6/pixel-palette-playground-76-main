import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHero } from "@/components/page-shell";
import { MpesaPhoneDialog } from "@/components/mpesa-phone-dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { waitForMpesaPayment } from "@/lib/mpesa-client";
import { downloadResourceFile } from "@/lib/resource-download-client";

type ResourceCatalogItem = {
  id: number;
  title: string;
  description: string | null;
  grade: string | null;
  subject: string | null;
  priceKes: number;
};

export const Route = createFileRoute("/resources")({
  component: ResourcesPage,
  head: () => ({
    meta: [
      { title: "Study Resources | Elimusphere" },
      {
        name: "description",
        content:
          "Revision notes, past papers, recorded lessons and study guides for registered learners.",
      },
      { property: "og:title", content: "Resources | Elimusphere" },
    ],
  }),
});

function ResourcesPage() {
  const [resources, setResources] = useState<ResourceCatalogItem[]>([]);
  const [me, setMe] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [purchased, setPurchased] = useState<Record<number, boolean>>({});
  const [purchasing, setPurchasing] = useState<Record<number, boolean>>({});
  const [selectedResourceForPayment, setSelectedResourceForPayment] = useState<number | null>(null);
  const [gradeFilter, setGradeFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  useEffect(() => {
    fetch("/api/resources")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setResources(d?.resources ?? []))
      .catch(() => setResources([]));
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const user = d?.user ?? null;
        setMe(user);
        if (user && (user.role === "learner" || user.role === "tutor")) {
          return fetch("/api/resources/purchased", { credentials: "include" })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
              const owned = Array.isArray(payload?.resources) ? payload.resources : [];
              setPurchased(
                Object.fromEntries(owned.map((resource: { id: number }) => [resource.id, true])),
              );
            })
            .catch(() => undefined);
        }
      })
      .catch(() => setMe(null))
      .finally(() => setAuthLoading(false));
  }, []);

  function requestResourcePayment(id: number) {
    if (!me) return toast.error("Please sign in to purchase resources.");
    if (me.role !== "learner" && me.role !== "tutor") {
      return toast.error("Only learners and tutors can purchase resources.");
    }
    setSelectedResourceForPayment(id);
  }

  async function purchaseResource(id: number, phone: string) {
    setPurchasing((value) => ({ ...value, [id]: true }));
    try {
      const response = await fetch(`/api/resources/${id}/mpesa-checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.message ?? "Could not initiate purchase.");
        return;
      }
      if (payload.alreadyPurchased) {
        setPurchased((value) => ({ ...value, [id]: true }));
        return;
      }
      toast.message(
        payload.alreadyPending
          ? "Your M-Pesa request is already pending. Check the phone that received the prompt."
          : "M-Pesa prompt sent. Enter your PIN on your phone to continue.",
      );
      const payment = await waitForMpesaPayment(payload.reference);
      if (payment.status === "completed") {
        toast.success("Payment confirmed. You can now download the resource.");
        setPurchased((value) => ({ ...value, [id]: true }));
      } else if (payment.status === "failed") {
        toast.error(
          payment.failureReason ?? "M-Pesa payment was not completed. You can try again.",
        );
      } else {
        toast.message("Payment is still pending. Try again after Safaricom confirms it.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check the payment status.");
    } finally {
      setPurchasing((value) => ({ ...value, [id]: false }));
    }
  }

  function downloadResource(id: number) {
    if (!me) return toast.error("Please sign in to download resources.");
    downloadResourceFile(id);
  }

  const grades = [
    ...new Set(
      resources.map((item) => item.grade).filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const subjects = [
    ...new Set(
      resources.map((item) => item.subject).filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const filteredResources = resources.filter(
    (item) =>
      (!gradeFilter || item.grade === gradeFilter) &&
      (!subjectFilter || item.subject === subjectFilter),
  );

  return (
    <PageShell>
      <PageHero
        eyebrow="Learning Resources"
        title={<>Study resources to support CBE learning.</>}
        subtitle="Revision notes, past papers, recordings and tools to help learners study smarter and prepare for assessments."
      />

      <section className="mx-auto max-w-7xl px-6 py-16">
        {me && (me.role === "learner" || me.role === "tutor") ? (
          <div className="mb-6 flex justify-end">
            <Link to="/dashboard/resources">
              <Button variant="outline">My Resources</Button>
            </Link>
          </div>
        ) : null}
        <div className="mt-10 mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Grade
            <select
              className="h-10 min-w-40 rounded-md border border-input bg-background px-3"
              value={gradeFilter}
              onChange={(event) => setGradeFilter(event.target.value)}
            >
              <option value="">All grades</option>
              {grades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Subject
            <select
              className="h-10 min-w-48 rounded-md border border-input bg-background px-3"
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
            >
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </label>
          <p className="pb-2 text-sm text-muted-foreground">
            Showing {filteredResources.length} of {resources.length} resources
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {filteredResources.map((r) => (
            <div key={r.id} className="rounded-3xl border border-border bg-card p-6">
              <p className="text-xs font-medium text-primary">
                {[r.subject, r.grade].filter(Boolean).join(" · ") || "Learning resource"}
              </p>
              <h3 className="font-semibold">{r.title}</h3>
              {r.description ? (
                <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">
                {r.priceKes === 0 ? "Free" : `Ksh ${r.priceKes}`}
              </p>
              <div className="mt-4 flex gap-2">
                {purchased[r.id] || r.priceKes === 0 || me?.role === "admin" ? (
                  <Button onClick={() => downloadResource(r.id)}>
                    {r.priceKes === 0 ? "Download free" : "Download"}
                  </Button>
                ) : me && (me.role === "learner" || me.role === "tutor") ? (
                  <Button
                    onClick={() => requestResourcePayment(r.id)}
                    disabled={authLoading || purchasing[r.id]}
                  >
                    {authLoading
                      ? "Checking account…"
                      : purchasing[r.id]
                        ? "Waiting for M-Pesa…"
                        : "Buy with M-Pesa"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.location.href = "/login";
                    }}
                    disabled={authLoading}
                  >
                    {authLoading ? "Checking account…" : "Sign in to buy"}
                  </Button>
                )}
              </div>
              {me?.role === "admin" && r.priceKes > 0 && !purchased[r.id] ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Admin preview. M-Pesa purchases are available from a learner account.
                </p>
              ) : null}
            </div>
          ))}
        </div>
        {!filteredResources.length ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
            {resources.length
              ? "No resources match these filters. Try another grade or subject."
              : "No resources are available yet."}
          </div>
        ) : null}

        <div className="mt-12 rounded-3xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">
            Extra support
          </p>
          <h3 className="mt-3 text-2xl font-semibold">Homework help and exam readiness</h3>
          <p className="mt-4 text-muted-foreground">
            Registered learners can submit assignments, ask tutor questions, and access exam-focused
            revision materials to prepare for CATs and end-of-term tests.
          </p>
          <a href="/signup" className="inline-block mt-6">
            <Button size="lg" className="rounded-full">
              Register to access resources
            </Button>
          </a>
        </div>
      </section>
      <MpesaPhoneDialog
        open={selectedResourceForPayment !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedResourceForPayment(null);
        }}
        onSubmit={(phone) => {
          if (selectedResourceForPayment !== null) {
            void purchaseResource(selectedResourceForPayment, phone);
          }
        }}
      />
    </PageShell>
  );
}

// Do not export the page component from the route file to allow code-splitting.
