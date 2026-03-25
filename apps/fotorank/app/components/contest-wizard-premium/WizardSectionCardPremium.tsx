"use client";

import { Card } from "@repo/design-system";

interface WizardSectionCardPremiumProps {
  title: string;
  description?: string;
  /** Si true, no muestra el header con el título */
  hideTitle?: boolean;
  /** Si true, centra el contenido dentro de la ficha */
  centerContent?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Bloque de contenido del wizard con recuadros consistentes y espaciado uniforme.
 */
export function WizardSectionCardPremium({
  title,
  description,
  hideTitle = false,
  centerContent = false,
  children,
  className = "",
}: WizardSectionCardPremiumProps) {
  return (
    <Card
      className={`mx-auto w-full max-w-3xl rounded-2xl border-zinc-800/80 bg-[#0d0d10] px-6 py-8 shadow-none hover:shadow-none sm:px-8 sm:py-10 md:px-10 md:py-10 ${className}`}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}
    >
      {!hideTitle && (
        <header className="mb-8 text-left sm:mb-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="select-none text-lg text-amber-400" aria-hidden>
              »
            </span>
            <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h3>
          </div>
          {description ? (
            <p className="mt-4 max-w-2xl border-l border-white/10 pl-4 text-sm leading-relaxed text-zinc-500 sm:mt-5">
              {description}
            </p>
          ) : null}
        </header>
      )}
      <div className={centerContent ? "flex flex-col items-center gap-y-8 sm:gap-y-10" : "space-y-8 sm:space-y-10"}>
        {children}
      </div>
    </Card>
  );
}
