import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in | Elimusphere" },
      { name: "description", content: "Sign in to your Elimusphere account." },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const tokenParam = search.get("token");
    if (tokenParam) {
      setMode("reset");
      setToken(tokenParam);
      return;
    }
    if (search.get("forgot") === "1") {
      setMode("forgot");
      return;
    }
    if (search.get("reason") === "inactivity") {
      toast.message("You were signed out after 30 minutes of inactivity.");
    }
    setMode("login");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      toast.error(payload.message ?? "Could not sign in.");
      return;
    }

    toast.success("Signed in successfully.");
    window.dispatchEvent(new Event("tusome:auth-changed"));
    window.location.href = payload.user?.role === "learner" ? "/classes" : "/dashboard";
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });

    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      toast.error(payload.message ?? "Could not send reset instructions.");
      return;
    }

    setMessage("If that email exists, reset instructions have been sent.");
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const password = form.get("password");
    const confirmPassword = form.get("confirmPassword");

    if (password !== confirmPassword) {
      toast.error("Passwords must match.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      toast.error(payload.message ?? "Could not reset your password.");
      return;
    }

    toast.success("Password reset. You can now sign in.");
    window.location.href = "/login";
  }

  const renderLogin = mode === "login";
  const renderForgot = mode === "forgot";
  const renderReset = mode === "reset";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative bg-[image:var(--gradient-hero)] text-primary-foreground p-12 flex-col justify-between">
        <Link to="/" aria-label="Elimusphere home" className="flex items-center">
          <BrandLogo imageClassName="h-28 w-28 drop-shadow-sm" />
        </Link>
        <div className="space-y-4">
          <p className="text-3xl font-display font-bold leading-snug">
            "My daughter's grades improved by two levels in one term. Elimusphere tutors really get the
            CBE Curriculum."
          </p>
          <p className="opacity-80">— Susan W., parent in Nairobi</p>
        </div>
        <p className="text-sm opacity-70">© {new Date().getFullYear()} Elimusphere</p>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link to="/" aria-label="Elimusphere home" className="mb-8 flex items-center">
            <BrandLogo imageClassName="h-24 w-24" />
          </Link>
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">
            {renderForgot
              ? "Enter your email and we’ll send password reset instructions."
              : renderReset
                ? "Set a new password for your Elimusphere account."
                : "Sign in to your Elimusphere account."}
          </p>

          {message ? (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              {message}
            </div>
          ) : null}

          {renderLogin ? (
            <>
              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="password">Password</Label>
                    <a href="/login?forgot=1" className="text-xs text-primary hover:underline">
                      Forgot?
                    </a>
                  </div>
                  <PasswordInput
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" className="w-full rounded-full" size="lg" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
              {import.meta.env.DEV ? (
                <aside className="mt-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Local workflow test accounts</p>
                  <p className="mt-1">
                    learner.demo@elimusphere.test · tutor.demo@elimusphere.test ·
                    admin.demo@elimusphere.test
                  </p>
                  <p className="mt-1">
                    Use the demo password configured for this environment.
                  </p>
                </aside>
              ) : null}
            </>
          ) : renderForgot ? (
            <form className="mt-8 space-y-5" onSubmit={handleForgotPassword}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <Button type="submit" className="w-full rounded-full" size="lg" disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleResetPassword}>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  type="password"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Repeat your password"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" className="w-full rounded-full" size="lg" disabled={loading}>
                {loading ? "Resetting..." : "Reset password"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm text-muted-foreground text-center">
            {renderLogin ? (
              <>
                New to Elimusphere?{" "}
                <Link to="/signup" className="text-primary font-medium hover:underline">
                  Create an account
                </Link>
              </>
            ) : (
              <Link to="/login" className="text-primary font-medium hover:underline">
                Back to sign in
              </Link>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
