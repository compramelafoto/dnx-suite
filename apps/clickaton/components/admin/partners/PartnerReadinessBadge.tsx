import type { PartnerSponsorReadiness } from "@repo/partners";

type Props = {
  readiness: PartnerSponsorReadiness;
};

/**
 * Insignia compacta: verde (listo) / amarillo (parcial) / rojo (faltan datos vitales).
 */
export function PartnerReadinessBadge({ readiness }: Props) {
  const { level, label, shortLabel } = readiness;

  if (level === "ready") {
    return (
      <span
        title={label}
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200"
      >
        <span
          aria-hidden
          className="inline-flex size-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-ck-bg"
        >
          ✓
        </span>
        {shortLabel}
      </span>
    );
  }

  if (level === "partial") {
    return (
      <span
        title={label}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-100"
      >
        <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-amber-400" />
        {shortLabel}
      </span>
    );
  }

  return (
    <span
      title={label}
      className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-200"
    >
      <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-red-500" />
      {shortLabel}
    </span>
  );
}
