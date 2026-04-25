"use client";

import type { LucideIcon } from "lucide-react";

/** Badge sobrio alineado con Fotorank (dorado / neutro / estado). */
export function PrBadge({
  children,
  tone = "muted",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "gold" | "muted" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneCls =
    tone === "gold"
      ? "border-gold/35 bg-gold/10 text-gold"
      : tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
        : tone === "warning"
          ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
          : tone === "danger"
            ? "border-red-500/30 bg-red-500/10 text-red-200"
            : "border-fr-border bg-fr-bg-elevated text-fr-muted";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${toneCls} ${className}`.trim()}>
      {children}
    </span>
  );
}

export function StatMiniCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="fr-recuadro flex min-w-0 flex-col gap-2 rounded-xl border border-fr-border bg-fr-card/90 transition-colors hover:border-fr-border-muted">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-fr-border bg-fr-bg text-gold">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fr-muted">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight text-fr-primary">{value}</p>
          {hint ? <p className="mt-1 text-xs leading-relaxed text-fr-muted">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-3">
      <h3 className="font-sans text-lg font-semibold tracking-tight text-fr-primary md:text-xl">{title}</h3>
      <p className="max-w-3xl text-sm leading-relaxed text-fr-muted">{description}</p>
    </div>
  );
}

export function EmptyStateBlock({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="fr-recuadro flex flex-col items-center rounded-xl border border-dashed border-fr-border-muted bg-fr-bg/50 px-6 py-12 text-center transition-colors hover:border-fr-border">
      <span className="flex size-14 items-center justify-center rounded-full border border-fr-border bg-fr-card text-gold/80">
        <Icon className="size-7" aria-hidden />
      </span>
      <h4 className="mt-6 font-sans text-lg font-semibold text-fr-primary">{title}</h4>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-fr-muted">{description}</p>
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}

export function FieldGroup({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border border-fr-border/80 bg-fr-bg/40 p-6 md:p-8">
      <div>
        <h4 className="text-base font-semibold text-fr-primary">{title}</h4>
        {hint ? <p className="mt-2 text-sm leading-relaxed text-fr-muted">{hint}</p> : null}
      </div>
      <div className="space-y-8">{children}</div>
    </div>
  );
}

export function HelperLine({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-fr-muted">{children}</p>;
}
