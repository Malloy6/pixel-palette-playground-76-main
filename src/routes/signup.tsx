import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Create your account | Tusome Live" },
      { name: "description", content: "Sign up as a parent, learner or tutor on Tusome Live." },
    ],
  }),
});

const roles = [
  { id: "parent", label: "Parent", desc: "Book classes for my learner" },
  { id: "learner", label: "Learner", desc: "I'm a CBE student" },
  { id: "tutor", label: "Tutor", desc: "I want to teach" },
];

function SignupPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState("parent");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        role,
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email"),
        phone: form.get("phone"),
        password: form.get("password"),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      toast.error(payload.message ?? "Could not create account.");
      return;
    }

    toast.success("Account created. You can join live classes now.");
    window.dispatchEvent(new Event('tusome:auth-changed'));
    window.location.href = '/classes';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[image:var(--gradient-soft)] p-6">
      <div className="w-full max-w-2xl">
        <Link to="/" aria-label="Tusome Live home" className="flex items-center justify-center">
          <BrandLogo imageClassName="h-16" />
        </Link>

        <div className="mt-8 rounded-3xl border border-border bg-card p-8 md:p-10 shadow-[var(--shadow-card)]">
          <h1 className="text-3xl font-bold">Create your account</h1>
          <p className="mt-2 text-muted-foreground">Start with a free account — no card needed.</p>

          <p className="mt-8 text-sm font-medium mb-3">I am a...</p>
          <div className="grid grid-cols-3 gap-3">
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
              <Label htmlFor="phone">Phone (M-Pesa)</Label>
              <Input id="phone" name="phone" type="tel" placeholder="0712 345 678" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full rounded-full" disabled={loading}>
              {loading ? "Creating..." : "Create account"}
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
