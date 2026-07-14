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
  tone?: "default" | "yellow" | "dark" | "muted" | "accent";
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
  tone = "yellow",
  grain = true,
  children,
  className,
}: PageHeroProps) {
  return (
    <Section
      tone={tone}
      grain={grain}
      className={cn("border-b-2 border-ck-border-strong", className)}
      aria-labelledby={titleId}
    >
      <Container className="max-w-3xl">
        {eyebrow ? (
          <p
            className={cn(
              "ck-overline",
              tone === "dark" ? "text-ck-yellow" : "text-ck-text-muted",
              tone === "yellow" && "text-ck-black/70",
              tone === "accent" && "text-ck-accent",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          id={titleId}
          className={cn(
            "ck-display-lg mt-[var(--ck-stack-title-to-subtitle)]",
            tone === "dark" && "text-ck-yellow",
            (tone === "yellow" || tone === "accent" || tone === "default" || tone === "muted") &&
              "text-ck-black",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "ck-body-lg mt-[var(--ck-stack-title-to-subtitle)] max-w-prose",
              tone === "dark" ? "text-ck-gray-200" : "text-ck-text-secondary",
            )}
          >
            {description}
          </p>
        ) : null}
        {actions ? (
          <div className="mt-[var(--ck-stack-content-to-actions)] flex flex-wrap gap-3">
            {actions}
          </div>
        ) : null}
        {children}
      </Container>
    </Section>
  );
}
