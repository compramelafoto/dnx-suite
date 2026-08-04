"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RegistrationCompare } from "@/components/public-registration/experience/RegistrationCompare";
import { RegistrationExperienceHero } from "@/components/public-registration/experience/RegistrationExperienceHero";
import { RegistrationFaq } from "@/components/public-registration/experience/RegistrationFaq";
import { RegistrationHowItWorks } from "@/components/public-registration/experience/RegistrationHowItWorks";
import { RegistrationIncludes } from "@/components/public-registration/experience/RegistrationIncludes";
import { RegistrationLiveBenefits } from "@/components/public-registration/experience/RegistrationLiveBenefits";
import { RegistrationMobileCtaBar } from "@/components/public-registration/experience/RegistrationMobileCtaBar";
import {
  RegistrationOptionCards,
  type ExperienceTicketOption,
} from "@/components/public-registration/experience/RegistrationOptionCards";
import { RegistrationReassuranceCards } from "@/components/public-registration/experience/RegistrationReassuranceCards";
import { RegistrationShirtSizeStep } from "@/components/public-registration/experience/RegistrationShirtSizeStep";
import { RegistrationSocialProof } from "@/components/public-registration/experience/RegistrationSocialProof";
import { RegistrationPromoCodeField } from "@/components/public-registration/experience/RegistrationPromoCodeField";
import { RegistrationStickySummary } from "@/components/public-registration/experience/RegistrationStickySummary";
import { RegistrationWhatHappensNext } from "@/components/public-registration/experience/RegistrationWhatHappensNext";
import { RegistrationWhatYouCanWin } from "@/components/public-registration/experience/RegistrationWhatYouCanWin";
import { RegistrationWhyParticipate } from "@/components/public-registration/experience/RegistrationWhyParticipate";
import { RegistrationWelcomeBanner } from "@/components/public-registration/experience/RegistrationWelcomeBanner";
import {
  markReturningParticipant,
  readReturningParticipantFlag,
  resolveParticipantPersona,
  type ParticipantPersona,
} from "@/components/public-registration/experience/participant-persona";
import { createPublicRegistrationAction } from "@/lib/public-registration/actions/public-registration";
import {
  previewPublicPromotionAction,
  type PreviewPromotionActionResult,
} from "@/lib/public-registration/actions/preview-promotion";
import type { PublicRegistrationContextDto } from "@/lib/public-registration/domain/types";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";
import { formatExperiencePrice } from "@/components/public-registration/experience/format-experience-price";
import { resolveRegistrationCompareAt } from "@/components/public-registration/experience/registration-compare-at";
import { marathonPath } from "@/config/navigation";
import { CLICKATON_TERMS_VERSION } from "@/config/editions/argentina-2026";
import { resolveShirtBenefitUiStatus } from "@/lib/catalog/domain/first-n-benefit";
import { formatMarathonDateRange } from "@/lib/datetime";

type AppliedPromoQuote = Extract<PreviewPromotionActionResult, { ok: true }>["quote"];

type Props = {
  context: PublicRegistrationContextDto;
  idempotencyKey: string;
};

type Step = "venue" | "ticket" | "participant" | "review";

function stableIdempotencyKey(editionSlug: string, seed: string): string {
  if (typeof window === "undefined") return seed;
  const storageKey = `ck_reg_idem_${editionSlug}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing && existing.length >= 8) return existing;
    sessionStorage.setItem(storageKey, seed);
    return seed;
  } catch {
    return seed;
  }
}

export function PublicRegistrationWizard({ context, idempotencyKey }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const idemRef = useRef(idempotencyKey);
  const [idemKey, setIdemKey] = useState(idempotencyKey);
  const packCreditsReady = Boolean(
    context.passCredits && context.passCredits.remaining > 0,
  );
  const [persona, setPersona] = useState<ParticipantPersona>(() =>
    resolveParticipantPersona({
      hasActivePassCredits: Boolean(
        context.passCredits && context.passCredits.remaining > 0,
      ),
      isReturningLocal: false,
    }),
  );
  const [advancing, setAdvancing] = useState(false);
  const stepFocusRef = useRef<HTMLDivElement>(null);
  const skipInitialStepScrollRef = useRef(true);

  useEffect(() => {
    const key = stableIdempotencyKey(context.edition.slug, idempotencyKey);
    idemRef.current = key;
    setIdemKey(key);
  }, [context.edition.slug, idempotencyKey]);

  useEffect(() => {
    const next = resolveParticipantPersona({
      hasActivePassCredits: packCreditsReady,
      isReturningLocal: readReturningParticipantFlag(),
    });
    setPersona(next);
  }, [packCreditsReady]);

  const [step, setStep] = useState<Step>(
    context.venues.length > 1 ? "venue" : "ticket",
  );

  useEffect(() => {
    if (skipInitialStepScrollRef.current) {
      skipInitialStepScrollRef.current = false;
      return;
    }
    const el = stepFocusRef.current;
    if (!el) return;
    // Evita quedar abajo del CTA “Reservar mi lugar” al pasar a Datos/Confirmar.
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (step === "participant") {
        const firstField = el.querySelector<HTMLElement>(
          "input:not([type='hidden']):not([type='file']), select, textarea",
        );
        firstField?.focus({ preventScroll: true });
      }
    });
  }, [step]);
  const [venueId, setVenueId] = useState<string>(
    context.venues.length === 1 ? context.venues[0]!.id : "",
  );
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [usePassCredit, setUsePassCredit] = useState(false);
  const [variantChoices, setVariantChoices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [profilePhotoAssetId, setProfilePhotoAssetId] = useState("");
  const [profilePhotoFileName, setProfilePhotoFileName] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromoQuote | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoPending, setPromoPending] = useState(false);

  const ticketsForVenue = useMemo(() => {
    return context.tickets.filter((t) => {
      if (t.venueId && venueId && t.venueId !== venueId) return false;
      if (usePassCredit && t.isMarathonPack) return false;
      return true;
    });
  }, [context.tickets, venueId, usePassCredit]);

  const ticketsForOptions = useMemo(() => {
    return context.tickets.filter((t) => {
      if (t.venueId && venueId && t.venueId !== venueId) return false;
      return true;
    });
  }, [context.tickets, venueId]);

  useEffect(() => {
    const open = ticketsForVenue.filter((t) => t.salesStatus === "open" && !t.isSoldOut);
    if (!ticketTypeId && open.length === 1) {
      setTicketTypeId(open[0]!.id);
    }
  }, [ticketsForVenue, ticketTypeId]);

  const packPrefillDone = useRef(false);
  useEffect(() => {
    if (packPrefillDone.current) return;
    if (persona !== "pack_holder" || !packCreditsReady) return;
    const openEntry = ticketsForOptions.find(
      (t) => !t.isMarathonPack && t.salesStatus === "open" && !t.isSoldOut,
    );
    if (!openEntry) return;
    packPrefillDone.current = true;
    setUsePassCredit(true);
    setTicketTypeId(openEntry.id);
  }, [persona, packCreditsReady, ticketsForOptions]);

  const selectedTicket = ticketsForVenue.find((t) => t.id === ticketTypeId) ?? null;
  const selectedVenue =
    context.venues.find((v) => v.id === venueId) ??
    (context.venues.length === 1 ? context.venues[0]! : null);

  const cityHint =
    selectedVenue?.city ??
    context.venues.find((v) => v.city)?.city ??
    null;
  const dateHint = context.edition.startAt
    ? formatMarathonDateRange(
        context.edition.startAt instanceof Date
          ? context.edition.startAt.toISOString()
          : String(context.edition.startAt),
        (context.edition.endAt instanceof Date
          ? context.edition.endAt.toISOString()
          : context.edition.endAt) ||
          (context.edition.startAt instanceof Date
            ? context.edition.startAt.toISOString()
            : String(context.edition.startAt)),
        context.edition.timezone || "America/Argentina/Buenos_Aires",
      )
    : null;

  const baseCharge = useMemo(() => {
    if (!selectedTicket) return null;
    if (usePassCredit) {
      return { amount: 0, currency: selectedTicket.currency, label: "1 crédito Pack" };
    }
    if (selectedTicket.isMarathonPack) {
      return {
        amount: selectedTicket.priceAmount,
        currency: selectedTicket.currency,
        label: "Pack · 4 usos · 2 años",
      };
    }
    return {
      amount: context.currentPricePhase?.amount ?? selectedTicket.priceAmount,
      currency: context.currentPricePhase?.currency ?? selectedTicket.currency,
      label: context.currentPricePhase?.name ?? null,
    };
  }, [selectedTicket, usePassCredit, context.currentPricePhase]);

  const displayCharge = useMemo(() => {
    if (!baseCharge) return null;
    if (!appliedPromo || usePassCredit) return baseCharge;
    return {
      amount: appliedPromo.finalAmount,
      currency: appliedPromo.currency || baseCharge.currency,
      label: appliedPromo.name || baseCharge.label,
    };
  }, [baseCharge, appliedPromo, usePassCredit]);

  const canUsePromo = Boolean(
    selectedTicket && !usePassCredit && baseCharge && baseCharge.amount > 0,
  );

  useEffect(() => {
    setAppliedPromo(null);
    setPromoCodeInput("");
    setPromoError(null);
  }, [ticketTypeId, usePassCredit]);

  const experienceOptions: ExperienceTicketOption[] = useMemo(() => {
    return ticketsForOptions.map((t) => {
      const isPack = Boolean(t.isMarathonPack);
      const priceMinor = isPack
        ? t.priceAmount
        : (context.currentPricePhase?.amount ?? t.priceAmount);
      const { compareAt, savings } = isPack
        ? { compareAt: null, savings: null }
        : resolveRegistrationCompareAt({
            currentAmount: priceMinor,
            highestAmount: context.highestPricePhase?.amount,
          });
      return {
        id: t.id,
        name: t.name,
        isPack,
        isOpen: t.salesStatus === "open" && !t.isSoldOut,
        priceMinor,
        compareAtMinor: compareAt,
        savingsMinor: savings,
        phaseLabel: isPack ? null : (context.currentPricePhase?.name ?? null),
      };
    });
  }, [ticketsForOptions, context.currentPricePhase, context.highestPricePhase]);

  const shirtProducts = useMemo(() => {
    if (!selectedTicket) return [];
    return selectedTicket.products.filter((p) => p.requiresVariantChoice);
  }, [selectedTicket]);

  const steps: Step[] =
    context.venues.length > 1
      ? ["venue", "ticket", "participant", "review"]
      : ["ticket", "participant", "review"];
  const stepIndex = steps.indexOf(step);

  function pickOpenEntryTicketId(): string {
    const open = ticketsForOptions.find(
      (t) => !t.isMarathonPack && t.salesStatus === "open" && !t.isSoldOut,
    );
    return open?.id ?? ticketsForOptions.find((t) => !t.isMarathonPack)?.id ?? "";
  }

  function validateTicketSelection(
    ticketId: string,
    passCredit: boolean,
  ): string | null {
    const ticket = context.tickets.find((t) => t.id === ticketId) ?? null;
    if (!ticket) return "Elegí una opción para continuar.";
    if (ticket.isSoldOut || ticket.salesStatus !== "open") {
      return "Esa opción no está disponible para inscripción.";
    }
    if (passCredit && ticket.isMarathonPack) {
      return "Para usar tu Pack, elegí la inscripción a esta Clickatón.";
    }
    return null;
  }

  function advanceFromTicket(ticketId: string, passCredit: boolean) {
    setError(null);
    const msg = validateTicketSelection(ticketId, passCredit);
    if (msg) {
      setError(msg);
      return;
    }
    setTicketTypeId(ticketId);
    setUsePassCredit(passCredit);
    setAdvancing(true);
    window.setTimeout(() => {
      setStep("participant");
      setAdvancing(false);
    }, 280);
  }

  function goNext() {
    setError(null);
    if (step === "venue") {
      if (!venueId) {
        setError("Elegí una sede para continuar.");
        return;
      }
      setStep("ticket");
      return;
    }
    if (step === "ticket") {
      if (!selectedTicket) {
        setError("Elegí cómo querés participar.");
        return;
      }
      const msg = validateTicketSelection(selectedTicket.id, usePassCredit);
      if (msg) {
        setError(msg);
        return;
      }
      setStep("participant");
      return;
    }
    if (step === "participant") {
      const errs: Record<string, string> = {};
      if (firstName.trim().length < 2) errs.firstName = "Nombre requerido.";
      if (lastName.trim().length < 2) errs.lastName = "Apellido requerido.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errs.email = "Email inválido.";
      }
      if (!acceptTerms) errs.acceptTerms = "Obligatorio.";
      if (!instagramHandle.trim()) errs.instagramHandle = "Instagram requerido.";
      if (!profilePhotoAssetId) errs.profilePhotoAssetId = "Subí una foto de perfil.";
      if (selectedTicket) {
        for (const p of selectedTicket.products) {
          if (p.requiresVariantChoice && !variantChoices[p.productId]) {
            errs[`variant_${p.productId}`] = `Elegí el talle de ${p.productName}.`;
          }
        }
      }
      setFieldErrors(errs);
      if (Object.keys(errs).length) {
        setError(
          errs[`variant_${shirtProducts[0]?.productId ?? ""}`]
            ? "Elegí el talle de la remera para continuar."
            : "Completá los datos obligatorios y aceptá las bases y condiciones.",
        );
        return;
      }
      setStep("review");
    }
  }

  async function uploadPhoto(file: File | null) {
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    setProfilePhotoFileName(file.name);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/public/registration/profile-photo", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as {
        ok: boolean;
        assetId?: string;
        error?: string;
      };
      if (!result.ok || !result.assetId) {
        throw new Error(result.error ?? "No se pudo subir la foto.");
      }
      setProfilePhotoAssetId(result.assetId);
    } catch (err) {
      setProfilePhotoAssetId("");
      setProfilePhotoFileName("");
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
      if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = "";
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function applyPromoCode() {
    if (!selectedTicket || !canUsePromo) return;
    const code = promoCodeInput.trim();
    if (code.length < 2) {
      setPromoError("Ingresá un código válido.");
      return;
    }
    setPromoPending(true);
    setPromoError(null);
    try {
      const result = await previewPublicPromotionAction({
        editionSlug: context.edition.slug,
        ticketTypeId: selectedTicket.id,
        promoCode: code,
      });
      if (!result.ok) {
        setAppliedPromo(null);
        setPromoError(result.message);
        return;
      }
      setAppliedPromo(result.quote);
      setPromoCodeInput(result.quote.code);
      setPromoError(null);
    } catch {
      setAppliedPromo(null);
      setPromoError("No se pudo validar el código.");
    } finally {
      setPromoPending(false);
    }
  }

  function clearPromoCode() {
    setAppliedPromo(null);
    setPromoCodeInput("");
    setPromoError(null);
  }

  function submit() {
    if (!selectedTicket) return;
    setError(null);
    const fd = new FormData();
    fd.set("editionSlug", context.edition.slug);
    fd.set("venueId", venueId || selectedTicket.venueId || "");
    fd.set("ticketTypeId", selectedTicket.id);
    if (usePassCredit) {
      fd.set("usePassCredit", "true");
      if (context.passCredits?.entitlementId) {
        fd.set("passEntitlementId", context.passCredits.entitlementId);
      }
    }
    if (appliedPromo?.code) {
      fd.set("promoCode", appliedPromo.code);
    }
    fd.set(
      "variantChoices",
      JSON.stringify(
        Object.entries(variantChoices).map(([productId, productVariantId]) => ({
          productId,
          productVariantId,
        })),
      ),
    );
    fd.set("firstName", firstName);
    fd.set("lastName", lastName);
    fd.set("email", email);
    fd.set("phone", phone);
    fd.set("documentNumber", documentNumber);
    fd.set("city", city);
    fd.set("province", province);
    fd.set("country", "AR");
    if (acceptTerms) {
      fd.set("acceptTerms", "true");
      fd.set("acceptPrivacy", "true");
      fd.set("acceptImage", "true");
      fd.set("imageUsageConsent", "true");
      fd.set("socialPublicationConsent", "true");
      fd.set("identifiablePersonsConsent", "true");
      fd.set("promotionalLicenseConsent", "true");
    }
    fd.set("instagramHandle", instagramHandle);
    fd.set("profilePhotoAssetId", profilePhotoAssetId);
    fd.set("consentVersion", "2026-08-social-v1");
    fd.set("termsVersion", CLICKATON_TERMS_VERSION);
    fd.set("idempotencyKey", idemRef.current || idemKey);

    startTransition(async () => {
      const result = await createPublicRegistrationAction(undefined, fd);
      if (!result.ok || !result.data) {
        setError(result.message ?? "No se pudo crear la inscripción.");
        setFieldErrors(result.errors ?? {});
        if (result.code === "RATE_LIMITED") setStep("review");
        else setStep("participant");
        return;
      }
      try {
        sessionStorage.removeItem(`ck_reg_idem_${context.edition.slug}`);
      } catch {
        /* ignore */
      }
      markReturningParticipant();
      const href = `${marathonPath(context.edition.slug)}/inscripcion/resumen/${result.data.registrationId}?t=${encodeURIComponent(result.data.accessToken)}`;
      router.push(href);
    });
  }

  const shirtBenefitStatus = resolveShirtBenefitUiStatus({
    includesPhysicalMerch: context.currentPricePhase?.includesPhysicalMerch,
    shirtBenefitAvailable: context.currentPricePhase?.shirtBenefitAvailable,
    shirtBenefitEnded: context.currentPricePhase?.shirtBenefitEnded,
  });

  const stickyIncludes = selectedTicket?.isMarathonPack
    ? [
        "Esta Clickatón incluida",
        "3 Clickatones más",
        "Válido por 2 años",
        "Mejor precio por edición",
      ]
    : [
        "Tu lugar en la Clickatón",
        "Tu número de participante",
        "Acceso a las consignas",
        "Certificado digital",
        ...(shirtBenefitStatus === "available"
          ? ["Remera oficial de regalo (si confirmás a tiempo)"]
          : []),
      ];

  const stickyCtaLabel =
    step === "venue"
      ? "Continuar"
      : step === "ticket"
        ? usePassCredit
          ? "Usar mi Pack"
          : selectedTicket?.isMarathonPack
            ? "Quiero el Pack"
            : "Reservar mi lugar"
        : step === "participant"
          ? "Revisar inscripción"
          : "Confirmar reserva";

  const stickyProductLabel = usePassCredit
    ? "Inscripción con tu Pack"
    : selectedTicket?.isMarathonPack
      ? "Pack de 4 Clickatones"
      : selectedTicket
        ? "Inscripción a esta Clickatón"
        : "Elegí cómo participar";

  const stickyNextStep =
    step === "ticket"
      ? "Completar tus datos"
      : step === "participant"
        ? "Revisar y confirmar"
        : "Confirmar tu lugar";

  const entryPromo = useMemo(() => {
    if (usePassCredit || !selectedTicket) {
      return { compareAt: null as number | null, savings: null as number | null };
    }
    if (appliedPromo) {
      return {
        compareAt: appliedPromo.originalAmount,
        savings: appliedPromo.discountAmount,
      };
    }
    if (selectedTicket.isMarathonPack) {
      return { compareAt: null, savings: null };
    }
    return resolveRegistrationCompareAt({
      currentAmount: context.currentPricePhase?.amount,
      highestAmount: context.highestPricePhase?.amount,
    });
  }, [
    usePassCredit,
    selectedTicket,
    appliedPromo,
    context.currentPricePhase?.amount,
    context.highestPricePhase?.amount,
  ]);

  const promoFieldProps = canUsePromo
    ? {
        value: promoCodeInput,
        onChange: setPromoCodeInput,
        onApply: () => {
          void applyPromoCode();
        },
        onClear: clearPromoCode,
        pending: promoPending,
        error: promoError,
        applied: appliedPromo
          ? {
              code: appliedPromo.code,
              name: appliedPromo.name,
              discountLabel: `− ${formatExperiencePrice(appliedPromo.discountAmount)}`,
            }
          : null,
        disabled: pending,
      }
    : null;

  function onPrimaryCta() {
    if (step === "review") submit();
    else if (step === "ticket") {
      if (!selectedTicket) {
        setError("Elegí cómo querés participar.");
        return;
      }
      advanceFromTicket(selectedTicket.id, usePassCredit);
    } else goNext();
  }

  const showSticky = step === "ticket" || step === "participant" || step === "review";
  const ctaBusy = advancing || pending;
  const mobilePriceHint =
    usePassCredit
      ? "Con tu Pack"
      : displayCharge != null
        ? formatExperiencePrice(displayCharge.amount)
        : null;

  return (
    <div
      className={
        showSticky
          ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-12"
          : "space-y-8"
      }
    >
      <div ref={stepFocusRef} className="scroll-mt-28 space-y-10 md:space-y-12">
        <ol className="flex flex-wrap gap-2 text-sm" aria-label="Progreso de inscripción">
          {steps.map((s, i) => (
            <li
              key={s}
              className={`rounded-full px-3 py-1 ${
                i === stepIndex
                  ? "bg-ck-yellow text-ck-bg"
                  : i < stepIndex
                    ? "bg-ck-surface-elevated text-ck-text"
                    : "bg-ck-bg text-ck-text-muted"
              }`}
            >
              {i + 1}.{" "}
              {s === "venue"
                ? "Sede"
                : s === "ticket"
                  ? "Participar"
                  : s === "participant"
                    ? "Datos"
                    : "Confirmar"}
            </li>
          ))}
        </ol>

        {error ? (
          <p className="text-sm text-[var(--ck-danger)]" role="alert">
            {error}
          </p>
        ) : null}

        {step === "venue" ? (
          <fieldset className="space-y-4">
            <legend className="text-xl font-semibold">Elegí la sede</legend>
            <div className="grid gap-4">
              {context.venues.map((v) => (
                <label
                  key={v.id}
                  className={`block cursor-pointer rounded-[var(--ck-radius-card)] border p-5 ${
                    venueId === v.id ? "border-ck-yellow" : "border-ck-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="venue"
                    className="sr-only"
                    checked={venueId === v.id}
                    onChange={() => setVenueId(v.id)}
                  />
                  <span className="font-semibold">{v.name}</span>
                  <span className="mt-2 block text-sm text-ck-text-secondary">
                    {[v.city, v.province].filter(Boolean).join(", ")}
                    {v.address ? ` · ${v.address}` : ""}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {step === "ticket" ? (
          <div className="space-y-12 pb-24 md:space-y-16 md:pb-28 lg:pb-0">
            <RegistrationWelcomeBanner
              persona={persona}
              remainingCredits={context.passCredits?.remaining ?? null}
            />
            {persona !== "pack_holder" ? (
              <RegistrationExperienceHero
                editionName={context.edition.name}
                cityHint={cityHint}
                dateHint={dateHint}
              />
            ) : null}
            {persona === "new" ? <RegistrationLiveBenefits cityHint={cityHint} /> : null}
            {persona !== "pack_holder" ? <RegistrationHowItWorks /> : null}
            {persona === "new" ? <RegistrationWhyParticipate /> : null}
            {persona === "new" ? <RegistrationReassuranceCards /> : null}
            {ticketsForOptions.length === 0 ? (
              <p role="status" className="text-sm text-ck-text-muted">
                No hay opciones disponibles por ahora.
              </p>
            ) : (
              <RegistrationOptionCards
                tickets={experienceOptions}
                selectedTicketId={ticketTypeId}
                usePassCredit={usePassCredit}
                canUsePassCredit={packCreditsReady}
                remainingCredits={context.passCredits?.remaining ?? null}
                persona={persona}
                advancing={advancing}
                shirtBenefitStatus={shirtBenefitStatus}
                onSelectTicket={(id) => {
                  setTicketTypeId(id);
                  setUsePassCredit(false);
                }}
                onSelectPassCredit={() => {
                  const id = pickOpenEntryTicketId();
                  setUsePassCredit(true);
                  if (id) setTicketTypeId(id);
                }}
                onConfirmTicket={(id) => advanceFromTicket(id, false)}
                onConfirmPassCredit={() => {
                  const id = pickOpenEntryTicketId();
                  if (!id) {
                    setError("No hay una inscripción disponible para usar tu Pack.");
                    return;
                  }
                  advanceFromTicket(id, true);
                }}
              />
            )}
            {persona === "pack_holder" ? <RegistrationHowItWorks /> : null}
            {persona !== "pack_holder" ? <RegistrationCompare /> : null}
            <RegistrationIncludes shirtBenefitStatus={shirtBenefitStatus} />
            <RegistrationWhatYouCanWin />
            <RegistrationWhatHappensNext />
            <RegistrationSocialProof />
            <RegistrationFaq />
          </div>
        ) : null}

        {step === "participant" ? (
          <fieldset id="inscripcion-datos" className="scroll-mt-28 space-y-8">
            <legend className="text-xl font-semibold md:text-2xl">Tus datos</legend>

            {shirtProducts.map((p) => {
              const activeVariants = [...p.variants]
                .filter((v) => v.isActive && v.availableStock > 0)
                .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100));
              return (
                <RegistrationShirtSizeStep
                  key={p.productId}
                  productName={p.productName}
                  options={activeVariants.map((v) => ({
                    value: v.id,
                    label: v.name,
                  }))}
                  value={variantChoices[p.productId] ?? ""}
                  error={fieldErrors[`variant_${p.productId}`] ?? null}
                  onChange={(variantId) =>
                    setVariantChoices((prev) => ({
                      ...prev,
                      [p.productId]: variantId,
                    }))
                  }
                  sizeChartUrl={p.sizeChartUrl}
                  sizeChartDescription={p.sizeChartDescription}
                  sizeChartInstructions={p.sizeChartInstructions}
                />
              );
            })}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="firstName"
                label="Nombre *"
                value={firstName}
                onChange={setFirstName}
                error={fieldErrors.firstName}
              />
              <Field
                id="instagramHandle"
                label="Usuario de Instagram *"
                value={instagramHandle}
                onChange={setInstagramHandle}
                error={fieldErrors.instagramHandle}
              />
              <Field
                id="lastName"
                label="Apellido *"
                value={lastName}
                onChange={setLastName}
                error={fieldErrors.lastName}
              />
              <Field
                id="email"
                label="Email *"
                type="email"
                value={email}
                onChange={setEmail}
                error={fieldErrors.email}
              />
              <Field
                id="phone"
                label="Teléfono"
                value={phone}
                onChange={setPhone}
                error={fieldErrors.phone}
              />
              <Field
                id="documentNumber"
                label="Documento"
                value={documentNumber}
                onChange={setDocumentNumber}
              />
              <Field id="city" label="Localidad" value={city} onChange={setCity} />
              <Field
                id="province"
                label="Provincia"
                value={province}
                onChange={setProvince}
              />
            </div>
            <div className="block text-sm">
              <span className="font-medium text-ck-text">Foto de perfil *</span>
              <input
                ref={profilePhotoInputRef}
                id="profilePhoto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploadingPhoto}
                onChange={(e) => void uploadPhoto(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => profilePhotoInputRef.current?.click()}
                className={[
                  "mt-3 flex w-full min-h-[7.5rem] flex-col items-center justify-center gap-3 rounded-[var(--ck-radius-card)] border-2 border-dashed px-6 py-8 text-center transition-colors",
                  profilePhotoAssetId
                    ? "border-ck-yellow/70 bg-ck-yellow/5"
                    : "border-ck-border-strong bg-ck-surface hover:border-ck-yellow hover:bg-ck-surface-strong",
                  uploadingPhoto ? "opacity-70" : "",
                ].join(" ")}
              >
                <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-ck-yellow bg-ck-yellow px-5 text-sm font-semibold text-[var(--ck-text-on-brand)]">
                  {uploadingPhoto
                    ? "Subiendo…"
                    : profilePhotoAssetId
                      ? "Cambiar foto"
                      : "Elegir foto"}
                </span>
                <span className="max-w-sm text-sm text-ck-text-secondary">
                  {uploadingPhoto
                    ? "Subiendo foto…"
                    : profilePhotoAssetId
                      ? `Foto cargada${profilePhotoFileName ? `: ${profilePhotoFileName}` : "."}`
                      : "JPG, PNG o WEBP. Mínimo 400×400 px."}
                </span>
              </button>
              {fieldErrors.profilePhotoAssetId ? (
                <p className="mt-2 text-sm text-red-400">{fieldErrors.profilePhotoAssetId}</p>
              ) : null}
            </div>
            <div className="space-y-3 text-sm" data-legal-review="consent-funnel-single-checkbox">
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 size-5 shrink-0"
                />
                <span>
                  Acepto las{" "}
                  <a
                    className="underline"
                    href={context.legal.termsPath}
                    target="_blank"
                    rel="noreferrer"
                  >
                    bases y condiciones
                  </a>{" "}
                  y las{" "}
                  <a className="underline" href={context.legal.rulesAnchor}>
                    reglas de la edición
                  </a>
                  .
                </span>
              </label>
              {fieldErrors.acceptTerms ? (
                <p className="text-sm text-red-400" role="alert">
                  {fieldErrors.acceptTerms}
                </p>
              ) : null}
            </div>
            {promoFieldProps ? (
              <div className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface/60 p-4 lg:hidden">
                <RegistrationPromoCodeField id="promoCodeParticipant" {...promoFieldProps} />
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {step === "review" && selectedTicket ? (
          <section className="space-y-4" aria-labelledby="review-heading">
            <h2 id="review-heading" className="text-xl font-semibold">
              Revisá tu inscripción
            </h2>
            <p className="rounded border border-ck-yellow/40 bg-ck-yellow/10 p-4 text-sm" role="status">
              {usePassCredit ? (
                <>
                  Vas a canjear 1 crédito de tu Pack. La inscripción se confirma sin
                  cargo al reservar (mismo email con el que compraste el Pack).
                </>
              ) : selectedTicket.isMarathonPack ? (
                <>
                  Al pagar el Pack quedás inscripto/a en esta maratón y obtenés 3
                  créditos más (validez 2 años) para otras Clickatón.
                </>
              ) : (
                <>
                  La inscripción se confirma con el pago o validación correspondiente.
                  Tu lugar queda reservado de forma temporal.
                </>
              )}
            </p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ck-text-secondary">Edición</dt>
                <dd>{context.edition.name}</dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Sede</dt>
                <dd>{selectedVenue?.name ?? "Sin sede específica"}</dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Opción</dt>
                <dd>
                  {selectedTicket.name}
                  {usePassCredit ? " · canje Pack" : null}
                </dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Importe</dt>
                <dd>
                  {displayCharge
                    ? formatPublicPrice(displayCharge.amount, displayCharge.currency)
                    : "—"}
                  {appliedPromo ? (
                    <span className="mt-1 block text-xs text-emerald-300">
                      Código {appliedPromo.code}: −{" "}
                      {formatPublicPrice(
                        appliedPromo.discountAmount,
                        appliedPromo.currency,
                      )}
                    </span>
                  ) : null}
                  {displayCharge?.label ? (
                    <span className="mt-1 block text-xs text-ck-text-muted">
                      {displayCharge.label}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Participante</dt>
                <dd>
                  {firstName} {lastName} · {email}
                </dd>
              </div>
            </dl>
            {promoFieldProps ? (
              <div className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface/60 p-4 lg:hidden">
                <RegistrationPromoCodeField id="promoCodeReview" {...promoFieldProps} />
              </div>
            ) : null}
            {selectedTicket.products.length > 0 ? (
              <div className="rounded border border-ck-border p-4">
                <h3 className="font-semibold">Incluido</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {selectedTicket.products.map((p) => {
                    const choiceId = variantChoices[p.productId];
                    const chosen = p.variants.find((v) => v.id === choiceId);
                    return (
                      <li key={p.productId}>
                        <p className="font-medium">{p.productName}</p>
                        {p.requiresVariantChoice ? (
                          <p>
                            Talle: <strong>{chosen?.name ?? "—"}</strong>
                          </p>
                        ) : p.fixedVariant ? (
                          <p>Talle: {p.fixedVariant.name}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "venue" ? (
          <div className="flex flex-col gap-3 border-t border-ck-border pt-8 sm:flex-row sm:justify-end">
            <Button
              type="button"
              disabled={pending}
              onClick={goNext}
              className="w-full min-h-12 sm:w-auto"
            >
              Continuar
            </Button>
          </div>
        ) : null}

        {stepIndex > 0 ? (
          <div className="flex flex-col gap-3 border-t border-ck-border pt-8 pb-24 lg:pb-0">
            <button
              type="button"
              disabled={pending}
              onClick={() => setStep(steps[stepIndex - 1]!)}
              className="self-start text-sm font-medium text-ck-text-muted underline-offset-4 transition-colors hover:text-ck-text hover:underline disabled:opacity-50"
            >
              ← Volver
            </button>
          </div>
        ) : step === "ticket" ? (
          <div className="pb-24 lg:pb-0" aria-hidden />
        ) : null}
      </div>

      {showSticky ? (
        <RegistrationStickySummary
          productLabel={stickyProductLabel}
          priceMinor={displayCharge?.amount ?? null}
          compareAtMinor={entryPromo.compareAt}
          savingsMinor={entryPromo.savings}
          usingCredit={usePassCredit}
          includes={stickyIncludes}
          nextStepLabel={stickyNextStep}
          ctaLabel={stickyCtaLabel}
          ctaBusyLabel={
            pending ? "Confirmando tu lugar…" : "Preparando tu lugar…"
          }
          ctaDisabled={
            ctaBusy || (step === "ticket" && !selectedTicket)
          }
          ctaBusy={ctaBusy}
          onCta={onPrimaryCta}
          promo={promoFieldProps}
        />
      ) : null}

      {showSticky ? (
        <RegistrationMobileCtaBar
          label={stickyCtaLabel}
          busyLabel={pending ? "Confirmando…" : "Preparando…"}
          disabled={ctaBusy || (step === "ticket" && !selectedTicket)}
          busy={ctaBusy}
          onClick={onPrimaryCta}
          priceHint={mobilePriceHint}
        />
      ) : null}
    </div>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
}) {
  const describedBy = props.error ? `${props.id}-error` : undefined;
  return (
    <div>
      <label htmlFor={props.id} className="ck-label text-ck-text">
        {props.label}
      </label>
      <input
        id={props.id}
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-describedby={describedBy}
        aria-invalid={Boolean(props.error)}
        className="mt-2 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3"
      />
      {props.error ? (
        <p id={describedBy} className="mt-1 text-xs text-[var(--ck-danger)]" role="alert">
          {props.error}
        </p>
      ) : null}
    </div>
  );
}
