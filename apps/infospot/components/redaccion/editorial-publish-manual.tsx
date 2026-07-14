"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  PUBLISH_MANUAL,
  type ManualAudience,
  type ManualOriginId,
  type ManualStep,
} from "@/lib/editorial-publish-manual";

type Props = {
  audience?: ManualAudience;
  /** Origen inicial (p. ej. deep link ?origen=web-intake). */
  initialOrigin?: ManualOriginId;
  /** Si false, el padre ya muestra título (p. ej. PageShell). */
  showChromeHeader?: boolean;
};

const ACTOR_LABEL: Record<NonNullable<ManualStep["actor"]>, string> = {
  publico: "Público",
  clf: "CLF",
  redaccion: "Redacción",
  direccion: "Dirección",
};

function actorBadgeClass(actor: NonNullable<ManualStep["actor"]>): string {
  switch (actor) {
    case "publico":
      return "bg-[var(--is-bg-secondary)] text-[var(--is-text-secondary)]";
    case "clf":
      return "bg-[var(--is-orange-50)] text-[var(--is-orange-900)]";
    case "redaccion":
      return "bg-[var(--is-orange-50)] text-[var(--is-accent)]";
    case "direccion":
      return "bg-[var(--is-accent)] text-white";
  }
}

function StepList({ steps }: { steps: readonly ManualStep[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={`${index}-${step.text}`} className="flex gap-4">
          <span
            aria-hidden
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--is-bg-secondary)] font-[family-name:var(--font-source-serif)] text-sm font-semibold tabular-nums text-[var(--is-text)]"
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            {step.actor ? (
              <span
                className={[
                  "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                  actorBadgeClass(step.actor),
                ].join(" ")}
              >
                {ACTOR_LABEL[step.actor]}
              </span>
            ) : null}
            <p className="text-sm leading-relaxed text-[var(--is-text)] sm:text-base">
              {step.text}
              {step.href ? (
                <>
                  {" "}
                  <Link
                    href={step.href}
                    className="font-semibold text-[var(--is-accent)] underline-offset-2 hover:underline"
                  >
                    Ir →
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RoleChecklist({
  title,
  items,
}: {
  title: string;
  items: readonly { label: string; href: string }[];
}) {
  return (
    <section className="space-y-5 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white p-6 sm:p-8">
      <h2 className="font-[family-name:var(--font-source-serif)] text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.href + item.label}>
            <Link
              href={item.href}
              className="group flex min-h-11 items-center gap-3 text-sm text-[var(--is-text)] hover:text-[var(--is-accent)] sm:text-base"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-[var(--is-accent)]"
              />
              <span className="underline-offset-2 group-hover:underline">
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Manual operativo in-app: publicar una historia según origen.
 * Misma fuente de verdad para Redacción y Dirección.
 */
export function EditorialPublishManual({
  audience = "both",
  initialOrigin = "web-intake",
  showChromeHeader = true,
}: Props) {
  const origins = PUBLISH_MANUAL.origins;
  const validInitial = origins.some((o) => o.id === initialOrigin)
    ? initialOrigin
    : origins[0]!.id;
  const [activeId, setActiveId] = useState<ManualOriginId>(validInitial);

  const active = useMemo(
    () => origins.find((o) => o.id === activeId) ?? origins[0]!,
    [activeId, origins],
  );

  const showRedactor = audience === "redactor" || audience === "both";
  const showDirector = audience === "director" || audience === "both";

  return (
    <div className="space-y-12">
      {showChromeHeader ? (
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
            {PUBLISH_MANUAL.eyebrow}
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-source-serif)] text-[clamp(1.85rem,1.4rem+1.6vw,2.75rem)] font-semibold leading-tight tracking-tight text-[var(--is-text)]">
            {PUBLISH_MANUAL.title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--is-text-secondary)]">
            {PUBLISH_MANUAL.dek}
          </p>
          <div className="mt-6">
            <Link
              href={PUBLISH_MANUAL.createCta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)]"
            >
              {PUBLISH_MANUAL.createCta.label}
            </Link>
          </div>
        </header>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Link
            href={PUBLISH_MANUAL.createCta.href}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)]"
          >
            {PUBLISH_MANUAL.createCta.label}
          </Link>
        </div>
      )}

      {/* Intro */}
      <section
        aria-labelledby="manual-intro"
        className="space-y-6 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white p-6 sm:p-8"
      >
        <h2
          id="manual-intro"
          className="font-[family-name:var(--font-source-serif)] text-xl font-semibold tracking-tight"
        >
          Antes de empezar
        </h2>
        <p className="text-sm leading-relaxed text-[var(--is-text)] sm:text-base">
          {PUBLISH_MANUAL.intro.whatIs}
        </p>
        <p className="text-sm leading-relaxed text-[var(--is-text-secondary)] sm:text-base">
          {PUBLISH_MANUAL.intro.eventVsNote}
        </p>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--is-muted)]">
            {PUBLISH_MANUAL.intro.statesLabel}
          </p>
          <ol className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--is-text)]">
            {PUBLISH_MANUAL.intro.states.map((state, i) => (
              <li key={state.id} className="flex items-center gap-2">
                {i > 0 ? (
                  <span aria-hidden className="text-[var(--is-muted)]">
                    →
                  </span>
                ) : null}
                <span className="rounded-full border border-[var(--is-border)] bg-[var(--is-bg-secondary)] px-3 py-1">
                  {state.label}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-[var(--is-muted)]">
            {PUBLISH_MANUAL.intro.statesExtra}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--is-muted)]">
            {PUBLISH_MANUAL.intro.checklistTitle}
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {PUBLISH_MANUAL.intro.checklist.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm text-[var(--is-text)]"
              >
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--is-accent)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Callout */}
      <aside
        role="note"
        className="rounded-[var(--is-radius-md)] border border-[var(--is-orange-200)] bg-[var(--is-orange-50)] px-5 py-5 sm:px-6"
      >
        <p className="text-sm font-semibold text-[var(--is-orange-900)]">
          {PUBLISH_MANUAL.warning.title}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--is-orange-900)]">
          {PUBLISH_MANUAL.warning.body}{" "}
          <Link
            href={PUBLISH_MANUAL.warning.href}
            className="font-semibold underline underline-offset-2"
          >
            {PUBLISH_MANUAL.warning.hrefLabel}
          </Link>
        </p>
      </aside>

      {/* Orígenes */}
      <section aria-labelledby="manual-origenes" className="space-y-6">
        <h2
          id="manual-origenes"
          className="font-[family-name:var(--font-source-serif)] text-xl font-semibold tracking-tight sm:text-2xl"
        >
          {PUBLISH_MANUAL.originsTitle}
        </h2>

        <div
          role="tablist"
          aria-label="Origen de la nota"
          className="flex flex-wrap gap-2"
        >
          {origins.map((origin) => {
            const selected = origin.id === active.id;
            return (
              <button
                key={origin.id}
                type="button"
                role="tab"
                id={`tab-${origin.id}`}
                aria-selected={selected}
                aria-controls={`panel-${origin.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveId(origin.id)}
                className={[
                  "inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] px-4 text-sm font-semibold transition-colors",
                  selected
                    ? "bg-[var(--is-accent)] text-white"
                    : "border border-[var(--is-border-strong)] bg-white text-[var(--is-text)] hover:border-[var(--is-accent)] hover:text-[var(--is-accent)]",
                ].join(" ")}
              >
                <span className="sm:hidden">{origin.short}</span>
                <span className="hidden sm:inline">{origin.title}</span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`panel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
          className="space-y-6 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white p-6 sm:p-8"
        >
          <div className="max-w-2xl">
            <h3 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
              {active.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--is-muted)] sm:text-base">
              {active.summary}
            </p>
          </div>
          <StepList steps={active.steps} />
        </div>
      </section>

      {/* Paso común */}
      <section
        aria-labelledby="manual-comun"
        className="space-y-6 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white p-6 sm:p-8"
      >
        <h2
          id="manual-comun"
          className="font-[family-name:var(--font-source-serif)] text-xl font-semibold tracking-tight sm:text-2xl"
        >
          {PUBLISH_MANUAL.commonTitle}
        </h2>
        <StepList steps={PUBLISH_MANUAL.commonSteps} />
      </section>

      {/* Por rol */}
      <div
        className={[
          "grid gap-6",
          showRedactor && showDirector ? "lg:grid-cols-2" : "",
        ].join(" ")}
      >
        {showRedactor ? (
          <RoleChecklist
            title={PUBLISH_MANUAL.redactorTitle}
            items={PUBLISH_MANUAL.redactorChecklist}
          />
        ) : null}
        {showDirector ? (
          <RoleChecklist
            title={PUBLISH_MANUAL.directorTitle}
            items={PUBLISH_MANUAL.directorChecklist}
          />
        ) : null}
      </div>

      <p className="max-w-2xl text-xs leading-relaxed text-[var(--is-muted)]">
        {PUBLISH_MANUAL.footnote}
      </p>
    </div>
  );
}
