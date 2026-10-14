import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Mail, MessageCircle, Phone, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { DashboardShell, type DashboardUser } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";

type Student = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  bookedAt: string;
  classes: { id: number; subject: string; grade: string; scheduleLabel: string }[];
};
export const Route = createFileRoute("/dashboard/students")({
  component: StudentsPage,
  head: () => ({ meta: [{ title: "Students | Elimusphere" }] }),
});

function StudentsPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/tutor/students", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([me, data]) => {
        setUser(me?.user ?? null);
        setStudents(Array.isArray(data?.students) ? data.students : []);
      })
      .finally(() => setLoading(false));
  }, []);
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[image:var(--gradient-dashboard)]">
        Loading students…
      </main>
    );
  if (!user || user.role !== "tutor")
    return (
      <main className="grid min-h-screen place-items-center p-4">
        <section className="max-w-md rounded-2xl border bg-card p-8 text-center">
          <h1 className="text-xl font-bold">Tutor access required</h1>
          <Link to="/dashboard" className="mt-5 inline-block">
            <Button>Go to dashboard</Button>
          </Link>
        </section>
      </main>
    );
  return (
    <DashboardShell user={user}>
      <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-10">
        <section className="border-b pb-8">
          <p className="text-sm font-medium text-primary">Tutor workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your students</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Open a learner profile to see their enrolled classes and start a conversation.
          </p>
        </section>
        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
          <div className="space-y-3">
            {students.length ? (
              students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => setSelected(student)}
                  className={`flex w-full items-center justify-between rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:border-primary/50 ${selected?.id === student.id ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  <div>
                    <p className="font-semibold">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {student.classes
                        .map((item) => `${item.subject} · ${item.grade}`)
                        .join("  •  ")}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    View profile
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
                <Users className="mx-auto h-8 w-8 text-primary" />
                <h2 className="mt-4 text-lg font-semibold">No students yet</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Learners will appear here once they register for one of your classes.
                </p>
              </div>
            )}
          </div>
          <aside className="rounded-2xl border bg-card p-6 shadow-sm">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-primary">Learner profile</p>
                    <h2 className="mt-1 text-2xl font-bold">
                      {selected.firstName} {selected.lastName}
                    </h2>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelected(null)}
                    aria-label="Close profile"
                  >
                    ×
                  </Button>
                </div>
                <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    {selected.email}
                  </p>
                  {selected.phone ? (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      {selected.phone}
                    </p>
                  ) : null}
                  <p>Joined your classes {new Date(selected.bookedAt).toLocaleDateString()}</p>
                </div>
                <div className="mt-6 border-t pt-5">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <BookOpen className="h-4 w-4 text-primary" /> Enrolled classes
                  </h3>
                  <div className="mt-3 space-y-2">
                    {selected.classes.map((item) => (
                      <div key={item.id} className="rounded-lg bg-muted/60 p-3 text-sm">
                        <p className="font-medium">
                          {item.subject}{" "}
                          <span className="font-normal text-muted-foreground">· {item.grade}</span>
                        </p>
                        <p className="mt-1 text-muted-foreground">{item.scheduleLabel}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <Link
                  to="/dashboard/messages"
                  search={{ contactId: selected.id }}
                  className="mt-6 block"
                >
                  <Button className="w-full">
                    Message {selected.firstName}
                    <MessageCircle className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </>
            ) : (
              <div className="grid min-h-64 place-items-center text-center">
                <div>
                  <Users className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-3 font-medium">Select a student</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Their individual profile will appear here.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </section>
        <Link to="/dashboard/classes" className="mt-8 inline-flex">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to classes
          </Button>
        </Link>
      </main>
    </DashboardShell>
  );
}
