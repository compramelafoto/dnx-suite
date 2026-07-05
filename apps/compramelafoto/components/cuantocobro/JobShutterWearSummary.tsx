"use client";

import { analyzeCameraWear, formatActuationCount } from "@/lib/cuantocobro/camera-equipment";
import { formatCuantoCobroCurrency } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import type { CuantoCobroProfileInput, CuantoCobroQuoteInput } from "@/lib/cuantocobro/types";

type Props = {
  profile: CuantoCobroProfileInput;
  quote: CuantoCobroQuoteInput;
};

export default function JobShutterWearSummary({ profile, quote }: Props) {
  const wear = analyzeCameraWear(profile, quote);
  if (!wear.isConfigured || wear.jobShots <= 0) return null;

  const fmt = (amount: number) => formatCuantoCobroCurrency(amount, profile.currency || "ARS");

  return (
    <div className="cc-camera-wear__summary cc-camera-wear__summary--job" role="status">
      <h5 className="cc-camera-wear__summary-title m-0">Desgaste de este trabajo en el obturador</h5>
      <dl className="cc-camera-wear__summary-list">
        <div className="cc-camera-wear__summary-row">
          <dt>Disparos estimados del trabajo</dt>
          <dd>{formatActuationCount(wear.jobShots)}</dd>
        </div>
        {wear.jobWearPercentOfRating !== null ? (
          <div className="cc-camera-wear__summary-row">
            <dt>Sobre la vida útil total</dt>
            <dd>{wear.jobWearPercentOfRating}%</dd>
          </div>
        ) : null}
        {wear.jobWearPercentOfRemaining !== null ? (
          <div className="cc-camera-wear__summary-row cc-camera-wear__summary-row--highlight">
            <dt>Sobre los disparos restantes</dt>
            <dd>{wear.jobWearPercentOfRemaining}%</dd>
          </div>
        ) : null}
        {wear.jobWearCostInformative !== null ? (
          <div className="cc-camera-wear__summary-row">
            <dt>Costo de desgaste (referencia)</dt>
            <dd>{fmt(wear.jobWearCostInformative)}</dd>
          </div>
        ) : null}
      </dl>
      {wear.depreciationMode === "structural" ? (
        <p className="cc-camera-wear__formula m-0 mt-2 text-sm text-[var(--cc-color-muted)]">
          Modo estructural: no se suma al precio (ya está en tu aporte mensual de renovación).
        </p>
      ) : wear.jobWearCostCharged !== null && wear.jobWearCostCharged > 0 ? (
        <p className="cc-camera-wear__formula m-0 mt-2 text-sm text-[var(--cc-color-muted)]">
          Modo por trabajo: este desgaste se sumará al costo de los productos o servicios con disparos estimados.
        </p>
      ) : null}
      <p className="cc-camera-wear__formula m-0">
        Desgaste del trabajo = disparos del trabajo × costo por disparo
      </p>
    </div>
  );
}
