import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
};

export function BrandLogo({ className, imageClassName }: BrandLogoProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center", className)}>
      <img
        src="/logo.svg"
        alt="Tusome Live"
        className={cn("h-12 w-44 max-w-full object-contain object-left", imageClassName)}
      />
    </span>
  );
}
