import Link from "next/link";
import type { LegalSection } from "@/lib/legal/content";
import { LEGAL_LAST_UPDATED } from "@/lib/legal/content";

/**
 * La página de un texto legal.
 *
 * Es pública y sin sesión a propósito: Google la abre desde la pantalla de consentimiento,
 * y cualquiera tiene que poder leerla antes de decidir si acepta.
 */
export function LegalPage({
  title,
  intro,
  sections,
  otherHref,
  otherLabel,
}: {
  title: string;
  intro: string;
  sections: readonly LegalSection[];
  otherHref: string;
  otherLabel: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-2xl px-4 py-12 md:py-16">
        <header className="space-y-3">
          <Link
            href="/"
            className="text-xs font-medium text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
          >
            Fotoffice
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{intro}</p>
          <p className="text-xs text-[var(--fo-muted)]">
            Última actualización: {LEGAL_LAST_UPDATED}
          </p>
        </header>

        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-base font-semibold tracking-tight">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-relaxed text-[var(--fo-text-secondary)]">
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="ml-4 list-disc space-y-2 text-sm leading-relaxed text-[var(--fo-text-secondary)] marker:text-[var(--fo-muted)]">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <footer className="mt-12 border-t border-[var(--fo-border)] pt-6">
          <Link
            href={otherHref}
            className="text-sm font-medium text-[var(--fo-accent)] hover:underline"
          >
            {otherLabel} →
          </Link>
        </footer>
      </main>
    </div>
  );
}
