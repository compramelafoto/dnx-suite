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
  align?: "left" | "center";
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
  align = "left",
  grain = false,
  children,
  className,
}: PageHeroProps) {
  const sectionTone = tone === "yellow" ? "dark" : tone;
  const centered = align === "center";

  return (
    <Section
      tone={sectionTone}
      grain={grain}
      className={cn("relative overflow-hidden", className)}
      aria-labelledby={titleId}
    >
      <Container
        className={cn(
          "relative z-[2] max-w-3xl py-5 sm:py-8 md:py-12",
          centered && "mx-auto text-center",
        )}
      >
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
          <p
            className={cn(
              "ck-body-lg mt-4 max-w-prose text-ck-text-secondary sm:mt-[var(--ck-stack-title-to-subtitle)]",
              centered && "mx-auto",
            )}
          >
            {description}
          </p>
        ) : null}
        {actions ? (
          <div
            className={cn(
              "mt-8 flex w-full flex-col gap-3 sm:mt-[var(--ck-stack-content-to-actions)] sm:w-auto sm:flex-row sm:flex-wrap [&_a]:w-full [&_a]:sm:w-auto [&_button]:w-full [&_button]:sm:w-auto",
              centered && "items-center justify-center sm:mx-auto",
            )}
          >
            {actions}
          </div>
        ) : null}
        {children}
      </Container>
    </Section>
  );
}
