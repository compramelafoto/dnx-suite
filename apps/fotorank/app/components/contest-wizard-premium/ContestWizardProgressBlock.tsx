"use client";

interface ContestWizardProgressBlockProps {
  headline: string;
  intro: string;
  /** Texto opcional de estado (borrador / guardando) */
  statusLine?: React.ReactNode;
}

/**
 * Título principal + subtítulo + estado, con lectura alineada a la izquierda.
 */
const WIZARD_HEADLINE_ID = "create-contest-wizard-headline";

export function ContestWizardProgressBlock({ headline, intro, statusLine }: ContestWizardProgressBlockProps) {
  return (
    <div className="mb-20 w-full pt-10 sm:mb-24 sm:pt-14">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-8 pl-6 sm:gap-10 sm:pl-10">
        <h2
          id={WIZARD_HEADLINE_ID}
          className="text-left text-4xl font-semibold leading-[1.15] tracking-tight text-white sm:text-5xl"
        >
          {headline}
        </h2>

        <p className="max-w-[640px] text-left text-base leading-[1.75] text-zinc-400 sm:text-lg sm:leading-[1.8]">
          {intro}
        </p>

        {statusLine ? (
          <div
            className="border-l border-white/10 pl-4 text-left text-[12px] font-medium leading-7 text-zinc-500 sm:pl-5 sm:text-[13px]"
            aria-live="polite"
            aria-atomic="true"
          >
            {statusLine}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { WIZARD_HEADLINE_ID };
