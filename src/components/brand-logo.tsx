import { cn } from "@/lib/utils";
import logoImage from "@/assets/elimusphere-logo.webp";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  animated?: boolean;
  animationType?: "pulse" | "float" | "glow" | "spin";
};

export function BrandLogo({
  className,
  imageClassName,
  animated = true,
  animationType = "pulse",
}: BrandLogoProps) {
  const animationClass = animated
    ? animationType === "pulse"
      ? "animate-logo-pulse"
      : animationType === "float"
        ? "animate-logo-float"
        : animationType === "glow"
          ? "animate-logo-glow"
          : animationType === "spin"
            ? "animate-logo-spin"
            : "animate-logo-pulse"
    : "";

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center justify-center rounded-full overflow-hidden bg-white transition-all duration-300",
        animationClass,
        className,
      )}
    >
      <img
        src={logoImage}
        alt="Elimusphere"
        className={cn("h-full w-full max-w-full object-contain", imageClassName)}
        width={512}
        height={512}
        decoding="async"
      />
    </span>
  );
}
