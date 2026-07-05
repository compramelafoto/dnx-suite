"use client";

import CuantoCobroPriceInput from "@/components/cuantocobro/CuantoCobroPriceInput";
import QuotePreview from "@/components/cuantocobro/QuotePreview";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import { DsField } from "@/components/ui/DsField";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { formatActuationCount } from "@/lib/cuantocobro/camera-equipment";
import { CC_COMMERCIAL_DISPLAY_MODE_LABELS } from "@/lib/cuantocobro/commercial-presentation";
import {
  formatCuantoCobroCurrency,
  formatCuantoCobroHours,
  type CuantoCobroCalculationResult,
} from "@/lib/cuantocobro/calculate-cuanto-cobro";
import {
  CC_BEGINNING_POSITIONING_PRICE_NOTE,
  CC_MINIMUM_RECOMMENDED_PRICE_TITLE,
  CC_MINIMUM_SUSTAINABLE_PRICE_EXPLANATION,
  CC_RECOMMENDED_BUSINESS_PRICE_EXPLANATION,
  CC_RESULT_WHY_RECOMMENDED_HIGHER_TEXT,
  CC_RESULT_WHY_RECOMMENDED_HIGHER_TITLE,
} from "@/lib/cuantocobro/commercial-positioning";
import FotoOfficeModal from "@/components/cuantocobro/FotoOfficeModal";
import { useCuantoCobroBusinessProfile } from "@/components/cuantocobro/BusinessProfileContext";
import {
  CC_FOTOOFFICE_INTEREST_CTA_HINT,
  CC_FOTOOFFICE_RESULT_CTA_PRIMARY,
  CC_FOTOOFFICE_RESULT_PROMO_TEXT,
  CC_FOTOOFFICE_RESULT_PROMO_TITLE,
} from "@/lib/cuantocobro/fotooffice-interest";
import {
  getChosenMarginStatusLabel,
  getChosenPriceCommercialMessage,
  getProfitabilityDiagnosisMessage,
} from "@/lib/cuantocobro/quote-profitability";
import type { CuantoCobroCommercialDisplayMode, CuantoCobroProfileInput, CuantoCobroQuoteInput } from "@/lib/cuantocobro/types";
import { useMemo, useState } from "react";

type Props = {
  calculation: CuantoCobroCalculationResult;
  profile: CuantoCobroProfileInput;
  quote: CuantoCobroQuoteInput;
  onQuoteChange: <K extends keyof CuantoCobroQuoteInput>(key: K, value: CuantoCobroQuoteInput[K]) => void;
};

function formatMarginRatio(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${(ratio * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

function formatServicesPerMonth(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatSignedCurrency(amount: number, fmt: (value: number) => string): string {
  if (amount === 0) return fmt(0);
  const prefix = amount > 0 ? "+" : "−";
  return `${prefix}${fmt(Math.abs(amount))}`;
}

function profitabilityPanelClass(status: "loss" | "tight" | "profitable" | "unknown"): string {
  switch (status) {
    case "loss":
      return "cc-result-diagnosis cc-result-diagnosis--loss";
    case "tight":
      return "cc-result-diagnosis cc-result-diagnosis--tight";
    case "profitable":
      return "cc-result-diagnosis cc-result-diagnosis--profitable";
    default:
      return "cc-result-diagnosis";
  }
}

function chosenCommercialPanelClass(
  status: "loss" | "below_recommended" | "at_or_above_recommended",
): string {
  switch (status) {
    case "loss":
      return "cc-result-diagnosis cc-result-diagnosis--loss";
    case "below_recommended":
      return "cc-result-diagnosis cc-result-diagnosis--tight";
    case "at_or_above_recommended":
      return "cc-result-diagnosis cc-result-diagnosis--profitable";
  }
}

function BusinessProfilePreviewLink() {
  const { openBusinessProfileModal } = useCuantoCobroBusinessProfile();

  return (
    <CuantoCobroButton
      type="button"
      variant="outline"

      className="min-h-[44px]"
      onClick={() => openBusinessProfileModal()}
    >
      Configurar perfil
    </CuantoCobroButton>
  );
}

export default function CuantoCobroWizardResult({ calculation, profile, quote, onQuoteChange }: Props) {
  const { profile: businessProfile } = useCuantoCobroBusinessProfile();
  const [fotoOfficeModalOpen, setFotoOfficeModalOpen] = useState(false);

  const fotoOfficeMetadata = useMemo(() => {
    if (calculation.status !== "complete") return {};
    return {
      minimumSustainablePrice: calculation.minimumSustainablePrice,
      recommendedBusinessPrice: calculation.recommendedBusinessPrice,
      commercialPositioningId: calculation.commercialPositioningId,
      commercialPositioningLabel: calculation.commercialPositioningLabel,
      jobType: quote.client.jobType.trim() || null,
      clientName: quote.client.name.trim() || null,
      currency: calculation.currency,
    };
  }, [calculation, quote.client.jobType, quote.client.name]);

  const availableBusinessEmail = businessProfile?.commercialEmail?.trim() || null;
  const availableBusinessName =
    [businessProfile?.photographerFirstName, businessProfile?.photographerLastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ") || businessProfile?.tradeName?.trim() || null;

  const fmt = (amount: number) =>
    formatCuantoCobroCurrency(amount, calculation.status === "complete" ? calculation.currency : profile.currency);

  if (calculation.status === "incomplete") {
    return (
      <div className="ds-info-panel cc-info-panel--warning" role="status">
        <p className="ds-info-panel__title m-0 font-medium normal-case tracking-normal text-sm">
          Completá los pasos anteriores para ver el resultado.
        </p>
        <ul className="ds-info-panel__body mt-2 mb-0 pl-5 list-disc space-y-1">
          {calculation.missingFields.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      </div>
    );
  }

  const clientSummary = calculation.clientSummary;
  const conceptSummary = calculation.quoteSummary;
  const diagnosisMessage = getProfitabilityDiagnosisMessage(calculation.profitabilityStatus);
  const chosenCommercialMessage = getChosenPriceCommercialMessage(calculation.chosenPriceCommercialStatus);
  const usingRecommendedByDefault = calculation.chosenManualPrice === null;
  const showBeginningPriceNote =
    calculation.commercialPositioningId === "starting" ||
    calculation.recommendedBusinessPrice === calculation.minimumSustainablePrice;

  const showWhyRecommendedHigher =
    calculation.recommendedBusinessPrice > calculation.minimumSustainablePrice;

  const handleUseRecommended = () => {
    onQuoteChange("chosenPrice", "");
  };

  return (
    <div className="cc-result-report">
      {calculation.warnings.length > 0 && (
        <div className="ds-stack-section">
          {calculation.warnings.map((warning) => (
            <div key={warning} className="ds-info-panel cc-info-panel--warning" role="status">
              <p className="ds-info-panel__body m-0">{warning}</p>
            </div>
          ))}
        </div>
      )}

      <section className="cc-result-pricing-hero" aria-labelledby="cc-result-pricing-hero-title">
        <h3 id="cc-result-pricing-hero-title" className="cc-result-section-title">
          Referencia de precios
        </h3>
        <p className="cc-result-block__hint m-0 mt-1 text-sm text-[var(--cc-color-muted)]">
          Mínimo sostenible y recomendado según tu perfil. Después elegís el precio comercial para este trabajo.
        </p>
        <div className="cc-result-price-cards">
          <article className="cc-result-price-card cc-result-price-card--minimum">
            <h4 className="cc-result-price-card__title m-0">{CC_MINIMUM_RECOMMENDED_PRICE_TITLE}</h4>
            <p className="cc-result-price-card__value m-0">{fmt(calculation.minimumSustainablePrice)}</p>
            <p className="cc-result-price-card__text m-0">{CC_MINIMUM_SUSTAINABLE_PRICE_EXPLANATION}</p>
          </article>
          <article className="cc-result-price-card cc-result-price-card--recommended">
            <h4 className="cc-result-price-card__title m-0">Precio recomendado para tu negocio</h4>
            <p className="cc-result-price-card__value m-0">{fmt(calculation.recommendedBusinessPrice)}</p>
            <p className="cc-result-price-card__text m-0">{CC_RECOMMENDED_BUSINESS_PRICE_EXPLANATION}</p>
            <p className="cc-result-price-card__based m-0">
              Basado en: <strong>{calculation.commercialPositioningLabel}</strong>
            </p>
            {showBeginningPriceNote ? (
              <p className="cc-result-price-card__note m-0">{CC_BEGINNING_POSITIONING_PRICE_NOTE}</p>
            ) : null}
          </article>
        </div>

        {showWhyRecommendedHigher ? (
          <details className="cc-result-pricing-explainer">
            <summary className="cc-result-pricing-explainer__summary">
              {CC_RESULT_WHY_RECOMMENDED_HIGHER_TITLE}
            </summary>
            <div className="cc-result-pricing-explainer__body">
              {CC_RESULT_WHY_RECOMMENDED_HIGHER_TEXT.split("\n\n").map((paragraph) => (
                <p key={paragraph} className="cc-result-pricing-explainer__text m-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <FotoOfficeModal
        open={fotoOfficeModalOpen}
        onClose={() => setFotoOfficeModalOpen(false)}
        metadata={fotoOfficeMetadata}
        availableEmail={availableBusinessEmail}
        availableName={availableBusinessName}
      />

      <section className="cc-result-report__section cc-result-report__section--commercial" aria-labelledby="cc-result-commercial">
        <h3 id="cc-result-commercial" className="cc-result-section-title">
          A) Precio comercial
        </h3>
        <p className="cc-result-block__hint m-0 mt-1 text-sm text-[var(--cc-color-muted)]">
          Definí el precio que vas a cobrar y cómo querés presentarlo. Esta parte es la que compartís con el cliente.
        </p>

        <div className="cc-result-chosen-price mt-4">
          <DsField
            label="Precio que voy a cobrar"
            htmlFor="cc-chosen-price"
            hint={
              usingRecommendedByDefault
                ? `Sin valor manual: se usa el recomendado (${fmt(calculation.recommendedBusinessPrice)}).`
                : "Precio manual para este trabajo."
            }
          >
            <div className="cc-result-chosen-price__controls">
              <CuantoCobroPriceInput
                id="cc-chosen-price"
                className="min-h-[44px]"
                placeholder={fmt(calculation.recommendedBusinessPrice)}
                value={quote.chosenPrice}
                onValueChange={(value) => onQuoteChange("chosenPrice", value)}
              />
              <CuantoCobroButton
                type="button"
                variant="secondary"

                className="cc-result-chosen-price__btn min-h-[44px] shrink-0"
                onClick={handleUseRecommended}
              >
                Usar recomendado
              </CuantoCobroButton>
            </div>
          </DsField>
          <div className="ds-info-panel cc-info-panel--accent mt-3" role="note">
            <p className="ds-info-panel__body m-0 text-sm">
              Este precio elegido es una decisión comercial. El sistema te muestra si ese valor cubre tus costos y
              cuánto se aleja del precio recomendado.
            </p>
          </div>
        </div>

        <div className="cc-result-commercial-presentation mt-4 ds-form-stack">
          <DsField
            label="Cómo querés presentar el presupuesto al cliente"
            htmlFor="cc-commercial-display-mode"
          >
            <Select
              id="cc-commercial-display-mode"
              className="min-h-[44px]"
              value={quote.commercialDisplayMode}
              onChange={(e) =>
                onQuoteChange(
                  "commercialDisplayMode",
                  e.target.value as CuantoCobroCommercialDisplayMode,
                )
              }
            >
              <option value="detailed">{CC_COMMERCIAL_DISPLAY_MODE_LABELS.detailed}</option>
              <option value="total-only">{CC_COMMERCIAL_DISPLAY_MODE_LABELS["total-only"]}</option>
              <option value="grouped">{CC_COMMERCIAL_DISPLAY_MODE_LABELS.grouped}</option>
            </Select>
          </DsField>

          <DsField
            label="Nota comercial para el cliente"
            htmlFor="cc-commercial-note"
            hint="Visible en la vista previa y al compartir el presupuesto."
          >
            <Textarea
              id="cc-commercial-note"
              rows={3}
              value={quote.commercialNote}
              onChange={(e) => onQuoteChange("commercialNote", e.target.value)}
              placeholder="Condiciones de validez, seña y reserva de fecha."
            />
          </DsField>
        </div>

        <dl className="cc-stat-grid mt-4">
          <div className="cc-stat-card cc-stat-card--highlight">
            <dt className="cc-stat-card__label">Precio que voy a cobrar</dt>
            <dd className="cc-stat-card__value cc-stat-card__value--lg">{fmt(calculation.chosenPriceEffective)}</dd>
            <p className="cc-stat-card__hint">
              {usingRecommendedByDefault ? "Igual al recomendado para tu negocio." : "Valor manual que verá el cliente."}
            </p>
          </div>
        </dl>
      </section>

      <section className="cc-result-report__section" aria-labelledby="cc-result-client-preview">
        <h3 id="cc-result-client-preview" className="cc-result-section-title">
          B) Vista para cliente
        </h3>
        <p className="cc-result-block__hint m-0 mt-1 text-sm text-[var(--cc-color-muted)]">
          Así verá el cliente tu presupuesto. No incluye costos internos ni diagnóstico de rentabilidad.
        </p>

        <div className="mt-4">
          <div className="cc-result-preview-toolbar mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-sm font-medium text-[var(--cc-color-dark)]">Vista previa del presupuesto</p>
            <BusinessProfilePreviewLink />
          </div>
          <QuotePreview quote={quote} calculation={calculation} />
        </div>
      </section>

      <section className="cc-result-report__section cc-result-block" aria-labelledby="cc-result-internal">
        <h3 id="cc-result-internal" className="cc-result-section-title">
          C) Hoja interna
        </h3>
        <p className="cc-result-block__hint m-0 mt-1 text-sm text-[var(--cc-color-muted)]">
          Solo para vos: desglose de horas, costos y recuperación mensual. El cliente no ve esta sección.
        </p>

        <h4 className="cc-result-subsection-title mt-4">Base mensual y tarifa</h4>
        <dl className="cc-stat-grid mt-2">
          <div className="cc-stat-card">
            <dt className="cc-stat-card__label">Necesidad mensual total</dt>
            <dd className="cc-stat-card__value">{fmt(calculation.monthlyNeed)}</dd>
          </div>
          <div className="cc-stat-card">
            <dt className="cc-stat-card__label">Horas mensuales totales</dt>
            <dd className="cc-stat-card__value">{formatCuantoCobroHours(calculation.monthlyAvailableHours)}</dd>
          </div>
          <div className="cc-stat-card cc-stat-card--highlight">
            <dt className="cc-stat-card__label">Costo Hora Hombre</dt>
            <dd className="cc-stat-card__value">{fmt(calculation.hourlyRate)}</dd>
            <p className="cc-stat-card__hint">Necesidad mensual ÷ horas mensuales totales.</p>
          </div>
        </dl>

        {calculation.equipmentSavings.totalMonthly > 0 ? (
          <>
            <h4 className="cc-result-subsection-title mt-4">Equipamiento en tu necesidad mensual</h4>
            <dl className="cc-stat-grid mt-2">
              <div className="cc-stat-card">
                <dt className="cc-stat-card__label">Renovación de equipo actual</dt>
                <dd className="cc-stat-card__value">{fmt(calculation.equipmentSavings.renewalMonthly)}</dd>
              </div>
              <div className="cc-stat-card">
                <dt className="cc-stat-card__label">Ampliación (equipos deseados)</dt>
                <dd className="cc-stat-card__value">{fmt(calculation.equipmentSavings.expansionMonthly)}</dd>
              </div>
              <div className="cc-stat-card cc-stat-card--highlight">
                <dt className="cc-stat-card__label">Total equipamiento / mes</dt>
                <dd className="cc-stat-card__value">{fmt(calculation.equipmentSavings.totalMonthly)}</dd>
              </div>
            </dl>
          </>
        ) : null}

        <h4 className="cc-result-subsection-title mt-4">Costos del trabajo</h4>
        <dl className="cc-stat-grid mt-2">
          <div className="cc-stat-card">
            <dt className="cc-stat-card__label">Costo del cliente</dt>
            <dd className="cc-stat-card__value">{fmt(clientSummary.laborCost)}</dd>
            <p className="cc-stat-card__hint">
              {formatCuantoCobroHours(clientSummary.totalHours)} de horas generales.
            </p>
          </div>
          <div className="cc-stat-card">
            <dt className="cc-stat-card__label">Costo de productos y servicios</dt>
            <dd className="cc-stat-card__value">{fmt(conceptSummary.totalLaborCost)}</dd>
            <p className="cc-stat-card__hint">
              {formatCuantoCobroHours(conceptSummary.totalOwnHours)} de horas propias en productos y servicios.
            </p>
          </div>
          <div className="cc-stat-card">
            <dt className="cc-stat-card__label">Total horas comprometidas</dt>
            <dd className="cc-stat-card__value">{formatCuantoCobroHours(calculation.totalJobHours)}</dd>
          </div>
          <div className="cc-stat-card">
            <dt className="cc-stat-card__label">Costos directos</dt>
            <dd className="cc-stat-card__value">{fmt(calculation.variableCosts)}</dd>
            <p className="cc-stat-card__hint">Materiales, terceros, viáticos y desgaste sumado al precio.</p>
          </div>
          <div className="cc-stat-card">
            <dt className="cc-stat-card__label">Margen estimado (recomendado)</dt>
            <dd className="cc-stat-card__value">{fmt(calculation.estimatedMargin)}</dd>
            <p className="cc-stat-card__hint">
              Precio recomendado − precio mínimo ({formatMarginRatio(calculation.marginRatio)} sobre el mínimo).
            </p>
          </div>
        </dl>

        {clientSummary.lines.length > 0 ? (
          <>
            <h4 className="cc-result-subsection-title mt-4">Detalle horas del cliente</h4>
            <ul className="cc-breakdown-list mt-2">
              {clientSummary.lines.map((line) => (
                <li key={line.field} className="cc-breakdown-item">
                  <div className="min-w-0">
                    <p className="cc-breakdown-item__label m-0">{line.label}</p>
                    <p className="cc-breakdown-item__meta m-0 text-sm text-[var(--cc-color-muted)]">
                      {formatCuantoCobroHours(line.hours)} × {fmt(line.rate)}/h
                    </p>
                  </div>
                  <p className="cc-breakdown-item__value">{fmt(line.laborCost)}</p>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {calculation.cameraWear || calculation.cameraWearSummary.totalJobShots > 0 ? (
          <>
            <h4 className="cc-result-subsection-title mt-4">Desgaste de cámara</h4>
            <dl className="cc-stat-grid mt-2">
              <div className="cc-stat-card">
                <dt className="cc-stat-card__label">Modo usado</dt>
                <dd className="cc-stat-card__value text-base">
                  {calculation.cameraWearSummary.mode === "structural" ? "Estructural (perfil)" : "Por trabajo"}
                </dd>
              </div>
              {calculation.cameraWearSummary.totalCameraWearInformative > 0 ? (
                <div className="cc-stat-card">
                  <dt className="cc-stat-card__label">Desgaste informativo</dt>
                  <dd className="cc-stat-card__value">{fmt(calculation.cameraWearSummary.totalCameraWearInformative)}</dd>
                </div>
              ) : null}
              {calculation.cameraWearSummary.totalCameraWearCharged > 0 ? (
                <div className="cc-stat-card cc-stat-card--highlight">
                  <dt className="cc-stat-card__label">Desgaste sumado al precio</dt>
                  <dd className="cc-stat-card__value">{fmt(calculation.cameraWearSummary.totalCameraWearCharged)}</dd>
                </div>
              ) : null}
              {calculation.cameraWearSummary.totalJobShots > 0 ? (
                <div className="cc-stat-card">
                  <dt className="cc-stat-card__label">Disparos estimados</dt>
                  <dd className="cc-stat-card__value">
                    {formatActuationCount(calculation.cameraWearSummary.totalJobShots)}
                  </dd>
                </div>
              ) : null}
              {calculation.cameraWearSummary.costPerShot !== null ? (
                <div className="cc-stat-card">
                  <dt className="cc-stat-card__label">Costo por disparo</dt>
                  <dd className="cc-stat-card__value">{fmt(calculation.cameraWearSummary.costPerShot)}</dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : null}

        <h4 className="cc-result-subsection-title mt-4">Recuperación mensual del tiempo</h4>
        <dl className="cc-stat-grid mt-2">
          <div className="cc-stat-card">
            <dt className="cc-stat-card__label">Recuperación por este trabajo</dt>
            <dd className="cc-stat-card__value">{fmt(calculation.monthlyRecoveryFromJob)}</dd>
            <p className="cc-stat-card__hint">Costo laboral del cliente + costo laboral de productos y servicios.</p>
          </div>
          <div className="cc-stat-card cc-stat-card--highlight">
            <dt className="cc-stat-card__label">Trabajos similares necesarios / mes</dt>
            <dd className="cc-stat-card__value">{formatServicesPerMonth(calculation.servicesNeededPerMonth)}</dd>
          </div>
        </dl>
        <div className="ds-info-panel cc-info-panel--accent mt-3" role="note">
          <p className="ds-info-panel__body m-0 text-sm">
            Esta métrica indica cuántos trabajos similares necesitás realizar por mes para cubrir tu necesidad
            mensual, considerando únicamente la recuperación de tu tiempo de trabajo.
          </p>
        </div>
      </section>

      <section
        className={`cc-result-report__section ${profitabilityPanelClass(calculation.profitabilityStatus)}`}
        aria-labelledby="cc-result-diagnosis"
      >
        <h3 id="cc-result-diagnosis" className="cc-result-section-title">
          D) Diagnóstico
        </h3>
        <p className="cc-result-block__hint m-0 mt-1 text-sm text-[var(--cc-color-muted)]">
          Solo para vos: rentabilidad del precio recomendado y del precio que elegiste cobrar.
        </p>
        <p className="cc-result-diagnosis__message m-0 mt-2">{diagnosisMessage}</p>
        <dl className="cc-stat-grid mt-3">
          <div className="cc-stat-card">
            <dt className="cc-stat-card__label">Estado</dt>
            <dd className="cc-stat-card__value text-base">
              {calculation.profitabilityStatus === "loss"
                ? "Pérdida"
                : calculation.profitabilityStatus === "tight"
                  ? "Muy ajustado"
                  : calculation.profitabilityStatus === "profitable"
                    ? "Rentable"
                    : "Sin datos"}
            </dd>
          </div>
          <div className="cc-stat-card">
            <dt className="cc-stat-card__label">Margen sobre el mínimo</dt>
            <dd className="cc-stat-card__value">{formatMarginRatio(calculation.marginRatio)}</dd>
          </div>
          <div className="cc-stat-card">
            <dt className="cc-stat-card__label">Costo base vs sostenible</dt>
            <dd className="cc-stat-card__value text-base">
              {fmt(calculation.minimumPrice)} → {fmt(calculation.minimumSustainablePrice)}
            </dd>
            <p className="cc-stat-card__hint">Base sin margen por ítem y mínimo recomendado del presupuesto.</p>
          </div>
          <div className="cc-stat-card">
            <dt className="cc-stat-card__label">Recomendado comercial</dt>
            <dd className="cc-stat-card__value text-base">
              {fmt(calculation.minimumSustainablePrice)} → {fmt(calculation.recommendedBusinessPrice)}
            </dd>
          </div>
        </dl>
        <div
          className={`cc-result-report__subsection mt-4 ${chosenCommercialPanelClass(calculation.chosenPriceCommercialStatus)}`}
        >
          <h4 className="cc-result-subsection-title m-0">Comparación del precio que vas a cobrar</h4>
          <p className="cc-result-diagnosis__message m-0 mt-2">{chosenCommercialMessage}</p>
          <dl className="cc-stat-grid mt-3">
            <div className="cc-stat-card">
              <dt className="cc-stat-card__label">Diferencia vs recomendado</dt>
              <dd className="cc-stat-card__value">
                {formatSignedCurrency(calculation.chosenPriceDeltaFromRecommended, fmt)}
              </dd>
            </div>
            <div className="cc-stat-card">
              <dt className="cc-stat-card__label">Margen real con precio elegido</dt>
              <dd className="cc-stat-card__value">{fmt(calculation.chosenMargin)}</dd>
              <p className="cc-stat-card__hint">{formatMarginRatio(calculation.chosenMarginRatio)} sobre el mínimo.</p>
            </div>
            <div className="cc-stat-card">
              <dt className="cc-stat-card__label">Estado del margen</dt>
              <dd className="cc-stat-card__value text-base">
                {getChosenMarginStatusLabel(calculation.chosenMarginStatus)}
              </dd>
            </div>
            <div className="cc-stat-card">
              <dt className="cc-stat-card__label">Trabajos similares / mes (tiempo)</dt>
              <dd className="cc-stat-card__value">
                {formatServicesPerMonth(calculation.servicesNeededPerMonthByChosenPrice)}
              </dd>
              <p className="cc-stat-card__hint">Según recuperación de tu tiempo de trabajo.</p>
            </div>
            <div className="cc-stat-card">
              <dt className="cc-stat-card__label">Trabajos / mes (aprox. bruto)</dt>
              <dd className="cc-stat-card__value">
                {formatServicesPerMonth(calculation.grossServicesNeededPerMonth)}
              </dd>
              <p className="cc-stat-card__hint">
                Aproximación: necesidad mensual ÷ precio elegido. Incluye costos directos y margen.
              </p>
            </div>
          </dl>
        </div>
      </section>

      <details className="cc-result-fotooffice-promo cc-result-fotooffice-promo--collapsed">
        <summary className="cc-result-fotooffice-promo__summary">{CC_FOTOOFFICE_RESULT_PROMO_TITLE}</summary>
        <div className="cc-result-fotooffice-promo__body">
          <p className="cc-result-fotooffice-promo__text m-0">{CC_FOTOOFFICE_RESULT_PROMO_TEXT}</p>
          <div className="cc-result-fotooffice-promo__actions">
            <CuantoCobroButton
              type="button"
              variant="outline"
              multiline
              className="min-h-[44px] w-full sm:w-auto"
              onClick={() => setFotoOfficeModalOpen(true)}
            >
              {CC_FOTOOFFICE_RESULT_CTA_PRIMARY}
            </CuantoCobroButton>
          </div>
          <p className="cc-result-fotooffice-promo__hint m-0">{CC_FOTOOFFICE_INTEREST_CTA_HINT}</p>
        </div>
      </details>
    </div>
  );
}
