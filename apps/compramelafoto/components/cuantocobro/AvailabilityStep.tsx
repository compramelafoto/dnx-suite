"use client";

import Input from "@/components/ui/Input";
import { DsField } from "@/components/ui/DsField";
import {
  computeMonthlyAvailableHours,
  computeMonthlyBillableHours,
  getCategoryWeeklyHours,
  getDisplayPercentForCategoryHours,
  getTimeDistributionHoursGap,
  PHOTOGRAPHY_TIME_DISTRIBUTION_KEYS,
  PHOTOGRAPHY_TIME_DISTRIBUTION_LABELS,
  setTimeDistributionWeeklyHours,
  sumDistributionWeeklyHours,
} from "@/lib/cuantocobro/availability";
import { CUANTO_COBRO_WEEKS_PER_MONTH } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import { parseCuantoCobroAmount } from "@/lib/cuantocobro/amount-format";
import type { CuantoCobroProfileInput, PhotographyTimeDistribution } from "@/lib/cuantocobro/types";
import { cn } from "@/lib/utils";

type Props = {
  profile: CuantoCobroProfileInput;
  onProfileChange: <K extends keyof CuantoCobroProfileInput>(
    key: K,
    value: CuantoCobroProfileInput[K],
  ) => void;
};

function formatHours(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return String(Math.round(value));
}

export default function AvailabilityStep({ profile, onProfileChange }: Props) {
  const weeklyHours = Math.round(parseCuantoCobroAmount(profile.weeklyHours) ?? 0);
  const monthlyHours = computeMonthlyAvailableHours(profile.weeklyHours);
  const monthlyBillableHours = computeMonthlyBillableHours(profile.weeklyHours, profile.timeDistribution);
  const assignedWeeklyHours = sumDistributionWeeklyHours(weeklyHours, profile.timeDistribution);
  const { remaining, overflow } = getTimeDistributionHoursGap(weeklyHours, profile.timeDistribution);
  const isDistributionValid = weeklyHours > 0 && assignedWeeklyHours === weeklyHours;
  const distributionDisabled = weeklyHours <= 0;

  const updateCategoryHours = (key: keyof PhotographyTimeDistribution, hours: number) => {
    onProfileChange(
      "timeDistribution",
      setTimeDistributionWeeklyHours(profile.timeDistribution, key, hours, weeklyHours),
    );
  };

  return (
    <div className="cc-availability-step ds-stack-section">
      <div className="cc-availability-education">
        <h4 className="cc-availability-education__title">¿Por qué preguntamos esto?</h4>
        <p className="cc-availability-education__body m-0">
          Muchos fotógrafos calculan sus precios dividiendo sus gastos por todas las horas que trabajan. Sin embargo,
          gran parte de ese tiempo se dedica a tareas que el cliente no ve: edición, administración, presupuestos,
          marketing y capacitación.
        </p>
        <p className="cc-availability-education__body m-0 mt-2">
          Para que el cálculo sea realista, necesitamos identificar cuántas horas de tu mes terminan convirtiéndose en
          trabajos facturados.
        </p>
      </div>

      <section className="cc-availability-section" aria-labelledby="cc-availability-section-total">
        <h4 id="cc-availability-section-total" className="cc-availability-section__title">
          Disponibilidad semanal total
        </h4>
        <DsField
          label="¿Cuántas horas por semana podés dedicar a tu actividad fotográfica?"
          htmlFor="cc-weekly-hours"
          hint="Incluí todo el tiempo que dedicás a la fotografía, no solamente cuando estás sacando fotos."
        >
          <Input
            id="cc-weekly-hours"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Ej: 48"
            value={profile.weeklyHours}
            onChange={(e) => onProfileChange("weeklyHours", e.target.value)}
          />
        </DsField>
      </section>

      <section className="cc-availability-section" aria-labelledby="cc-availability-section-distribution">
        <h4 id="cc-availability-section-distribution" className="cc-availability-section__title">
          ¿Cómo se distribuye tu tiempo?
        </h4>
        <p className="cc-availability-section__description m-0">
          Mové cada control para asignar horas enteras por tarea. El porcentaje se calcula solo en base a tu total
          semanal.
        </p>

        {distributionDisabled ? (
          <div className="ds-info-panel cc-info-panel--accent mt-3" role="status">
            <p className="ds-info-panel__body m-0 text-sm">
              Primero ingresá tus horas semanales totales para distribuir el tiempo.
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "cc-availability-distribution-total",
              isDistributionValid ? "cc-availability-distribution-total--valid" : "cc-availability-distribution-total--invalid",
            )}
            role="status"
            aria-live="polite"
          >
            <span>Total asignado</span>
            <strong>
              {assignedWeeklyHours} h / {weeklyHours} h
            </strong>
            <span className="cc-availability-distribution-total__hint">
              {isDistributionValid
                ? "OK — cubrís el 100% de tus horas"
                : overflow > 0
                  ? `Te pasaste por ${overflow} h (debe sumar ${weeklyHours} h)`
                  : `Te faltan ${remaining} h por asignar (debe sumar ${weeklyHours} h)`}
            </span>
          </div>
        )}

        <ul className={cn("cc-availability-distribution", distributionDisabled && "cc-availability-distribution--disabled")}>
          {PHOTOGRAPHY_TIME_DISTRIBUTION_KEYS.map((key) => {
            const categoryHours = getCategoryWeeklyHours(weeklyHours, profile.timeDistribution, key);
            const displayPercent = getDisplayPercentForCategoryHours(weeklyHours, categoryHours);
            const isBillable = key === "coverage";

            return (
              <li key={key} className="cc-availability-distribution__item">
                <div className="cc-availability-distribution__header">
                  <div className="cc-availability-distribution__label-block min-w-0">
                    <div className="cc-availability-distribution__label">
                      {PHOTOGRAPHY_TIME_DISTRIBUTION_LABELS[key]}
                      {isBillable ? (
                        <span className="cc-availability-distribution__billable-badge">Facturable</span>
                      ) : null}
                    </div>
                    <p className="cc-availability-distribution__weekly-hours m-0">
                      {weeklyHours > 0 ? `${categoryHours} h/semana` : "— h/semana"}
                    </p>
                  </div>
                  <div
                    className="cc-availability-distribution__percent"
                    aria-label={`${displayPercent} por ciento del tiempo semanal`}
                  >
                    {displayPercent}%
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={weeklyHours}
                  step={1}
                  value={categoryHours}
                  disabled={distributionDisabled}
                  className="cc-availability-distribution__slider"
                  aria-label={`Horas semanales en ${PHOTOGRAPHY_TIME_DISTRIBUTION_LABELS[key]}`}
                  aria-valuemin={0}
                  aria-valuemax={weeklyHours}
                  aria-valuenow={categoryHours}
                  onChange={(e) => updateCategoryHours(key, Number(e.target.value))}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="cc-availability-summary" aria-labelledby="cc-availability-summary-title">
        <h4 id="cc-availability-summary-title" className="cc-availability-summary__title">
          Resumen automático
        </h4>
        <dl className="cc-availability-summary__list">
          <div className="cc-availability-summary__row">
            <dt>Horas semanales totales</dt>
            <dd>{weeklyHours > 0 ? `${formatHours(weeklyHours)} h` : "—"}</dd>
          </div>
          <div className="cc-availability-summary__row">
            <dt>Horas mensuales</dt>
            <dd>{monthlyHours > 0 ? `${formatHours(monthlyHours)} h` : "—"}</dd>
          </div>
          <div className="cc-availability-summary__row cc-availability-summary__row--highlight">
            <dt>Horas potencialmente facturables</dt>
            <dd>{monthlyBillableHours > 0 ? `${formatHours(monthlyBillableHours)} h` : "—"}</dd>
          </div>
        </dl>
        <div className="cc-availability-summary__formulas">
          <p className="m-0">Horas mensuales = horas semanales × {CUANTO_COBRO_WEEKS_PER_MONTH}</p>
          <p className="m-0 mt-1">
            Horas facturables mensuales = horas mensuales × (coberturas fotográficas ÷ 100)
          </p>
        </div>
      </section>
    </div>
  );
}
