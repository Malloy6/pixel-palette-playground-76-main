import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

export function AppLoadingScreen({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-background px-6",
        className,
      )}
      role="status"
      aria-label="Loading Tusome Live"
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-5 text-center">
        <BrandLogo imageClassName="h-20 w-full" />
        <div className="h-1.5 w-36 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-1/2 animate-[loading-slide_1.15s_ease-in-out_infinite] rounded-full bg-[image:var(--gradient-hero)]" />
        </div>
      </div>
    </div>
  );
}
