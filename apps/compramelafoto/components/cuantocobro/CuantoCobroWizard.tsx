"use client";

import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import PresupuestoQuoteActions from "@/components/cuantocobro/presupuestos/PresupuestoQuoteActions";
import CuantoCobroWizardMobileNav from "@/components/cuantocobro/CuantoCobroWizardMobileNav";
import CuantoCobroWizardSkeleton from "@/components/cuantocobro/CuantoCobroWizardSkeleton";
import CuantoCobroWizardResult from "@/components/cuantocobro/CuantoCobroWizardResult";
import CuantoCobroWizardFinancing from "@/components/cuantocobro/CuantoCobroWizardFinancing";
import CuantoCobroWizardSidebar from "@/components/cuantocobro/CuantoCobroWizardSidebar";
import CuantoCobroWizardStepContent from "@/components/cuantocobro/CuantoCobroWizardStepContent";
import {
  calculateCuantoCobro,
  getCuantoCobroMissingFields,
  getFirstIncompleteProfileStepIndex,
  getFirstQuoteStepIndex,
  isCuantoCobroProfileComplete,
} from "@/lib/cuantocobro/calculate-cuanto-cobro";
import { loadBusinessProfile } from "@/lib/cuantocobro/business-profile";
import { applyConsultaCurrencyToProfile, applyConsultaToQuoteSeed } from "@/lib/cuantocobro/consulta/consulta-to-quote";
import { buildPaymentOptionsSnapshot, resolvePhotographerCountryCode } from "@/lib/cuantocobro/payment";
import { fetchConsultaById } from "@/lib/cuantocobro/consulta/consulta-api-client";
import { fetchQuoteById, saveCuantoCobroQuote } from "@/lib/cuantocobro/quote/quote-api-client";
import {
  getCuantoCobroPresupuestoUrl,
} from "@/lib/cuantocobro/constants";
import {
  CC_DATA_SECURITY_NOTICE,
  CC_PROFILE_SCOPE_LABEL,
  CC_WIZARD_STEPS,
  INITIAL_CUANTO_COBRO_WIZARD_STATE,
  type CuantoCobroProfileInput,
  type CuantoCobroQuoteInput,
} from "@/lib/cuantocobro/types";
import {
  getActiveWizardConsultaId,
  setActiveWizardConsultaId,
} from "@/lib/cuantocobro/wizard-consulta-context";
import {
  hydrateWizardStorageUserId,
  loadCuantoCobroWizardState,
  resolveWizardStorageUserId,
  saveCuantoCobroWizardState,
} from "@/lib/cuantocobro/wizard-session";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  initialConsultaId?: number | null;
  initialQuoteId?: number | null;
};

export default function CuantoCobroWizard({ initialConsultaId = null, initialQuoteId = null }: Props) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState<CuantoCobroProfileInput>(INITIAL_CUANTO_COBRO_WIZARD_STATE.profile);
  const [quote, setQuote] = useState<CuantoCobroQuoteInput>(INITIAL_CUANTO_COBRO_WIZARD_STATE.quote);
  const [showMissing, setShowMissing] = useState(false);
  const [showPresupuestoIntro, setShowPresupuestoIntro] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [activeConsultaId, setActiveConsultaId] = useState<number | null>(initialConsultaId);
  const [activeQuoteExpedienteId, setActiveQuoteExpedienteId] = useState<number | null>(initialQuoteId);
  const [consultaLabel, setConsultaLabel] = useState<string | null>(null);
  const [quoteLabel, setQuoteLabel] = useState<string | null>(null);
  const [savingQuote, setSavingQuote] = useState(false);
  const [saveQuoteError, setSaveQuoteError] = useState<string | null>(null);
  const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null);
  const [savedQuoteVersion, setSavedQuoteVersion] = useState<number | null>(null);
  const wizardUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const userId = (await hydrateWizardStorageUserId()) ?? resolveWizardStorageUserId();
      if (cancelled) return;

      wizardUserIdRef.current = userId;
      const saved = await loadCuantoCobroWizardState(userId);

      const consultaIdFromUrl = initialConsultaId;
      const consultaIdFromSession = consultaIdFromUrl ?? getActiveWizardConsultaId();
      let nextProfile = saved.profile;
      let nextQuote = saved.quote;
      let nextStepIndex = 0;
      let nextShowIntro = false;

      if (consultaIdFromUrl) {
        setActiveWizardConsultaId(consultaIdFromUrl);
      }

      if (initialQuoteId) {
        try {
          const savedQuote = await fetchQuoteById(initialQuoteId);
          if (savedQuote && !cancelled) {
            nextQuote = savedQuote.quote;
            if (savedQuote.currency) {
              nextProfile = { ...nextProfile, currency: savedQuote.currency };
            }
            setActiveQuoteExpedienteId(savedQuote.id);
            setQuoteLabel(
              `${savedQuote.quoteNumber} · V${savedQuote.currentVersionNumber} (nueva versión al guardar)`,
            );

            if (isCuantoCobroProfileComplete(nextProfile, nextQuote)) {
              const quoteStepIndex = getFirstQuoteStepIndex();
              if (quoteStepIndex >= 0) {
                nextStepIndex = quoteStepIndex;
                nextShowIntro = true;
              }
            } else {
              const incompleteIndex = getFirstIncompleteProfileStepIndex(nextProfile, nextQuote);
              if (incompleteIndex >= 0) nextStepIndex = incompleteIndex;
            }
          }
        } catch {
          if (!cancelled) {
            setSaveQuoteError("No se pudo cargar el presupuesto para recotizar.");
          }
        }
      } else if (consultaIdFromSession) {
        try {
          const consulta = await fetchConsultaById(consultaIdFromSession);
          if (consulta && !cancelled) {
            nextProfile = applyConsultaCurrencyToProfile(consulta, nextProfile);
            nextQuote = applyConsultaToQuoteSeed(consulta);
            setActiveConsultaId(consultaIdFromSession);
            setConsultaLabel(`${consulta.consultaNumber} · ${consulta.title}`);

            if (isCuantoCobroProfileComplete(nextProfile, nextQuote)) {
              const quoteStepIndex = getFirstQuoteStepIndex();
              if (quoteStepIndex >= 0) {
                nextStepIndex = quoteStepIndex;
                nextShowIntro = true;
              }
            } else {
              const incompleteIndex = getFirstIncompleteProfileStepIndex(nextProfile, nextQuote);
              if (incompleteIndex >= 0) nextStepIndex = incompleteIndex;
            }
          }
        } catch {
          if (!cancelled) {
            setSaveQuoteError("No se pudo cargar la consulta para precargar el presupuesto.");
          }
        }
      } else if (isCuantoCobroProfileComplete(saved.profile, saved.quote)) {
        const quoteStepIndex = getFirstQuoteStepIndex();
        if (quoteStepIndex >= 0) {
          nextStepIndex = quoteStepIndex;
          if (!saved.quote.client.jobType) nextShowIntro = true;
        }
      }

      if (cancelled) return;

      setProfile(nextProfile);
      setQuote(nextQuote);
      setStepIndex(nextStepIndex);
      setShowPresupuestoIntro(nextShowIntro);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [initialConsultaId, initialQuoteId]);

  useEffect(() => {
    if (!hydrated) return;
    void saveCuantoCobroWizardState({ profile, quote }, wizardUserIdRef.current);
  }, [profile, quote, hydrated]);

  const currentStep = CC_WIZARD_STEPS[stepIndex];
  const progress = ((stepIndex + 1) / CC_WIZARD_STEPS.length) * 100;
  const missingFields = useMemo(
    () => getCuantoCobroMissingFields(currentStep.id, profile, quote),
    [currentStep.id, profile, quote],
  );
  const calculation = useMemo(() => calculateCuantoCobro(profile, quote), [profile, quote]);
  const isLastStep = stepIndex === CC_WIZARD_STEPS.length - 1;
  const isBeforeResult = currentStep.id === "quote-financing";
  const isLastProfileStep =
    currentStep.block === "profile" && CC_WIZARD_STEPS[stepIndex + 1]?.block === "quote";
  const canGoNext = missingFields.length === 0;
  const scopeClass =
    currentStep.scopeLabel === CC_PROFILE_SCOPE_LABEL ? "cc-scope-badge--profile" : "cc-scope-badge--quote";

  const updateProfile = <K extends keyof CuantoCobroProfileInput>(key: K, value: CuantoCobroProfileInput[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setShowMissing(false);
  };

  const updateProfilePatch = (patch: Partial<CuantoCobroProfileInput>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
    setShowMissing(false);
  };

  const updateQuote = <K extends keyof CuantoCobroQuoteInput>(key: K, value: CuantoCobroQuoteInput[K]) => {
    setQuote((prev) => ({ ...prev, [key]: value }));
    setShowMissing(false);
  };

  const goToStep = (index: number) => {
    const targetStep = CC_WIZARD_STEPS[index];
    if (targetStep.block === "quote" && !isCuantoCobroProfileComplete(profile, quote)) {
      const incompleteIndex = getFirstIncompleteProfileStepIndex(profile, quote);
      if (incompleteIndex >= 0) {
        setStepIndex(incompleteIndex);
        setShowMissing(true);
        setShowPresupuestoIntro(false);
        return;
      }
    }
    setShowMissing(false);
    setShowPresupuestoIntro(false);
    setStepIndex(Math.max(0, Math.min(index, CC_WIZARD_STEPS.length - 1)));
  };

  const goNext = () => {
    if (!canGoNext) {
      setShowMissing(true);
      return;
    }
    setShowMissing(false);
    if (isLastProfileStep) {
      setShowPresupuestoIntro(true);
    }
    setStepIndex((prev) => Math.min(prev + 1, CC_WIZARD_STEPS.length - 1));
  };

  const goPrev = () => {
    setShowMissing(false);
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  async function handleSaveQuote() {
    if (calculation.status !== "complete") {
      setShowMissing(true);
      return;
    }

    setSavingQuote(true);
    setSaveQuoteError(null);

    try {
      const effectivePrice = calculation.chosenManualPrice ?? calculation.recommendedBusinessPrice;
      const businessProfile = loadBusinessProfile();
      const paymentOptionsSnapshot = buildPaymentOptionsSnapshot({
        basePrice: calculation.chosenPriceEffective,
        currency: calculation.currency,
        countryCode: resolvePhotographerCountryCode({
          businessCountry: businessProfile?.country,
          profileCurrency: calculation.currency,
        }),
        paymentOptions: quote.paymentOptions,
      });

      const saved = await saveCuantoCobroQuote({
        quote,
        consultaId: activeConsultaId,
        quoteExpedienteId: activeQuoteExpedienteId,
        profile,
        calculationSnapshot: calculation,
        paymentOptionsSnapshot,
        businessProfileSnapshot: businessProfile ?? {},
        currency: calculation.currency,
        chosenPriceCents: Math.round(effectivePrice),
        recommendedPriceCents: Math.round(calculation.recommendedBusinessPrice),
        minimumPriceCents: Math.round(calculation.minimumSustainablePrice),
      });

      setSavedQuoteNumber(saved.quoteNumber);
      setSavedQuoteVersion(saved.currentVersionNumber);
      setActiveQuoteExpedienteId(saved.id);

      if (activeConsultaId) {
        setActiveWizardConsultaId(null);
        router.push(`/cuantocobro/app/consultas/${activeConsultaId}`);
        router.refresh();
        return;
      }

      router.push(getCuantoCobroPresupuestoUrl(saved.id));
      router.refresh();
    } catch (err) {
      setSaveQuoteError(err instanceof Error ? err.message : "No se pudo guardar el presupuesto");
      setSavingQuote(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="cc-wizard cc-wizard--loading">
        <CuantoCobroWizardSkeleton />
      </div>
    );
  }

  return (
    <div className="cc-wizard">
      <div className="cc-wizard__layout">
        <CuantoCobroWizardSidebar
          stepIndex={stepIndex}
          progress={progress}
          profile={profile}
          quote={quote}
          onStepSelect={goToStep}
        />

        <div className="cc-wizard__main">
          <CuantoCobroWizardMobileNav
            stepIndex={stepIndex}
            progress={progress}
            profile={profile}
            quote={quote}
            onStepSelect={goToStep}
          />

          <div className="cc-wizard__scroll">
            <article className="cc-wizard-step-card">
              <header className="cc-wizard-step-card__header">
                <span className={`cc-scope-badge ${scopeClass}`}>{currentStep.scopeLabel}</span>
                <h3 className="cc-wizard-step-card__title">{currentStep.title}</h3>
                <p className="cc-wizard-step-card__description">{currentStep.description}</p>
              </header>

              <div className="cc-wizard-step-card__body ds-form-stack">
                {consultaLabel ? (
                  <div className="ds-info-panel cc-info-panel--accent" role="status">
                    <p className="ds-info-panel__body m-0 text-sm leading-relaxed">
                      Cotizando desde la consulta <strong>{consultaLabel}</strong>. Cliente, fecha, tipo de evento,
                      lugar y notas se precargaron automáticamente.
                    </p>
                  </div>
                ) : null}

                {quoteLabel ? (
                  <div className="ds-info-panel cc-info-panel--accent" role="status">
                    <p className="ds-info-panel__body m-0 text-sm leading-relaxed">
                      Creando una nueva versión desde <strong>{quoteLabel}</strong>. Al guardar se conservará el
                      número de expediente y se agregará una versión nueva sin modificar las anteriores.
                    </p>
                  </div>
                ) : null}

                {showPresupuestoIntro && currentStep.id === "quote-details" && (
                  <div className="ds-info-panel cc-info-panel--accent" role="status">
                    <p className="ds-info-panel__body m-0 text-sm leading-relaxed">
                      Tu perfil está completo. Ahora cargá los datos de este presupuesto para calcular el precio del
                      trabajo.
                    </p>
                  </div>
                )}

                {currentStep.id === "result" ? (
                  <CuantoCobroWizardResult
                    calculation={calculation}
                    profile={profile}
                    quote={quote}
                    onQuoteChange={updateQuote}
                  />
                ) : currentStep.id === "quote-financing" ? (
                  <CuantoCobroWizardFinancing
                    calculation={calculation}
                    quote={quote}
                    onQuoteChange={updateQuote}
                  />
                ) : (
                  <CuantoCobroWizardStepContent
                    stepId={currentStep.id}
                    profile={profile}
                    quote={quote}
                    onProfileChange={updateProfile}
                    onProfilePatch={updateProfilePatch}
                    onQuoteChange={updateQuote}
                  />
                )}

                {isLastStep && !savedQuoteNumber && !savingQuote ? (
                  <div className="ds-info-panel cc-info-panel--accent" role="note">
                    <p className="ds-info-panel__body m-0 text-sm leading-relaxed">
                      La cotización de arriba todavía <strong>no está guardada</strong> como presupuesto. Usá{" "}
                      <strong>Guardar presupuesto</strong> (abajo) para verla en Presupuestos, exportar PDF o enviarla
                      al cliente.
                    </p>
                  </div>
                ) : null}

                {saveQuoteError ? (
                  <div className="ds-info-panel cc-info-panel--warning" role="alert">
                    <p className="ds-info-panel__body m-0 text-sm">{saveQuoteError}</p>
                  </div>
                ) : null}

                {savedQuoteNumber && !activeConsultaId ? (
                  <div className="ds-stack-section">
                    <div className="ds-info-panel cc-info-panel--accent" role="status">
                      <p className="ds-info-panel__body m-0 text-sm">
                        Presupuesto guardado como <strong>{savedQuoteNumber}</strong>
                        {savedQuoteVersion ? (
                          <>
                            {" "}
                            · versión <strong>V{savedQuoteVersion}</strong>
                          </>
                        ) : null}
                        .
                      </p>
                    </div>
                    {activeQuoteExpedienteId && savedQuoteVersion && calculation.status === "complete" ? (
                      <PresupuestoQuoteActions
                        quoteId={activeQuoteExpedienteId}
                        quoteNumber={savedQuoteNumber}
                        versionNumber={savedQuoteVersion}
                        clientEmail={quote.client.email}
                      />
                    ) : null}
                  </div>
                ) : null}

                {showMissing && missingFields.length > 0 && !isLastStep && (
                  <div className="ds-info-panel cc-info-panel--warning" role="alert">
                    <p className="ds-info-panel__title m-0 font-medium normal-case tracking-normal text-sm">
                      Completá lo siguiente para continuar:
                    </p>
                    <ul className="ds-info-panel__body mt-2 mb-0 pl-5 list-disc space-y-1">
                      {missingFields.map((field) => (
                        <li key={field}>{field}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>

            <p className="cc-wizard__security-note">{CC_DATA_SECURITY_NOTICE}</p>
          </div>

          <footer className="cc-wizard__footer">
            <CuantoCobroButton
              type="button"
              variant="secondary"

              className="cc-wizard__footer-btn min-h-[44px]"
              onClick={goPrev}
              disabled={stepIndex === 0}
            >
              Anterior
            </CuantoCobroButton>
            {!isLastStep ? (
              <CuantoCobroButton
                type="button"
                variant="primary"


                className="cc-wizard__footer-btn min-h-[44px]"
                onClick={goNext}
              >
                {isBeforeResult ? "Ver resultado" : isLastProfileStep ? "Comenzar presupuesto" : "Siguiente"}
              </CuantoCobroButton>
            ) : (
              <>
                <CuantoCobroButton
                  type="button"
                  variant="primary"
                  className="cc-wizard__footer-btn min-h-[44px]"
                  disabled={savingQuote || calculation.status !== "complete"}
                  onClick={() => void handleSaveQuote()}
                >
                  {savingQuote ? "Guardando…" : "Guardar presupuesto"}
                </CuantoCobroButton>
                <CuantoCobroButton
                  type="button"
                  variant="secondary"
                  className="cc-wizard__footer-btn min-h-[44px]"
                  disabled={savingQuote}
                  onClick={() => goToStep(0)}
                >
                  Reiniciar cálculo
                </CuantoCobroButton>
              </>
            )}
            {isLastStep && activeConsultaId ? (
              <Link href={`/cuantocobro/app/consultas/${activeConsultaId}`} className="cc-wizard__footer-link">
                Volver a la consulta
              </Link>
            ) : null}
          </footer>
        </div>
      </div>
    </div>
  );
}
