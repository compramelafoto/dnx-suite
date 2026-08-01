import { formatExperiencePrice } from "./format-experience-price";

type Props = {
  nowMinor: number;
  beforeMinor?: number | null;
  savingsMinor?: number | null;
  size?: "card" | "compact";
};

/** Jerarquía Antes / Ahora / Ahorro cuando hay promoción. */
export function RegistrationPromoPrice({
  nowMinor,
  beforeMinor,
  savingsMinor,
  size = "card",
}: Props) {
  const hasPromo =
    beforeMinor != null && beforeMinor > nowMinor && (savingsMinor == null || savingsMinor > 0);
  const big = size === "card" ? "text-4xl md:text-5xl" : "text-3xl";

  if (!hasPromo) {
    return (
      <p className={`mt-4 font-sans font-semibold tracking-tight text-ck-yellow ${big}`}>
        {formatExperiencePrice(nowMinor)}
      </p>
    );
  }

  const save = savingsMinor ?? beforeMinor - nowMinor;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ck-text-muted">Antes</p>
          <p className="mt-1 text-lg text-ck-text-muted line-through decoration-2 md:text-xl">
            {formatExperiencePrice(beforeMinor)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ck-yellow">Ahora</p>
          <p className={`mt-1 font-sans font-semibold tracking-tight text-ck-yellow ${big}`}>
            {formatExperiencePrice(nowMinor)}
          </p>
        </div>
      </div>
      <p className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">
        Ahorro {formatExperiencePrice(save)}
      </p>
    </div>
  );
}
