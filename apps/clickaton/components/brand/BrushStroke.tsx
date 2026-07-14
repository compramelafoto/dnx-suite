import { cn } from "@/lib/cn";

type BrushStrokeProps = {
  className?: string;
};

/** Pincelada abstracta SVG. Decorativa y liviana. */
export function BrushStroke({ className }: BrushStrokeProps) {
  return (
    <svg
      className={cn("h-3 w-24 text-ck-yellow", className)}
      viewBox="0 0 120 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 7.5C18 2.5 34 10 50 6.5C66 3 82 9.5 98 5.5C106 3.5 114 6 118 4"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
