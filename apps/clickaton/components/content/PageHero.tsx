import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { cn } from "@/lib/cn";

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  titleId?: string;
  description?: string;
  actions?: ReactNode;
  /** `yellow` → banda oscura editorial (sin fill amarillo). */
  tone?: "default" | "yellow" | "dark" | "muted" | "accent" | "base" | "raised";
  grain?: boolean;
  children?: ReactNode;
  className?: string;
};

export function PageHero({
  eyebrow,
  title,
  titleId = "page-title",
  description,
  actions,
  tone = "dark",
  grain = true,
  children,
  className,
}: PageHeroProps) {
  const sectionTone = tone === "yellow" ? "dark" : tone;

  return (
    <Section
      tone={sectionTone}
      grain={grain}
      className={cn(
        "ck-vignette relative overflow-hidden border-b border-ck-border",
        className,
      )}
      aria-labelledby={titleId}
    >
      <Container className="relative z-[2] max-w-3xl py-5 sm:py-8 md:py-12">
        {eyebrow ? (
          <p
            className={cn(
              "ck-overline",
              tone === "accent" ? "text-ck-accent" : "text-ck-yellow",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          id={titleId}
          className="ck-display-lg mt-[var(--ck-stack-title-to-subtitle)] break-words text-ck-text [overflow-wrap:anywhere]"
        >
          {title}
        </h1>
        {description ? (
          <p className="ck-body-lg mt-4 max-w-prose text-ck-text-secondary sm:mt-[var(--ck-stack-title-to-subtitle)]">
            {description}
          </p>
        ) : null}
        {actions ? (
          <div className="mt-8 flex w-full flex-col gap-3 sm:mt-[var(--ck-stack-content-to-actions)] sm:w-auto sm:flex-row sm:flex-wrap [&_a]:w-full [&_a]:sm:w-auto [&_button]:w-full [&_button]:sm:w-auto">
            {actions}
          </div>
        ) : null}
        {children}
      </Container>
    </Section>
  );
}
