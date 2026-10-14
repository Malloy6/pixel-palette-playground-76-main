import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHero } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: function PricingRedirect() {
    // Pricing now lives on /classes — redirecting
    if (typeof window !== "undefined") window.location.href = "/classes";
    return null;
  },
  head: () => ({
    meta: [{ title: "Pricing — Redirecting…" }],
  }),
});

export default null;
