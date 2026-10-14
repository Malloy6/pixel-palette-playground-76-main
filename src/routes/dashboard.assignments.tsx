import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, ClipboardList, FileUp, Pencil, Send, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { DashboardShell, type DashboardUser } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Attachment = { name: string; mimeType: string; content: string };
type LearnerAssignment = {
  id: number;
  title: string;
  instructions: string;
  attachments: Attachment[];
  dueAt: string | null;
  subject: string;
  classGrade: string;
  submissionId: number | null;
  response: string;
  submissionAttachments: Attachment[];
  grade: number | null;
  feedback: string | null;
};
type TutorSubmission = {
  id: number;
  studentName: string;
  response: string;
  attachments: Attachment[];
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
};
type TutorAssignment = {
  id: number;
  title: string;
  instructions: string;
  attachments: Attachment[];
  dueAt: string | null;
  subject: string;
  classGrade: string;
  classId: number;
  targetLearnerName: string | null;
  isWithdrawn: boolean;
  subscriberCount: number;
  submittedCount: number;
  gradedCount: number;
  submissions: TutorSubmission[];
};
type LiveClass = { id: number; subject: string; grade: string };
type TutorStudent = {
  id: number;
  firstName: string;
  lastName: string;
  classes: { id: number; subject: string; grade: string }[];
};
type Progress = { assigned: number; submitted: number; graded: number; average: number | null };

export const Route = createFileRoute("/dashboard/assignments")({
  component: AssignmentsPage,
  head: () => ({ meta: [{ title: "Assignments | Elimusphere" }] }),
});

function readFiles(files: FileList | null) {
  return Promise.all(
    Array.from(files ?? [])
      .slice(0, 3)
      .map(
        (file) =>
          new Promise<Attachment>((resolve, reject) => {
            if (file.size > 4 * 1024 * 1024)
              return reject(new Error(`${file.name} is larger than 4 MB.`));
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name,
                mimeType: file.type || "application/octet-stream",
                content: String(reader.result),
              });
            reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
            reader.readAsDataURL(file);
          }),
      ),
  );
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function AssignmentFiles({ files }: { files: Attachment[] }) {
  if (!files.length) return null;
  return (
    <ul className="mt-3 space-y-1 text-sm">
      {files.map((file, index) => (
        <li key={`${file.name}-${index}`}>
          <a className="text-primary underline" href={file.content} download={file.name}>
            {file.name}
          </a>
        </li>
      ))}
    </ul>
  );
}

function AssignmentsPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [students, setStudents] = useState<TutorStudent[]>([]);
  const [assignments, setAssignments] = useState<(LearnerAssignment | TutorAssignment)[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [assignmentClassId, setAssignmentClassId] = useState("");
  const [assignmentScope, setAssignmentScope] = useState<"class" | "individual">("class");
  const [targetLearnerId, setTargetLearnerId] = useState("");

  const load = async () => {
    const [me, subscribed, assignmentsData, progressData] = await Promise.all([
      fetch("/api/auth/me", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/classes/subscribed", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch("/api/learning/assignments", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch("/api/learning/progress", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : null,
      ),
    ]);
    const currentUser = me?.user ?? null;
    setUser(currentUser);
    if (currentUser?.role === "tutor") {
      const [own, studentData] = await Promise.all([
        fetch("/api/classes", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/tutor/students", { credentials: "include" }).then((r) =>
          r.ok ? r.json() : null,
        ),
      ]);
      setClasses(
        (own?.classes ?? []).filter(
          (item: LiveClass & { tutorUserId?: number }) => item.tutorUserId === currentUser.id,
        ),
      );
      setStudents(studentData?.students ?? []);
    } else {
      setClasses(subscribed?.classes ?? []);
      setStudents([]);
    }
    setAssignments(assignmentsData?.assignments ?? []);
    setProgress(progressData?.progress ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void load().catch(() => {
      toast.error("Could not load assignments. Please try again.");
      setLoading(false);
    });
  }, []);

  const classStudents = students.filter((student) =>
    student.classes.some((item) => item.id === Number(assignmentClassId)),
  );

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/learning/assignments", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId: Number(form.get("classId")),
        targetLearnerId: assignmentScope === "individual" ? Number(targetLearnerId) : null,
        title: form.get("title"),
        instructions: form.get("instructions"),
        dueAt: form.get("dueAt"),
        attachments: files,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(data.message ?? "Could not publish assignment.");
    event.currentTarget.reset();
    setFiles([]);
    setAssignmentClassId("");
    setAssignmentScope("class");
    setTargetLearnerId("");
    toast.success(
      assignmentScope === "individual"
        ? "Assignment sent to the selected learner."
        : "Assignment published to learners in the class.",
    );
    void load();
  }

  async function updateAssignment(
    event: FormEvent<HTMLFormElement>,
    assignmentId: number,
    attachments: Attachment[] | null,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      title: form.get("title"),
      instructions: form.get("instructions"),
      dueAt: form.get("dueAt"),
    };
    if (attachments !== null) body.attachments = attachments;
    try {
      const response = await fetch(`/api/learning/assignments/${assignmentId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.message ?? "Could not update assignment.");
        return false;
      }
      toast.success("Assignment updated.");
      void load();
      return true;
    } catch {
      toast.error("Could not update assignment. Check your connection and try again.");
      return false;
    }
  }

  async function changeAssignmentPublication(item: TutorAssignment) {
    const withdrawing = !item.isWithdrawn;
    if (
      withdrawing &&
      !window.confirm(
        "Withdraw this assignment? Learners will no longer see or submit it. Existing submissions and grades will be kept.",
      )
    )
      return;
    try {
      const response = await fetch(
        `/api/learning/assignments/${item.id}${withdrawing ? "" : "/restore"}`,
        {
          method: withdrawing ? "DELETE" : "POST",
          credentials: "include",
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.message ?? "Could not update assignment availability.");
        return;
      }
      toast.success(withdrawing ? "Assignment withdrawn." : "Assignment republished.");
      void load();
    } catch {
      toast.error("Could not update assignment availability. Check your connection and try again.");
    }
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
    assignmentId: number,
    submissionFiles: Attachment[],
  ): Promise<boolean> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/learning/assignments/${assignmentId}/submit`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ response: form.get("response"), attachments: submissionFiles }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(data.message ?? "Could not submit assignment.");
      return false;
    }
    setFiles([]);
    toast.success("Assignment submitted.");
    void load();
    return true;
  }

  async function grade(event: FormEvent<HTMLFormElement>, submissionId: number) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/learning/submissions/grade", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submissionId,
        grade: Number(form.get("grade")),
        feedback: form.get("feedback"),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(data.message ?? "Could not save grade.");
    toast.success("Grade and feedback saved.");
    void load();
  }

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[image:var(--gradient-dashboard)]">
        Loading assignments…
      </main>
    );
  if (!user || (user.role !== "tutor" && user.role !== "learner"))
    return (
      <main className="grid min-h-screen place-items-center">
        Tutor or learner access required.
      </main>
    );

  const tutor = user.role === "tutor";
  return (
    <DashboardShell user={user}>
      <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-10">
        <section className="flex flex-wrap items-end justify-between gap-4 border-b pb-8">
          <div>
            <p className="text-sm font-medium text-primary">Learning workspace</p>
            <h1 className="mt-2 text-3xl font-bold">Assignments</h1>
            <p className="mt-2 text-muted-foreground">
              {tutor
                ? "Publish work to a whole class or one learner, then review and grade submissions."
                : "Read instructions, download files, submit your work and track tutor feedback."}
            </p>
          </div>
          <ProgressCard progress={progress} />
        </section>

        {tutor ? (
          <section className="mt-8 rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Publish an assignment</h2>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createAssignment}>
              <select
                className="h-10 rounded-md border bg-background px-3"
                name="classId"
                value={assignmentClassId}
                onChange={(event) => {
                  setAssignmentClassId(event.target.value);
                  setTargetLearnerId("");
                }}
                required
              >
                <option value="">Choose your class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.subject} · {item.grade}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border bg-background px-3"
                value={assignmentScope}
                onChange={(event) =>
                  setAssignmentScope(event.target.value as "class" | "individual")
                }
              >
                <option value="class">Assign to the whole class</option>
                <option value="individual">Assign to one learner</option>
              </select>
              {assignmentScope === "individual" ? (
                <select
                  className="h-10 rounded-md border bg-background px-3 md:col-span-2"
                  name="targetLearnerId"
                  value={targetLearnerId}
                  onChange={(event) => setTargetLearnerId(event.target.value)}
                  required
                  disabled={!assignmentClassId || !classStudents.length}
                >
                  <option value="">
                    {classStudents.length
                      ? "Choose an enrolled learner"
                      : "No enrolled learners in this class"}
                  </option>
                  {classStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.firstName} {student.lastName}
                    </option>
                  ))}
                </select>
              ) : null}
              <Input name="title" placeholder="Assignment title" required />
              <Input name="dueAt" type="datetime-local" />
              <Textarea
                className="md:col-span-2"
                name="instructions"
                placeholder="Instructions for learners"
                required
              />
              <Input
                type="file"
                multiple
                onChange={(event) =>
                  readFiles(event.target.files)
                    .then(setFiles)
                    .catch((error: Error) => toast.error(error.message))
                }
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {files.length ? `${files.length} file(s) attached` : "Up to 3 files, 4 MB each"}
                </span>
                <Button disabled={assignmentScope === "individual" && !classStudents.length}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Publish
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="mt-8 space-y-4">
          {assignments.length ? (
            assignments.map((item) =>
              tutor ? (
                <TutorCard
                  key={item.id}
                  item={item as TutorAssignment}
                  onGrade={grade}
                  onUpdate={updateAssignment}
                  onChangePublication={changeAssignmentPublication}
                />
              ) : (
                <LearnerCard key={item.id} item={item as LearnerAssignment} onSubmit={submit} />
              ),
            )
          ) : (
            <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
              <ClipboardList className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 font-medium">No assignments yet</p>
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}

function ProgressCard({ progress }: { progress: Progress | null }) {
  const percentage = progress?.assigned
    ? Math.round((progress.submitted / progress.assigned) * 100)
    : 0;
  return (
    <div className="min-w-52 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <BarChart3 className="h-4 w-4 text-primary" />
        Progress
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${percentage}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {progress?.submitted ?? 0}/{progress?.assigned ?? 0} submitted ·{" "}
        {progress?.average === null || progress?.average === undefined
          ? "Not graded"
          : `${Math.round(progress.average)}% average`}
      </p>
    </div>
  );
}

function LearnerCard({
  item,
  onSubmit,
}: {
  item: LearnerAssignment;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    id: number,
    files: Attachment[],
  ) => Promise<boolean>;
}) {
  const [submissionFiles, setSubmissionFiles] = useState<Attachment[]>([]);
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm text-primary">
            {item.subject} · {item.classGrade}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{item.title}</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {item.dueAt ? `Due ${new Date(item.dueAt).toLocaleDateString()}` : "No due date"}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.instructions}</p>
      <AssignmentFiles files={item.attachments} />
      {item.submissionId ? (
        <div className="mt-4 rounded-xl bg-muted/50 p-4">
          <p className="text-sm font-medium">Your submitted work</p>
          {item.response ? (
            <p className="mt-2 whitespace-pre-wrap text-sm">{item.response}</p>
          ) : null}
          <AssignmentFiles files={item.submissionAttachments} />
        </div>
      ) : null}
      {item.grade !== null ? (
        <div className="mt-4 rounded-lg bg-primary/10 p-3 text-sm">
          <strong>Grade: {item.grade}%</strong>
          {item.feedback ? <p className="mt-1">{item.feedback}</p> : null}
        </div>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            void onSubmit(event, item.id, submissionFiles).then((success) => {
              if (success) setSubmissionFiles([]);
            });
          }}
        >
          <Textarea
            name="response"
            defaultValue={item.response}
            placeholder="Write your response or attach your completed work"
          />
          <Input
            type="file"
            multiple
            onChange={(event) =>
              readFiles(event.target.files)
                .then(setSubmissionFiles)
                .catch((error: Error) => toast.error(error.message))
            }
          />
          <Button>
            <Send className="mr-2 h-4 w-4" />
            {item.submissionId ? "Resubmit work" : "Submit work"}
          </Button>
        </form>
      )}
    </article>
  );
}

function TutorCard({
  item,
  onGrade,
  onUpdate,
  onChangePublication,
}: {
  item: TutorAssignment;
  onGrade: (event: FormEvent<HTMLFormElement>, id: number) => Promise<void>;
  onUpdate: (
    event: FormEvent<HTMLFormElement>,
    id: number,
    attachments: Attachment[] | null,
  ) => Promise<boolean>;
  onChangePublication: (item: TutorAssignment) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editFiles, setEditFiles] = useState<Attachment[] | null>(null);
  const [saving, setSaving] = useState(false);
  const displayedFiles = editFiles ?? item.attachments;

  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm text-primary">
            {item.subject} · {item.classGrade}
            {item.targetLearnerName ? ` · Individual: ${item.targetLearnerName}` : " · Whole class"}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{item.title}</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {item.isWithdrawn ? (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Withdrawn
            </span>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {item.submittedCount}/{item.subscriberCount} submitted · {item.gradedCount} graded
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing((value) => !value);
              setEditFiles(null);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {editing ? "Cancel edit" : "Edit"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onChangePublication(item)}
          >
            {item.isWithdrawn ? (
              "Republish"
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Withdraw
              </>
            )}
          </Button>
        </div>
      </div>
      {editing ? (
        <form
          className="mt-4 grid gap-3 rounded-xl border bg-background p-4"
          onSubmit={(event) => {
            setSaving(true);
            void onUpdate(event, item.id, editFiles).then((success) => {
              if (success) {
                setEditing(false);
                setEditFiles(null);
              }
              setSaving(false);
            });
          }}
        >
          <Input name="title" defaultValue={item.title} placeholder="Assignment title" required />
          <Input name="dueAt" type="datetime-local" defaultValue={toDateTimeLocal(item.dueAt)} />
          <Textarea
            name="instructions"
            defaultValue={item.instructions}
            placeholder="Instructions for learners"
            required
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">Assignment files</p>
            {displayedFiles.length ? (
              <>
                <AssignmentFiles files={displayedFiles} />
                {editFiles === null ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditFiles([])}>
                    Remove current files
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No files attached.</p>
            )}
            <Input
              type="file"
              multiple
              onChange={(event) =>
                readFiles(event.target.files)
                  .then(setEditFiles)
                  .catch((error: Error) => toast.error(error.message))
              }
            />
            <p className="text-xs text-muted-foreground">
              Selecting files replaces the current files. Up to 3 files, 4 MB each.
            </p>
          </div>
          <div className="flex justify-end">
            <Button disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      ) : null}
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.instructions}</p>
      <AssignmentFiles files={item.attachments} />
      <div className="mt-4 space-y-3">
        {item.submissions.length ? (
          item.submissions.map((submission) => (
            <div key={submission.id} className="rounded-xl bg-muted/50 p-4">
              <p className="font-medium">{submission.studentName}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {submission.response || "File submission"}
              </p>
              <AssignmentFiles files={submission.attachments} />
              <form
                className="mt-3 flex flex-wrap gap-2"
                onSubmit={(event) => void onGrade(event, submission.id)}
              >
                <Input
                  className="w-24"
                  name="grade"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={submission.grade ?? ""}
                  required
                />
                <Input
                  className="min-w-48 flex-1"
                  name="feedback"
                  defaultValue={submission.feedback ?? ""}
                  placeholder="Feedback"
                />
                <Button size="sm">Save grade</Button>
              </form>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No learner submissions yet.</p>
        )}
      </div>
    </article>
  );
}
