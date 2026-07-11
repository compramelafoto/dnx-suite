import { cx } from "./cx";
import type { FoundationBoxProps } from "./SiteContainer";

type SectionProps = FoundationBoxProps & {
  tone?: "default" | "muted" | "accent";
  spacing?: "md" | "lg" | "xl";
};

/** Sección de página con ritmo vertical consistente. */
export function Section({
  children,
  className,
  as: Tag = "section",
  tone = "default",
  spacing = "lg",
}: SectionProps) {
  const pad =
    spacing === "md"
      ? "py-10 md:py-12"
      : spacing === "xl"
        ? "py-20 md:py-28 lg:py-32"
        : "py-12 md:py-16";

  const bg =
    tone === "muted"
      ? "bg-[var(--is-bg-secondary)]"
      : tone === "accent"
        ? "bg-[var(--is-accent-soft)]"
        : "bg-transparent";

  return <Tag className={cx(pad, bg, className)}>{children}</Tag>;
}
