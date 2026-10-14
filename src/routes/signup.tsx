import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { isValidEmailAddress } from "@/lib/validation";

const safaricomPattern = /^(?:01[0-1]|070|071|072|074|075|076|079)\d{7}$/;

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Create your account | Elimusphere" },
      { name: "description", content: "Apply as a learner or tutor on Elimusphere." },
    ],
  }),
});

const roles = [
  { id: "learner", label: "Learner", desc: "I'm a CBE student" },
  { id: "tutor", label: "Tutor", desc: "Create your account & start teaching with Elimusphere" },
];

function SignupPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState("learner");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);

    const selectedDocuments =
      role === "tutor"
        ? (["cv", "tscCertificate", "applicationLetter", "supportingDocuments"] as const).flatMap(
            (documentType) =>
              form
                .getAll(documentType)
                .filter((entry): entry is File => entry instanceof File && entry.size > 0)
                .map((file) => ({ file, documentType })),
          )
        : [];

    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const phone = String(form.get("phone") ?? "").trim();
    if (form.get("acceptLegal") !== "on") {
      setLoading(false);
      toast.error("Accept the Terms of Use and your account agreement to continue.");
      return;
    }
    if (!isValidEmailAddress(email)) {
      setLoading(false);
      toast.error("Enter a valid email address.");
      return;
    }
    if (!safaricomPattern.test(phone)) {
      setLoading(false);
      toast.error("Enter a valid 10-digit Safaricom number.");
      return;
    }
    if (role === "tutor" && selectedDocuments.length < 3) {
      setLoading(false);
      toast.error("Upload your CV, TSC certificate, and application letter.");
      return;
    }
    const subject = String(form.get("subject") ?? "").trim();
    if (role === "tutor" && !subject) {
      setLoading(false);
      toast.error("Enter the subject you are applying to teach.");
      return;
    }

    async function encodeFile(file: File) {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      return window.btoa(binary);
    }

    const documents = await Promise.all(
      selectedDocuments.map(async ({ file, documentType }) => ({
        name: file.name,
        documentType,
        mimeType: file.type || "application/octet-stream",
        content: await encodeFile(file),
      })),
    );

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        role,
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email,
        phone,
        password: form.get("password"),
        subject: role === "tutor" ? subject : undefined,
        acceptLegal: true,
        documents,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      toast.error(payload.message ?? "Could not create account.");
      return;
    }

    toast.success(
      role === "learner"
        ? "Your learner account is ready. Welcome to Elimusphere!"
        : "Tutor application submitted. We’ll email you once it is reviewed.",
    );
    event.currentTarget.reset();
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const defaultRole = searchParams.get("role");
    if (defaultRole === "tutor" || defaultRole === "learner") {
      setRole(defaultRole);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[image:var(--gradient-soft)] p-6">
      <div className="w-full max-w-2xl">
        <Link to="/" aria-label="Elimusphere home" className="flex items-center justify-center">
          <BrandLogo imageClassName="h-28 w-28" />
        </Link>

        <div className="mt-8 rounded-3xl border border-border bg-card p-8 md:p-10 shadow-[var(--shadow-card)]">
          <h1 className="text-3xl font-bold">Create your account</h1>
          <p className="mt-2 text-muted-foreground">
            Create your account and start learning with Elimusphere.
          </p>

          <p className="mt-8 text-sm font-medium mb-3">I am a...</p>
          <div className="grid grid-cols-2 gap-3">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={`text-left rounded-2xl border p-4 transition ${
                  role === r.id
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <p className="font-semibold">{r.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
              </button>
            ))}
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first">First name</Label>
                <Input id="first" name="firstName" placeholder="Jane" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input id="last" name="lastName" placeholder="Mwangi" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="jane@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Safaricom phone number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                placeholder="0712345678"
                maxLength={10}
                pattern="(?:01[0-1]|070|071|072|074|075|076|079)\d{7}"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>
            {role === "tutor" ? (
              <div className="space-y-2">
                <Label htmlFor="subject">Subject you are applying to teach</Label>
                <Input
                  id="subject"
                  name="subject"
                  placeholder="e.g. Mathematics"
                  maxLength={160}
                  required
                />
              </div>
            ) : null}
            {role === "tutor" ? (
              <div className="space-y-4 rounded-2xl border border-border bg-background/60 p-4">
                <p className="font-semibold">Tutor application documents</p>
                {[
                  ["cv", "CV"],
                  ["tscCertificate", "TSC certificate"],
                  ["applicationLetter", "Application letter"],
                ].map(([name, label]) => (
                  <div key={name} className="space-y-2">
                    <Label htmlFor={name}>
                      {label} <span className="text-destructive">*</span>
                    </Label>
                    <Input id={name} name={name} type="file" accept=".pdf,.doc,.docx" required />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label htmlFor="supportingDocuments">
                    Other supporting documents{" "}
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="supportingDocuments"
                    name="supportingDocuments"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,image/*"
                  />
                </div>
              </div>
            ) : null}
            <label
              key={role}
              htmlFor="acceptLegal"
              className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-4 text-sm"
            >
              <input
                id="acceptLegal"
                name="acceptLegal"
                type="checkbox"
                required
                className="mt-1 size-4 shrink-0 accent-primary"
              />
              <span className="text-muted-foreground">
                I have read and agree to the{" "}
                <a
                  href="/legal/terms-of-service"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  Terms of Use
                </a>{" "}
                and{" "}
                <a
                  href={role === "tutor" ? "/legal/teacher-agreement" : "/legal/student-agreement"}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  {role === "tutor" ? "Teacher Agreement" : "Student Agreement"}
                </a>
                , and acknowledge the{" "}
                <a
                  href="/legal/privacy-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>
            <Button type="submit" size="lg" className="w-full rounded-full" disabled={loading}>
              {loading
                ? "Signing up..."
                : role === "learner"
                  ? "Sign up"
                  : "Submit tutor application"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
