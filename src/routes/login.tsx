import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in | Tusome Live" },
      { name: "description", content: "Sign in to your Tusome Live account." },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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
    // let other parts of the app (header) refresh auth state
    window.dispatchEvent(new Event('tusome:auth-changed'));
    // perform a full navigation so cookie is sent on first load
    window.location.href = '/classes';
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative bg-[image:var(--gradient-hero)] text-primary-foreground p-12 flex-col justify-between">
        <Link to="/" aria-label="Tusome Live home" className="flex items-center">
          <BrandLogo imageClassName="h-16 drop-shadow-sm" />
        </Link>
        <div className="space-y-4">
          <p className="text-3xl font-display font-bold leading-snug">
            "My daughter's grades improved by two levels in one term. Tusome tutors really get the
            CBC."
          </p>
          <p className="opacity-80">— Susan W., parent in Nairobi</p>
        </div>
        <p className="text-sm opacity-70">© {new Date().getFullYear()} Tusome Live</p>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link to="/" aria-label="Tusome Live home" className="mb-8 flex items-center">
            <BrandLogo imageClassName="h-14" />
          </Link>
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">Sign in to your Tusome Live account.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-xs text-primary hover:underline">
                  Forgot?
                </a>
              </div>
              <Input
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

          <p className="mt-6 text-sm text-muted-foreground text-center">
            New to Tusome?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
