"use client";

import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import { DsField } from "@/components/ui/DsField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { formatCuantoCobroCurrency } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import {
  fetchEconomicIndexSuggestion,
  economicIndexMetadataFromApiResponse,
  type EconomicIndexApiResponse,
} from "@/lib/cuantocobro/economic-data/economic-index-api-client";
import {
  AR_UNAVAILABLE_MESSAGE,
  buildCashOptionSnapshot,
  buildInstallmentPlanSnapshot,
  buildPaymentOptionsSnapshot,
  createEmptyInstallmentPlan,
  resolveDefaultEconomicIndexType,
  resolvePhotographerCountryCode,
  type CuantoCobroInstallmentInterestMode,
  type CuantoCobroInstallmentPlanInput,
  type CuantoCobroPaymentOptionsInput,
} from "@/lib/cuantocobro/payment";
import type { CuantoCobroCalculationComplete } from "@/lib/cuantocobro/types";
import { useMemo, useState } from "react";

type Props = {
  calculation: CuantoCobroCalculationComplete;
  paymentOptions: CuantoCobroPaymentOptionsInput;
  businessCountry?: string | null;
  showHeading?: boolean;
  onPaymentOptionsChange: (next: CuantoCobroPaymentOptionsInput) => void;
};

const INTEREST_MODE_LABELS: Record<CuantoCobroInstallmentInterestMode, string> = {
  none: "Sin interés",
  manual: "Interés manual",
  index_suggested: "Interés sugerido por índice",
};

function formatIndexDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function updatePlan(
  plans: CuantoCobroInstallmentPlanInput[],
  planId: string,
  patch: Partial<CuantoCobroInstallmentPlanInput>,
): CuantoCobroInstallmentPlanInput[] {
  return plans.map((plan) => (plan.id === planId ? { ...plan, ...patch } : plan));
}

export default function PaymentOptionsSection({
  calculation,
  paymentOptions,
  businessCountry,
  showHeading = true,
  onPaymentOptionsChange,
}: Props) {
  const countryCode = resolvePhotographerCountryCode({
    businessCountry,
    profileCurrency: calculation.currency,
  });
  const indexSupported = countryCode === "AR";
  const defaultIndexType = resolveDefaultEconomicIndexType(countryCode);

  const [fetchingPlanId, setFetchingPlanId] = useState<string | null>(null);
  const [fetchErrorByPlan, setFetchErrorByPlan] = useState<Record<string, string>>({});
  const [pendingIndexByPlan, setPendingIndexByPlan] = useState<Record<string, EconomicIndexApiResponse>>({});

  const basePrice = calculation.chosenPriceEffective;
  const fmt = (amount: number) => formatCuantoCobroCurrency(amount, calculation.currency);

  const liveSnapshot = useMemo(
    () =>
      buildPaymentOptionsSnapshot({
        basePrice,
        currency: calculation.currency,
        countryCode,
        paymentOptions,
      }),
    [basePrice, calculation.currency, countryCode, paymentOptions],
  );

  const cashPreview = buildCashOptionSnapshot(paymentOptions, basePrice);

  function patchOptions(patch: Partial<CuantoCobroPaymentOptionsInput>) {
    onPaymentOptionsChange({ ...paymentOptions, ...patch });
  }

  function addPlan() {
    patchOptions({
      installmentPlans: [...paymentOptions.installmentPlans, createEmptyInstallmentPlan()],
    });
  }

  function removePlan(planId: string) {
    patchOptions({
      installmentPlans: paymentOptions.installmentPlans.filter((plan) => plan.id !== planId),
    });
    setFetchErrorByPlan((prev) => {
      const next = { ...prev };
      delete next[planId];
      return next;
    });
    setPendingIndexByPlan((prev) => {
      const next = { ...prev };
      delete next[planId];
      return next;
    });
  }

  async function handleFetchSuggestedRate(planId: string) {
    setFetchingPlanId(planId);
    setFetchErrorByPlan((prev) => ({ ...prev, [planId]: "" }));

    try {
      const result = await fetchEconomicIndexSuggestion(countryCode, defaultIndexType);
      if (!result.available || result.suggestedAnnualRate == null) {
        setFetchErrorByPlan((prev) => ({
          ...prev,
          [planId]: result.message ?? "No se pudo obtener una tasa sugerida. Podés cargar la tasa manualmente.",
        }));
        setPendingIndexByPlan((prev) => {
          const next = { ...prev };
          delete next[planId];
          return next;
        });
        return;
      }

      setPendingIndexByPlan((prev) => ({ ...prev, [planId]: result }));
      setFetchErrorByPlan((prev) => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
    } catch (error) {
      setFetchErrorByPlan((prev) => ({
        ...prev,
        [planId]:
          error instanceof Error
            ? error.message
            : "No se pudo consultar el índice. Podés cargar la tasa manualmente.",
      }));
    } finally {
      setFetchingPlanId(null);
    }
  }

  function handleApplySuggestedRate(planId: string) {
    const pending = pendingIndexByPlan[planId];
    if (!pending?.suggestedAnnualRate) return;

    const metadata = economicIndexMetadataFromApiResponse(pending);
    patchOptions({
      installmentPlans: updatePlan(paymentOptions.installmentPlans, planId, {
        interestMode: "index_suggested",
        interestPercent: String(pending.suggestedAnnualRate),
        appliedIndexMetadata: metadata,
      }),
    });
    setPendingIndexByPlan((prev) => {
      const next = { ...prev };
      delete next[planId];
      return next;
    });
  }

  return (
    <section className="cc-payment-options" aria-labelledby="cc-payment-options-title">
      {showHeading ? (
        <div className="cc-payment-options__head">
          <h3 id="cc-payment-options-title" className="cc-result-section-title m-0">
            Método de pago
          </h3>
          <p className="cc-result-block__hint m-0 mt-1 text-sm text-[var(--cc-color-muted)]">
            Capa comercial para mostrar al cliente. No modifica tu precio interno ni la rentabilidad del
            trabajo.
          </p>
        </div>
      ) : (
        <h3 id="cc-payment-options-title" className="sr-only">
          Financiación
        </h3>
      )}

      <div className={`cc-payment-options__base ds-info-panel cc-info-panel--accent${showHeading ? " mt-4" : ""}`} role="note">
        <p className="ds-info-panel__body m-0 text-sm">
          Precio base para formas de pago: <strong>{fmt(basePrice)}</strong>
        </p>
      </div>

      <article className="cc-payment-options__block mt-4">
        <div className="cc-payment-options__block-head">
          <label className="cc-payment-options__check min-h-[44px]">
            <input
              type="checkbox"
              checked={paymentOptions.cashEnabled}
              onChange={(e) => patchOptions({ cashEnabled: e.target.checked })}
            />
            <span>Ofrecer descuento por pago en 1 pago</span>
          </label>
        </div>

        {paymentOptions.cashEnabled ? (
          <div className="cc-payment-options__fields ds-form-stack mt-3">
            <DsField label="Porcentaje de descuento" htmlFor="cc-cash-discount">
              <Input
                id="cc-cash-discount"
                className="min-h-[44px]"
                inputMode="decimal"
                placeholder="Ej: 10"
                value={paymentOptions.cashDiscountPercent}
                onChange={(e) => patchOptions({ cashDiscountPercent: e.target.value })}
              />
            </DsField>
            <DsField label="Texto comercial opcional" htmlFor="cc-cash-note">
              <Textarea
                id="cc-cash-note"
                rows={2}
                value={paymentOptions.cashCommercialNote}
                onChange={(e) => patchOptions({ cashCommercialNote: e.target.value })}
                placeholder="Ej: 10% de descuento abonando en un solo pago."
              />
            </DsField>
            {cashPreview ? (
              <div className="cc-payment-options__preview-card">
                <p className="m-0 text-sm">
                  Precio recomendado: {fmt(basePrice)}
                  {cashPreview.discountPercent > 0 ? (
                    <>
                      {" "}
                      · Descuento 1 pago: {cashPreview.discountPercent}% · Total 1 pago:{" "}
                      <strong>{fmt(cashPreview.cashPrice)}</strong>
                    </>
                  ) : (
                    <>
                      {" "}
                      · Total 1 pago: <strong>{fmt(cashPreview.cashPrice)}</strong>
                    </>
                  )}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>

      <article className="cc-payment-options__block mt-4">
        <div className="cc-payment-options__block-head">
          <h4 className="cc-result-subsection-title m-0">Planes de cuotas</h4>
          <CuantoCobroButton type="button" variant="outline" className="min-h-[44px]" onClick={addPlan}>
            Agregar plan
          </CuantoCobroButton>
        </div>

        {!indexSupported ? (
          <div className="ds-info-panel cc-info-panel--warning mt-3" role="status">
            <p className="ds-info-panel__body m-0 text-sm">{AR_UNAVAILABLE_MESSAGE}</p>
          </div>
        ) : null}

        {paymentOptions.installmentPlans.length === 0 ? (
          <p className="cc-presupuestos-muted mt-3 m-0 text-sm">
            Todavía no agregaste planes de cuotas. Podés ofrecer varias alternativas (3, 6, 12, etc.).
          </p>
        ) : (
          <div className="cc-payment-options__plans mt-3">
            {paymentOptions.installmentPlans.map((plan, index) => {
              const preview = buildInstallmentPlanSnapshot(plan, basePrice, countryCode);
              const showManualInterest = plan.interestMode === "manual";
              const showIndexFlow = plan.interestMode === "index_suggested";
              const pendingIndex = pendingIndexByPlan[plan.id];
              const fetchError = fetchErrorByPlan[plan.id];
              const appliedMeta = plan.appliedIndexMetadata;
              const isFetching = fetchingPlanId === plan.id;

              return (
                <div key={plan.id} className="cc-payment-options__plan-card">
                  <div className="cc-payment-options__plan-head">
                    <h5 className="m-0 text-sm font-semibold">Plan {index + 1}</h5>
                    <button
                      type="button"
                      className="cc-presupuestos-link cc-presupuestos-link--button text-sm"
                      onClick={() => removePlan(plan.id)}
                    >
                      Quitar
                    </button>
                  </div>

                  <div className="cc-payment-options__fields ds-form-stack">
                    <DsField label="Cantidad de cuotas" htmlFor={`cc-plan-installments-${plan.id}`}>
                      <Input
                        id={`cc-plan-installments-${plan.id}`}
                        className="min-h-[44px]"
                        inputMode="numeric"
                        placeholder="Ej: 3"
                        value={plan.numberOfInstallments}
                        onChange={(e) =>
                          patchOptions({
                            installmentPlans: updatePlan(paymentOptions.installmentPlans, plan.id, {
                              numberOfInstallments: e.target.value.replace(/\D/g, ""),
                            }),
                          })
                        }
                      />
                    </DsField>

                    <DsField label="Tipo de interés" htmlFor={`cc-plan-interest-mode-${plan.id}`}>
                      <Select
                        id={`cc-plan-interest-mode-${plan.id}`}
                        className="min-h-[44px]"
                        value={plan.interestMode}
                        onChange={(e) => {
                          const nextMode = e.target.value as CuantoCobroInstallmentInterestMode;
                          patchOptions({
                            installmentPlans: updatePlan(paymentOptions.installmentPlans, plan.id, {
                              interestMode: nextMode,
                              ...(nextMode !== "index_suggested"
                                ? { appliedIndexMetadata: null }
                                : {}),
                            }),
                          });
                        }}
                      >
                        {Object.entries(INTEREST_MODE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </DsField>

                    {showManualInterest || (showIndexFlow && !indexSupported) ? (
                      <DsField
                        label="Porcentaje de interés"
                        htmlFor={`cc-plan-interest-${plan.id}`}
                        hint={
                          showIndexFlow && !indexSupported
                            ? "Cargá la tasa manualmente porque no hay índice automático."
                            : undefined
                        }
                      >
                        <Input
                          id={`cc-plan-interest-${plan.id}`}
                          className="min-h-[44px]"
                          inputMode="decimal"
                          placeholder="Ej: 15"
                          value={plan.interestPercent}
                          onChange={(e) =>
                            patchOptions({
                              installmentPlans: updatePlan(paymentOptions.installmentPlans, plan.id, {
                                interestPercent: e.target.value,
                              }),
                            })
                          }
                        />
                      </DsField>
                    ) : null}

                    {showIndexFlow && indexSupported ? (
                      <div className="cc-payment-options__index-panel ds-form-stack">
                        <CuantoCobroButton
                          type="button"
                          variant="outline"
                          className="min-h-[44px] w-full sm:w-auto"
                          disabled={isFetching}
                          onClick={() => handleFetchSuggestedRate(plan.id)}
                        >
                          {isFetching ? "Consultando índice…" : "Obtener tasa por inflación (IPC)"}
                        </CuantoCobroButton>

                        {fetchError ? (
                          <div className="ds-info-panel cc-info-panel--warning" role="alert">
                            <p className="ds-info-panel__body m-0 text-sm">{fetchError}</p>
                          </div>
                        ) : null}

                        {pendingIndex?.available && pendingIndex.suggestedAnnualRate != null ? (
                          <div className="ds-info-panel cc-info-panel--accent" role="status">
                            <p className="ds-info-panel__body m-0 text-sm">
                              Tasa sugerida: <strong>{pendingIndex.suggestedAnnualRate}%</strong> anual
                              <br />
                              Fuente: {pendingIndex.sourceLabel}
                              <br />
                              Método: {pendingIndex.method ?? "—"}
                              <br />
                              Consultado: {formatIndexDate(pendingIndex.queriedAt)}
                              {pendingIndex.latestPeriod ? (
                                <>
                                  <br />
                                  Último dato: {pendingIndex.latestPeriod}
                                </>
                              ) : null}
                              {pendingIndex.message ? (
                                <>
                                  <br />
                                  <span className="text-[var(--cc-color-muted)]">{pendingIndex.message}</span>
                                </>
                              ) : null}
                            </p>
                            <CuantoCobroButton
                              type="button"
                              variant="primary"
                              className="min-h-[44px] mt-3 w-full sm:w-auto"
                              onClick={() => handleApplySuggestedRate(plan.id)}
                            >
                              Aplicar al plan
                            </CuantoCobroButton>
                          </div>
                        ) : null}

                        {appliedMeta ? (
                          <div className="ds-info-panel cc-info-panel--accent" role="status">
                            <p className="ds-info-panel__body m-0 text-sm">
                              Tasa aplicada: <strong>{plan.interestPercent || appliedMeta.suggestedAnnualRate}%</strong>{" "}
                              anual
                              <br />
                              Fuente: {appliedMeta.sourceLabel}
                              <br />
                              Método: {appliedMeta.method}
                              <br />
                              Consultado: {formatIndexDate(appliedMeta.queriedAt)}
                              {appliedMeta.latestPeriod ? (
                                <>
                                  <br />
                                  Último dato: {appliedMeta.latestPeriod}
                                </>
                              ) : null}
                              {appliedMeta.message ? (
                                <>
                                  <br />
                                  <span className="text-[var(--cc-color-muted)]">{appliedMeta.message}</span>
                                </>
                              ) : null}
                            </p>
                          </div>
                        ) : null}

                        <DsField
                          label="Porcentaje de interés (editable)"
                          htmlFor={`cc-plan-interest-applied-${plan.id}`}
                          hint="Podés ajustar manualmente después de aplicar la tasa sugerida."
                        >
                          <Input
                            id={`cc-plan-interest-applied-${plan.id}`}
                            className="min-h-[44px]"
                            inputMode="decimal"
                            placeholder="Ej: 21"
                            value={plan.interestPercent}
                            onChange={(e) =>
                              patchOptions({
                                installmentPlans: updatePlan(paymentOptions.installmentPlans, plan.id, {
                                  interestPercent: e.target.value,
                                }),
                              })
                            }
                          />
                        </DsField>
                      </div>
                    ) : null}

                    <DsField label="Texto comercial opcional" htmlFor={`cc-plan-note-${plan.id}`}>
                      <Textarea
                        id={`cc-plan-note-${plan.id}`}
                        rows={2}
                        value={plan.commercialNote}
                        onChange={(e) =>
                          patchOptions({
                            installmentPlans: updatePlan(paymentOptions.installmentPlans, plan.id, {
                              commercialNote: e.target.value,
                            }),
                          })
                        }
                        placeholder="Ej: Financiación en 3 pagos mensuales."
                      />
                    </DsField>

                    {preview ? (
                      <div className="cc-payment-options__preview-card">
                        <p className="m-0 text-sm">
                          {preview.numberOfInstallments} cuota{preview.numberOfInstallments === 1 ? "" : "s"}
                          {preview.interestPercent > 0 ? ` con ${preview.interestPercent}% interés` : " sin interés"}
                          <br />
                          Total financiado: <strong>{fmt(preview.financedTotal)}</strong>
                          <br />
                          {preview.numberOfInstallments} cuota{preview.numberOfInstallments === 1 ? "" : "s"} de{" "}
                          <strong>{fmt(preview.installmentAmount)}</strong>
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>

      {(liveSnapshot.cash || liveSnapshot.installmentPlans.length > 0) && (
        <div className="cc-payment-options__summary mt-4">
          <h4 className="cc-result-subsection-title m-0">Resumen para el cliente</h4>
          <ul className="cc-payment-options__summary-list mt-2 mb-0">
            {liveSnapshot.cash ? <li>1 pago: {fmt(liveSnapshot.cash.cashPrice)}</li> : null}
            {liveSnapshot.installmentPlans.map((plan) => (
              <li key={plan.id}>
                {plan.numberOfInstallments} cuota{plan.numberOfInstallments === 1 ? "" : "s"} de{" "}
                {fmt(plan.installmentAmount)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
