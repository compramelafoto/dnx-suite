import { buildFeeBreakdown } from "@/lib/platform-fee/breakdown";

/**
 * Desglose de lo que se lleva la plataforma sobre un precio que el dueño está escribiendo.
 *
 * Envoltorio de presentación: toda la lógica y el texto viven en `buildFeeBreakdown`, que
 * es la fuente única y está probada. Acá no se arma ninguna frase.
 */
export function PlatformFeeBreakdown({
  amountArs,
  feeBps,
}: {
  amountArs: string | number;
  feeBps: number;
}) {
  const breakdown = buildFeeBreakdown(amountArs, feeBps);
  if (!breakdown) return null;

  return (
    <div className="text-xs text-[var(--fo-muted)] leading-relaxed space-y-0.5">
      {breakdown.feeLine ? <p>{breakdown.feeLine}</p> : null}
      <p>{breakdown.netLine}</p>
      <p>{breakdown.warningLine}</p>
    </div>
  );
}
