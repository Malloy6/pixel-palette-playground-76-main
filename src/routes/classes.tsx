import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHero } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { MpesaPhoneDialog } from "@/components/mpesa-phone-dialog";
import { Clock, Users, Video, ArrowRight, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { waitForMpesaPayment } from "@/lib/mpesa-client";
import { CBE_GRADES, CBE_SUBJECTS } from "@/lib/subjects";
import {
  DEFAULT_CUSTOM_SERVICE_PRICES,
  type CustomServicePrices,
} from "@/lib/custom-service-pricing";

export const Route = createFileRoute("/classes")({
  component: ClassesPage,
  head: () => ({
    meta: [
      { title: "Live CBE Classes & Pricing | Elimusphere" },
      {
        name: "description",
        content:
          "Book live online CBE classes and access revision notes, past papers, recordings and homework support for Kenyan learners.",
      },
      { property: "og:title", content: "Classes & Pricing | Elimusphere" },
      {
        property: "og:description",
        content: "Live classes aligned to CBE and learner study resources in one place.",
      },
    ],
  }),
});

type LiveClass = {
  id: number;
  subject: string;
  grade: string;
  tutorName: string;
  scheduleLabel: string;
  seatsTaken: number;
  seatsTotal: number;
  priceKes: number;
  upcomingSessions: Array<{
    id: number;
    scheduledAt: string;
    bookingCount: number;
    isBooked: boolean;
    isPaid: boolean;
    roomId: number | null;
    isLive: boolean;
  }>;
};

const oneOnOnePackages = [
  { key: "single", label: "Single Lesson", detail: "1 Hour", subjectLimit: 1 },
  { key: "weekly", label: "Weekly Package", detail: "4 Lessons", subjectLimit: 4 },
  {
    key: "monthly",
    label: "Monthly Package",
    detail: "12 Lessons",
    subjectLimit: 12,
  },
];

const homeworkHelpOptions = [
  { key: "live_discussion", label: "Live Discussion" },
  { key: "chat_support", label: "Chat Support" },
];

function ClassesPage() {
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [servicePrices, setServicePrices] = useState<CustomServicePrices>(
    DEFAULT_CUSTOM_SERVICE_PRICES,
  );
  const [servicePricesLoaded, setServicePricesLoaded] = useState(false);
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [bookingClass, setBookingClass] = useState<number | null>(null);
  const [paymentClass, setPaymentClass] = useState<number | null>(null);
  const [customServiceCheckout, setCustomServiceCheckout] = useState<{
    serviceType: "one_on_one" | "homework_help";
    packageType: string;
    grade: string;
    subjects: string[];
  } | null>(null);
  const [serviceProcessing, setServiceProcessing] = useState(false);
  const [oneOnOneSubjects, setOneOnOneSubjects] = useState<Record<string, string[]>>({});
  const [oneOnOneGrade, setOneOnOneGrade] = useState("");
  const [homeworkGrade, setHomeworkGrade] = useState("");
  const [homeworkSubject, setHomeworkSubject] = useState("");
  const [openSessionDropdown, setOpenSessionDropdown] = useState<number | null>(null);
  const [openSubjectDropdown, setOpenSubjectDropdown] = useState<string | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<Record<number, number[]>>({});
  const [gradeFilter, setGradeFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/classes", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.classes)) {
          setClasses(payload.classes);
        }
      })
      .catch(() => undefined);
    fetch("/api/auth/me", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled) setUser(payload?.user ?? null);
      })
      .catch(() => undefined);
    fetch("/api/service-pricing")
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message ?? "Could not load current package prices.");
        }
        if (payload.prices) {
          setServicePrices(payload.prices);
          setServicePricesLoaded(true);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Could not load custom service prices.", error);
          toast.error(
            "Current package prices could not be loaded. Please refresh before ordering.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleSession(classId: number, sessionId: number, checked: boolean) {
    setSelectedSessions((current) => {
      const selected = current[classId] ?? [];
      if (checked && selected.length >= 20) {
        toast.error("Select no more than 20 sessions for a booking.");
        return current;
      }
      return {
        ...current,
        [classId]: checked
          ? selected.includes(sessionId)
            ? selected
            : [...selected, sessionId]
          : selected.filter((id) => id !== sessionId),
      };
    });
  }

  async function registerForSelectedSessions(classId: number, phone = "") {
    if (!user) {
      window.location.href = "/signup";
      return;
    }
    if (user.role !== "learner") {
      toast.error("Class bookings are only available to learners.");
      return;
    }
    const sessionIds = selectedSessions[classId] ?? [];
    if (!sessionIds.length) {
      toast.error("Select at least one upcoming session.");
      return;
    }
    setBookingClass(classId);
    try {
      const response = await fetch(`/api/classes/${classId}/sessions/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds, phone }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.message ?? "Could not register for this class.");
        return;
      }
      if (!payload.free) {
        toast.message(
          `M-Pesa prompt sent for KSh ${Number(payload.amountKes).toLocaleString("en-KE")}. Confirm it on your phone.`,
        );
        const payment = await waitForMpesaPayment(payload.reference);
        if (payment.status !== "completed") {
          if (payment.status === "failed") {
            toast.error(payment.failureReason ?? "Payment failed. Select sessions and try again.");
          } else {
            toast.message(
              "Payment is still pending. Your sessions will confirm after Safaricom responds.",
            );
          }
          return;
        }
      }
      setClasses((current) =>
        current.map((liveClass) =>
          liveClass.id !== classId
            ? liveClass
            : {
                ...liveClass,
                upcomingSessions: liveClass.upcomingSessions.map((slot) =>
                  !sessionIds.includes(slot.id)
                    ? slot
                    : {
                        ...slot,
                        isBooked: true,
                        isPaid: !payload.free,
                        bookingCount: slot.bookingCount + (slot.isBooked ? 0 : 1),
                      },
                ),
              },
        ),
      );
      setSelectedSessions((current) => ({ ...current, [classId]: [] }));
      if (payload.emailSent === false) {
        toast.error(payload.message ?? "Sessions confirmed, but the email could not be sent.");
      } else {
        toast.success(
          payload.free
            ? "Sessions booked. Your upcoming schedule is saved to Notifications and a confirmation email is on its way."
            : "Payment confirmed. Your upcoming schedule is saved to Notifications and a confirmation email is on its way.",
        );
      }
    } catch {
      toast.error("Could not complete this booking. Check your connection and try again.");
    } finally {
      setBookingClass(null);
    }
  }

  function toggleOneOnOneSubject(packageKey: string, subject: string, limit: number) {
    setOneOnOneSubjects((current) => {
      const selected = current[packageKey] ?? [];
      if (!selected.includes(subject) && selected.length >= limit) {
        toast.error(`Select up to ${limit} subject${limit === 1 ? "" : "s"} for this package.`);
        return current;
      }
      return {
        ...current,
        [packageKey]: selected.includes(subject)
          ? selected.filter((item) => item !== subject)
          : [...selected, subject],
      };
    });
  }

  function openCustomServiceCheckout(
    serviceType: "one_on_one" | "homework_help",
    packageType: string,
    grade: string,
    subjects: string[],
  ) {
    if (!user) {
      window.location.href = "/signup";
      return;
    }
    if (user.role !== "learner") {
      toast.error("Custom lessons can be requested from a learner account.");
      return;
    }
    if (!subjects.length) {
      toast.error("Select a subject before continuing.");
      return;
    }
    if (!grade) {
      toast.error("Select the learner’s grade before continuing.");
      return;
    }
    setCustomServiceCheckout({ serviceType, packageType, grade, subjects });
  }

  async function submitCustomServiceCheckout(phone: string) {
    if (!customServiceCheckout) return;
    setServiceProcessing(true);
    try {
      const response = await fetch("/api/service-requests/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...customServiceCheckout, phone }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Could not start your payment.");
      toast.message(
        `M-Pesa prompt sent for KSh ${Number(payload.amountKes).toLocaleString("en-KE")}. Confirm it on your phone.`,
      );
      const payment = await waitForMpesaPayment(payload.reference);
      if (payment.status !== "completed") {
        if (payment.status === "failed") {
          toast.error(payment.failureReason ?? "Payment failed. Please try again.");
        } else {
          toast.message(
            "Payment is pending; your request will appear after Safaricom confirms it.",
          );
        }
        return;
      }
      setCustomServiceCheckout(null);
      toast.success(
        "Payment confirmed. An administrator will schedule your lessons and email the timetable.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete your payment.");
    } finally {
      setServiceProcessing(false);
    }
  }

  const grades = [...new Set(classes.map((item) => item.grade).filter(Boolean))].sort();
  const subjects = [...new Set(classes.map((item) => item.subject).filter(Boolean))].sort();
  const filteredClasses = classes.filter(
    (item) =>
      (!gradeFilter || item.grade === gradeFilter) &&
      (!subjectFilter || item.subject === subjectFilter),
  );

  return (
    <PageShell>
      <PageHero
        eyebrow="Classes"
        title={
          <>
            Live CBE classes and{" "}
            <span className="bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">
              pricing
            </span>{" "}
            information.
          </>
        }
        subtitle="Book live online classes aligned with the Competency Based Education curriculum. Pricing for one-on-one, group and extra support is listed below."
      />

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4">
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
            Showing {filteredClasses.length} of {classes.length} classes
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map((c) => (
            <div
              key={c.id}
              className="group rounded-2xl border border-border bg-card p-6 hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)] transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {c.grade}
                </span>
                <span className="text-xs rounded-full bg-accent/20 text-accent-foreground px-2.5 py-1">
                  Live
                </span>
              </div>
              <h3 className="mt-3 text-xl font-semibold">{c.subject}</h3>
              <p className="text-sm text-muted-foreground">with {c.tutorName}</p>
              {user?.role === "admin" ? (
                <p className="mt-2 text-xs font-medium text-primary">
                  Catalogue preview · booking is for learner accounts
                </p>
              ) : null}
              <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> {c.scheduleLabel}
                </p>
                {user?.role === "admin" ? (
                  <div className="grid gap-1.5 text-sm">
                    <span className="font-medium text-foreground">Upcoming sessions</span>
                    {c.upcomingSessions.slice(0, 3).map((slot) => (
                      <span key={slot.id}>
                        {new Date(slot.scheduledAt).toLocaleString("en-KE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Africa/Nairobi",
                        })}
                      </span>
                    ))}
                    {!c.upcomingSessions.length ? (
                      <span>No sessions currently scheduled.</span>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-1.5 text-sm font-medium text-foreground">
                      Choose upcoming sessions
                      <div className="relative">
                        <button
                          type="button"
                          aria-expanded={openSessionDropdown === c.id}
                          onClick={() =>
                            setOpenSessionDropdown((current) => (current === c.id ? null : c.id))
                          }
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left font-normal"
                        >
                          <span>
                            {(selectedSessions[c.id]?.length ?? 0) > 0
                              ? `${selectedSessions[c.id].length} session${selectedSessions[c.id].length === 1 ? "" : "s"} selected`
                              : "Select sessions"}
                          </span>
                          <ChevronDown
                            aria-hidden="true"
                            className="h-4 w-4 text-muted-foreground"
                          />
                        </button>
                        {openSessionDropdown === c.id ? (
                          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg">
                            {c.upcomingSessions.map((slot) => (
                              <label
                                key={slot.id}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                              >
                                <input
                                  type="checkbox"
                                  className="accent-primary"
                                  checked={(selectedSessions[c.id] ?? []).includes(slot.id)}
                                  disabled={
                                    slot.isPaid ||
                                    (slot.isBooked && c.priceKes === 0) ||
                                    (user !== null && user.role !== "learner")
                                  }
                                  onChange={(event) =>
                                    toggleSession(c.id, slot.id, event.target.checked)
                                  }
                                />
                                <span className="min-w-0 flex-1">
                                  {new Date(slot.scheduledAt).toLocaleString("en-KE", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                    timeZone: "Africa/Nairobi",
                                  })}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {slot.isPaid ? "Paid" : slot.isBooked ? "Reserved" : ""}
                                </span>
                              </label>
                            ))}
                            {!c.upcomingSessions.length ? (
                              <p className="px-2 py-2 text-sm text-muted-foreground">
                                No upcoming sessions available.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <p className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" /> Select up to 20 upcoming sessions.
                    </p>
                    <p className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-primary" /> Jitsi Meet
                    </p>
                  </>
                )}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="flex flex-col">
                  <span className="font-display text-lg font-bold">
                    {c.priceKes === 0
                      ? "Free per session"
                      : `KSh ${c.priceKes.toLocaleString("en-KE")} per session`}
                  </span>
                  {user?.role !== "admin" && (selectedSessions[c.id]?.length ?? 0) > 0 ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      {c.priceKes === 0
                        ? "Total: Free"
                        : `Total: KSh ${(
                            (selectedSessions[c.id]?.length ?? 0) * c.priceKes
                          ).toLocaleString(
                            "en-KE",
                          )} for ${selectedSessions[c.id].length} session${selectedSessions[c.id].length === 1 ? "" : "s"}`}
                    </span>
                  ) : null}
                </span>
                {(() => {
                  const firstLiveBookedSession = c.upcomingSessions.find(
                    (slot) => slot.isBooked && slot.isLive,
                  );
                  return user?.role === "admin" ? (
                    <p className="text-sm text-muted-foreground">Browsing only</p>
                  ) : (
                    <div className="flex flex-col items-end gap-2">
                      {firstLiveBookedSession ? (
                        <Link
                          to="/conference/$classId"
                          params={{ classId: String(c.id) }}
                          search={{ sessionId: firstLiveBookedSession.id }}
                        >
                          <Button size="sm" variant="outline" className="rounded-full">
                            Join live session <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      ) : null}
                      <Button
                        size="sm"
                        className="rounded-full"
                        disabled={
                          !selectedSessions[c.id]?.length ||
                          bookingClass === c.id ||
                          (user !== null && user.role !== "learner")
                        }
                        onClick={() => {
                          if (!user) {
                            window.location.href = "/signup";
                          } else if (c.priceKes === 0) {
                            void registerForSelectedSessions(c.id);
                          } else {
                            setPaymentClass(c.id);
                          }
                        }}
                      >
                        {bookingClass === c.id
                          ? "Processing…"
                          : c.priceKes === 0
                            ? "Book selected"
                            : "Pay selected sessions"}
                      </Button>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
        {!filteredClasses.length ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
            <h2 className="text-xl font-semibold">
              {classes.length ? "No classes match these filters" : "Classes are coming soon"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {classes.length
                ? "Try another grade or subject."
                : "Our admin team will publish new classes here as tutors are assigned."}
            </p>
          </div>
        ) : null}

        <div className="mt-16 rounded-3xl bg-[image:var(--gradient-hero)] p-10 md:p-14 text-primary-foreground shadow-[var(--shadow-elegant)] text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Need a class that's not listed?</h2>
          <p className="mt-3 opacity-90 max-w-xl mx-auto">
            Request a custom session and we’ll match you with the right CBE tutor for your learner.
          </p>
          <Link to="/contact" className="inline-block mt-6">
            <Button size="lg" variant="secondary" className="rounded-full">
              Request a class
            </Button>
          </Link>
        </div>
      </section>
      <MpesaPhoneDialog
        open={paymentClass !== null || customServiceCheckout !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentClass(null);
            setCustomServiceCheckout(null);
          }
        }}
        onSubmit={(phone) => {
          if (customServiceCheckout) void submitCustomServiceCheckout(phone);
          else if (paymentClass !== null) void registerForSelectedSessions(paymentClass, phone);
        }}
      />
      {/* Pricing content (merged from /pricing) */}
      <section className="mx-auto w-full max-w-7xl space-y-16 px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-6">
          <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-elegant)] sm:p-8">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">
              One-on-one classes
            </p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
              Personalized attention for every learner.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Choose the subjects you want to study. An administrator will create your lesson
              timetable and assign the right tutor after payment.
            </p>
            {user?.role !== "admin" ? (
              <label className="mt-5 grid gap-1.5 text-sm font-medium">
                Learner grade
                <select
                  className="h-11 rounded-md border border-input bg-background px-3"
                  value={oneOnOneGrade}
                  onChange={(event) => setOneOnOneGrade(event.target.value)}
                >
                  <option value="">Choose a grade</option>
                  {CBE_GRADES.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="mt-8 space-y-4">
              {oneOnOnePackages.map((pkg) => {
                const selected = oneOnOneSubjects[pkg.key] ?? [];
                return (
                  <div key={pkg.key} className="rounded-3xl border border-border bg-background p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{pkg.label}</p>
                        <p className="text-sm text-muted-foreground">{pkg.detail}</p>
                      </div>
                      <p className="font-display text-xl font-bold">
                        KSh{" "}
                        {servicePrices.one_on_one[
                          pkg.key as keyof CustomServicePrices["one_on_one"]
                        ].toLocaleString("en-KE")}
                      </p>
                    </div>
                    {user?.role !== "admin" ? (
                      <div className="relative mt-4">
                        <button
                          type="button"
                          aria-expanded={openSubjectDropdown === pkg.key}
                          onClick={() =>
                            setOpenSubjectDropdown((current) =>
                              current === pkg.key ? null : pkg.key,
                            )
                          }
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-card px-3 text-left text-sm"
                        >
                          <span>
                            {selected.length
                              ? `${selected.length} of ${pkg.subjectLimit} subject${pkg.subjectLimit === 1 ? "" : "s"} selected`
                              : "Choose subjects"}
                          </span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </button>
                        {openSubjectDropdown === pkg.key ? (
                          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg">
                            {CBE_SUBJECTS.map((subject) => (
                              <label
                                key={subject}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                              >
                                <input
                                  type="checkbox"
                                  className="accent-primary"
                                  checked={selected.includes(subject)}
                                  disabled={
                                    serviceProcessing ||
                                    (!selected.includes(subject) &&
                                      selected.length >= pkg.subjectLimit)
                                  }
                                  onChange={() =>
                                    toggleOneOnOneSubject(pkg.key, subject, pkg.subjectLimit)
                                  }
                                />
                                {subject}
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {user?.role !== "admin" ? (
                      <Button
                        className="mt-4 w-full rounded-full"
                        disabled={
                          !servicePricesLoaded ||
                          !oneOnOneGrade ||
                          !selected.length ||
                          serviceProcessing
                        }
                        onClick={() =>
                          openCustomServiceCheckout("one_on_one", pkg.key, oneOnOneGrade, selected)
                        }
                      >
                        Pay with M-Pesa and request schedule
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-8 text-sm text-muted-foreground space-y-2">
              <p>Includes:</p>
              <ul className="list-disc pl-5">
                <li>Personalized teaching</li>
                <li>Flexible scheduling</li>
                <li>Homework support</li>
                <li>Individual progress reports</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-elegant)] sm:p-8">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">
              Homework help
            </p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
              Fast support when learners need it most.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Choose the subject you need help with. An administrator will arrange a time and assign
              a tutor after payment.
            </p>
            {user?.role !== "admin" ? (
              <label className="mt-5 grid gap-1.5 text-sm font-medium">
                Learner grade
                <select
                  className="h-11 rounded-md border border-input bg-background px-3"
                  value={homeworkGrade}
                  onChange={(event) => setHomeworkGrade(event.target.value)}
                >
                  <option value="">Choose a grade</option>
                  {CBE_GRADES.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {user?.role !== "admin" ? (
              <>
                <label className="mt-5 grid gap-1.5 text-sm font-medium">
                  Subject
                  <select
                    className="h-11 rounded-md border border-input bg-background px-3"
                    value={homeworkSubject}
                    onChange={(event) => setHomeworkSubject(event.target.value)}
                  >
                    <option value="">Choose a subject</option>
                    {CBE_SUBJECTS.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-8 space-y-4">
                  {homeworkHelpOptions.map((service) => (
                    <div
                      key={service.key}
                      className="rounded-3xl border border-border bg-background p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <p className="font-semibold">{service.label}</p>
                        <p className="font-display text-xl font-bold">
                          KSh{" "}
                          {servicePrices.homework_help[
                            service.key as keyof CustomServicePrices["homework_help"]
                          ].toLocaleString("en-KE")}
                        </p>
                      </div>
                      <Button
                        className="mt-4 w-full rounded-full"
                        disabled={
                          !servicePricesLoaded ||
                          !homeworkGrade ||
                          !homeworkSubject ||
                          serviceProcessing
                        }
                        onClick={() =>
                          openCustomServiceCheckout("homework_help", service.key, homeworkGrade, [
                            homeworkSubject,
                          ])
                        }
                      >
                        Pay with M-Pesa and request help
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            <div className="mt-8 text-sm text-muted-foreground space-y-2">
              <p>Includes:</p>
              <ul className="list-disc pl-5">
                <li>Homework guidance</li>
                <li>Error correction</li>
                <li>Assignment support</li>
                <li>Revision assistance</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-elegant)] sm:p-8">
          <h3 className="text-xl font-semibold sm:text-2xl">Why families choose Elimusphere</h3>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Whether you need focused one-on-one classes, collaborative group classes, or on-demand
            homework help, Elimusphere is built for Kenyan learners and budget-conscious parents.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              "Secure Safaricom payment",
              "Flexible scheduling",
              "CBE-aligned curriculum",
              "Trusted Kenyan tutors",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-border bg-background p-4">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
