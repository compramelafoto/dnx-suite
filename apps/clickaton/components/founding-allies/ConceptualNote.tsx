import { cn } from "@/lib/cn";

type ConceptualNoteProps = {
  children: string;
  className?: string;
};

/** Leyenda obligatoria para mockups / renders conceptuales. */
export function ConceptualNote({ children, className }: ConceptualNoteProps) {
  return (
    <p
      className={cn(
        "ck-caption border-l-2 border-ck-yellow/70 pl-3 text-ck-text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}
