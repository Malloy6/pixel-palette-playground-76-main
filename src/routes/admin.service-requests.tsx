import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardShell, type DashboardUser } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_CUSTOM_SERVICE_PRICES,
  type CustomServicePrices,
} from "@/lib/custom-service-pricing";

const oneOnOnePriceOptions = [
  { key: "single", label: "Single Lesson" },
  { key: "weekly", label: "Weekly Package" },
  { key: "monthly", label: "Monthly Package" },
] as const;

const homeworkHelpPriceOptions = [
  { key: "live_discussion", label: "Live Discussion" },
  { key: "chat_support", label: "Chat Support" },
] as const;

type CustomServiceRequest = {
  id: number;
  learnerUserId: number;
  learnerName: string;
  learnerEmail: string;
  serviceType: "one_on_one" | "homework_help";
  packageType: string;
  grade: string;
  subjects: string[];
  lessonCount: number;
  amountKes: number;
  status: string;
  createdAt: string;
  schedules: Array<{
    id: number;
    subject: string;
    scheduledAt: string;
    tutorUserId: number;
    tutorName: string;
    tutorEmail: string;
  }>;
};

type Tutor = { id: number; firstName: string; lastName: string; isActive: boolean };
type ScheduleDraft = { subject: string; tutorUserId: string; scheduledAt: string };

export const Route = createFileRoute("/admin/service-requests")({
  component: AdminServiceRequestsPage,
  head: () => ({ meta: [{ title: "Custom lesson requests | Admin | Elimusphere" }] }),
});

function AdminServiceRequestsPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [requests, setRequests] = useState<CustomServiceRequest[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [prices, setPrices] = useState<CustomServicePrices>(DEFAULT_CUSTOM_SERVICE_PRICES);
  const [savingPrices, setSavingPrices] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, ScheduleDraft[]>>({});
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [savingRequestId, setSavingRequestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const authResponse = await fetch("/api/auth/me", { credentials: "include" });
        const authPayload = await authResponse.json().catch(() => ({}));
        if (!authResponse.ok || !authPayload.user) {
          throw new Error("Please sign in with an administrator account.");
        }
        if (authPayload.user.role !== "admin") {
          throw new Error("You do not have permission to manage custom lesson requests.");
        }
        const [requestResponse, userResponse, pricingResponse] = await Promise.all([
          fetch("/api/service-requests", { credentials: "include" }),
          fetch("/api/admin/users", { credentials: "include" }),
          fetch("/api/service-pricing", { credentials: "include" }),
        ]);
        const [requestPayload, userPayload, pricingPayload] = await Promise.all([
          requestResponse.json().catch(() => ({})),
          userResponse.json().catch(() => ({})),
          pricingResponse.json().catch(() => ({})),
        ]);
        if (!requestResponse.ok) {
          throw new Error(requestPayload.message ?? "Could not load lesson requests.");
        }
        if (!userResponse.ok) {
          throw new Error(userPayload.message ?? "Could not load the tutor list.");
        }
        if (!pricingResponse.ok) {
          throw new Error(pricingPayload.message ?? "Could not load custom lesson package prices.");
        }
        if (cancelled) return;
        setUser(authPayload.user);
        setRequests(Array.isArray(requestPayload.requests) ? requestPayload.requests : []);
        setPrices(pricingPayload.prices ?? DEFAULT_CUSTOM_SERVICE_PRICES);
        setTutors(
          (Array.isArray(userPayload.users) ? userPayload.users : []).filter(
            (candidate: Tutor & { role?: string }) =>
              candidate.role === "tutor" && candidate.isActive,
          ),
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load custom lesson requests.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function updatePrice<T extends keyof CustomServicePrices>(
    serviceType: T,
    packageType: keyof CustomServicePrices[T],
    value: number,
  ) {
    setPrices((current) => ({
      ...current,
      [serviceType]: { ...current[serviceType], [packageType]: value },
    }));
  }

  async function savePrices(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPrices(true);
    try {
      const response = await fetch("/api/service-pricing", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prices }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message ?? "Could not save package prices.");
      }
      setPrices(payload.prices);
      toast.success("Custom lesson package prices updated.");
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Could not save package prices.",
      );
    } finally {
      setSavingPrices(false);
    }
  }

  function startEditing(request: CustomServiceRequest) {
    setEditingRequestId(request.id);
    setDrafts((current) => ({
      ...current,
      [request.id]:
        current[request.id] ??
        (request.schedules.length
          ? request.schedules.map((schedule) => ({
              subject: schedule.subject,
              tutorUserId: String(schedule.tutorUserId),
              scheduledAt: new Date(schedule.scheduledAt)
                .toLocaleString("sv-SE", { timeZone: "Africa/Nairobi" })
                .replace(" ", "T")
                .slice(0, 16),
            }))
          : Array.from({ length: request.lessonCount }, (_, index) => ({
              subject: request.subjects[index % request.subjects.length] ?? "",
              tutorUserId: "",
              scheduledAt: "",
            }))),
    }));
  }

  function updateDraft(
    requestId: number,
    index: number,
    field: keyof ScheduleDraft,
    value: string,
  ) {
    setDrafts((current) => ({
      ...current,
      [requestId]: (current[requestId] ?? []).map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [field]: value } : draft,
      ),
    }));
  }

  async function saveSchedule(request: CustomServiceRequest) {
    const requestDrafts = drafts[request.id] ?? [];
    if (requestDrafts.length !== request.lessonCount) {
      toast.error(`Add exactly ${request.lessonCount} lesson times.`);
      return;
    }
    setSavingRequestId(request.id);
    try {
      const response = await fetch(`/api/admin/service-requests/${request.id}/schedule`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schedules: requestDrafts.map((draft) => ({
            subject: draft.subject,
            tutorUserId: Number(draft.tutorUserId),
            scheduledAt: draft.scheduledAt
              ? new Date(`${draft.scheduledAt}:00+03:00`).toISOString()
              : "",
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Could not save the schedule.");
      const refreshed = await fetch("/api/service-requests", { credentials: "include" });
      const refreshedPayload = await refreshed.json().catch(() => ({}));
      if (!refreshed.ok) {
        throw new Error(
          refreshedPayload.message ?? "Schedule saved, but requests could not refresh.",
        );
      }
      setRequests(Array.isArray(refreshedPayload.requests) ? refreshedPayload.requests : []);
      setEditingRequestId(null);
      toast.success(
        payload.emailSent && payload.notificationsSent
          ? "Schedule saved; learner and tutors have been notified."
          : (payload.message ?? "Schedule saved, but some notifications could not be delivered."),
      );
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save the schedule.");
    } finally {
      setSavingRequestId(null);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[image:var(--gradient-dashboard)]">
        Loading lesson requests…
      </main>
    );
  }

  if (!user || error) {
    return (
      <main className="grid min-h-screen place-items-center p-4">
        <section className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Custom lesson requests</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {error ?? "Sign in to manage lesson requests."}
          </p>
          <Link to="/admin" search={{ section: "overview" }} className="mt-6 inline-block">
            <Button>Back to admin dashboard</Button>
          </Link>
        </section>
      </main>
    );
  }

  return (
    <DashboardShell user={user}>
      <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Administrator dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Custom lesson requests</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Review paid one-on-one and homework-help requests, assign active tutors, and schedule
              each lesson. Learners and tutors receive notifications when a schedule is saved.
            </p>
          </div>
          <Link to="/admin" search={{ section: "overview" }}>
            <Button variant="outline">Back to admin</Button>
          </Link>
        </div>

        <form
          onSubmit={savePrices}
          className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
        >
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Custom lesson package prices</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set the KES amount charged for new one-on-one and homework-help requests. Existing
              paid requests are not changed.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <fieldset className="space-y-4">
              <legend className="mb-3 font-semibold">One-on-one classes</legend>
              {oneOnOnePriceOptions.map((option) => (
                <label key={option.key} className="grid gap-1.5 text-sm font-medium">
                  {option.label} (KES)
                  <Input
                    type="number"
                    min={1}
                    max={1_000_000}
                    step={1}
                    required
                    value={prices.one_on_one[option.key]}
                    onChange={(event) =>
                      updatePrice("one_on_one", option.key, Number(event.target.value))
                    }
                  />
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-4">
              <legend className="mb-3 font-semibold">Homework help</legend>
              {homeworkHelpPriceOptions.map((option) => (
                <label key={option.key} className="grid gap-1.5 text-sm font-medium">
                  {option.label} (KES)
                  <Input
                    type="number"
                    min={1}
                    max={1_000_000}
                    step={1}
                    required
                    value={prices.homework_help[option.key]}
                    onChange={(event) =>
                      updatePrice("homework_help", option.key, Number(event.target.value))
                    }
                  />
                </label>
              ))}
            </fieldset>
          </div>
          <Button type="submit" className="mt-6" disabled={savingPrices}>
            {savingPrices ? "Saving prices…" : "Save package prices"}
          </Button>
        </form>

        <div className="mt-8 space-y-4">
          {requests.map((request) => (
            <article key={request.id} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold">
                    {request.serviceType === "one_on_one" ? "One-on-one classes" : "Homework help"}{" "}
                    <span className="font-normal capitalize text-muted-foreground">
                      · {request.packageType.replaceAll("_", " ")}
                    </span>
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.learnerName} · {request.learnerEmail}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.grade} · {request.subjects.join(", ")} · {request.lessonCount} lesson
                    {request.lessonCount === 1 ? "" : "s"} · KSh{" "}
                    {request.amountKes.toLocaleString("en-KE")}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">
                  {request.status.replaceAll("_", " ")}
                </span>
              </div>

              {request.schedules.length ? (
                <div className="mt-4 space-y-2 border-t pt-4">
                  {request.schedules.map((schedule) => (
                    <p key={schedule.id} className="text-sm text-muted-foreground">
                      {schedule.subject} ·{" "}
                      {new Date(schedule.scheduledAt).toLocaleString("en-KE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Africa/Nairobi",
                      })}{" "}
                      · {schedule.tutorName}
                    </p>
                  ))}
                </div>
              ) : null}

              {request.status === "pending_payment" || request.status === "failed" ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Scheduling is available after payment is confirmed.
                </p>
              ) : editingRequestId === request.id ? (
                <div className="mt-5 space-y-4">
                  {(drafts[request.id] ?? []).map((draft, index) => (
                    <div
                      key={`${request.id}-${index}`}
                      className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3"
                    >
                      <label className="grid gap-1 text-sm font-medium">
                        Lesson {index + 1} subject
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3"
                          value={draft.subject}
                          onChange={(event) =>
                            updateDraft(request.id, index, "subject", event.target.value)
                          }
                        >
                          {request.subjects.map((subject) => (
                            <option key={subject} value={subject}>
                              {subject}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm font-medium">
                        Assigned tutor
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3"
                          value={draft.tutorUserId}
                          onChange={(event) =>
                            updateDraft(request.id, index, "tutorUserId", event.target.value)
                          }
                          required
                        >
                          <option value="">Select an active tutor</option>
                          {tutors.map((tutor) => (
                            <option key={tutor.id} value={tutor.id}>
                              {tutor.firstName} {tutor.lastName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm font-medium">
                        Class time (East Africa Time)
                        <Input
                          type="datetime-local"
                          value={draft.scheduledAt}
                          onChange={(event) =>
                            updateDraft(request.id, index, "scheduledAt", event.target.value)
                          }
                          required
                        />
                      </label>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => void saveSchedule(request)}
                      disabled={savingRequestId === request.id || tutors.length === 0}
                    >
                      {savingRequestId === request.id ? "Saving…" : "Save schedule and notify"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditingRequestId(null)}
                      disabled={savingRequestId === request.id}
                    >
                      Cancel
                    </Button>
                  </div>
                  {!tutors.length ? (
                    <p className="text-sm text-destructive">
                      No active tutors are available. Activate a tutor before scheduling.
                    </p>
                  ) : null}
                </div>
              ) : request.status === "pending_schedule" || request.status === "scheduled" ? (
                <Button
                  className="mt-4"
                  variant={request.status === "scheduled" ? "outline" : "default"}
                  onClick={() => startEditing(request)}
                >
                  {request.status === "scheduled" ? "Edit schedule" : "Create schedule"}
                </Button>
              ) : null}
            </article>
          ))}
          {!requests.length ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No custom lesson requests yet.
            </p>
          ) : null}
        </div>
      </main>
    </DashboardShell>
  );
}
