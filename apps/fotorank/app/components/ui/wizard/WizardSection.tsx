"use client";

import * as React from "react";

export interface WizardSectionProps {
  variant?: "default" | "plain";
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Secciones del wizard: superficies fr-card / fr-border, acento dorado discreto.
 */
export function WizardSection({
  variant = "default",
  icon,
  title,
  description,
  children,
  className = "",
}: WizardSectionProps) {
  const shell =
    "rounded-xl border border-[#2a2a2a] bg-[#0d0f13] p-4 md:p-5 " +
    "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.03)]";

  if (variant === "plain") {
    return (
      <section className={`${shell} ${className}`}>
        <div className="space-y-5">{children}</div>
      </section>
    );
  }

  return (
    <section className={`${shell} ${className}`}>
      {title ? (
        <header className="mb-5 border-b border-[#262626] pb-4 md:mb-6">
          <div className="flex items-start gap-3">
            {icon != null ? (
              <span
                className="inline-flex shrink-0 items-center justify-center text-sm text-gold"
                aria-hidden
              >
                {icon}
              </span>
            ) : (
              <span className="mt-1 h-4 w-4 shrink-0 text-gold" aria-hidden>
                ✦
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <h3 className="font-sans text-[1.7rem] font-semibold leading-none tracking-tight text-fr-primary md:text-[1.8rem]">
                {title}
              </h3>
              {description ? (
                <p className="max-w-2xl text-sm leading-relaxed text-fr-muted">{description}</p>
              ) : null}
            </div>
          </div>
        </header>
      ) : null}
      <div className="space-y-5 md:space-y-6">{children}</div>
    </section>
  );
}

/** @deprecated Usar WizardSection */
export const WizardFieldGroup = WizardSection;
export type WizardFieldGroupProps = WizardSectionProps;
