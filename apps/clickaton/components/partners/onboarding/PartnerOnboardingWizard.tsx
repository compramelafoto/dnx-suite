"use client";

import { useMemo, useState } from "react";
import type {
  PartnerOnboardingDraft,
  PartnerOnboardingSubmission,
} from "@repo/partners/client-safe";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  PartnerLogoLibrary,
  type PartnerLogoLibraryAsset,
  type PartnerLogoUploadSlot,
} from "../logo/PartnerLogoLibrary";

const STEPS = [
  { id: 1, label: "Empresa" },
  { id: 2, label: "Contacto" },
  { id: 3, label: "Logos" },
  { id: 4, label: "Revisar y enviar" },
] as const;

type Props = {
  initialDraft?: PartnerOnboardingDraft | null;
  partnerDisplayName?: string | null;
  onSaveDraft?: (draft: PartnerOnboardingDraft) => Promise<void> | void;
  onUploadLogo?: (
    slot: PartnerLogoUploadSlot,
    file: File,
  ) => Promise<PartnerLogoLibraryAsset | void> | PartnerLogoLibraryAsset | void;
  onSubmit: (submission: PartnerOnboardingSubmission) => Promise<void> | void;
};

type Errors = Record<string, string>;

/**
 * Wizard público mobile-first (4 pasos) para completar datos del partner.
 */
export function PartnerOnboardingWizard({
  initialDraft,
  partnerDisplayName,
  onSaveDraft,
  onUploadLogo,
  onSubmit,
}: Props) {
  const [step, setStep] = useState(Math.min(Math.max(initialDraft?.step ?? 1, 1), 4));
  const [draft, setDraft] = useState<PartnerOnboardingDraft>(() => ({
    company: {
      name: initialDraft?.company?.name ?? partnerDisplayName ?? "",
      legalName: initialDraft?.company?.legalName ?? "",
      taxId: initialDraft?.company?.taxId ?? "",
      description: initialDraft?.company?.description ?? "",
      websiteUrl: initialDraft?.company?.websiteUrl ?? "",
      instagram: initialDraft?.company?.instagram ?? "",
      facebookUrl: initialDraft?.company?.facebookUrl ?? "",
      linkedinUrl: initialDraft?.company?.linkedinUrl ?? "",
      address: initialDraft?.company?.address ?? "",
      city: initialDraft?.company?.city ?? "",
      provinceOrState: initialDraft?.company?.provinceOrState ?? "",
      country: initialDraft?.company?.country ?? "Argentina",
      postalCode: initialDraft?.company?.postalCode ?? "",
      destinationKind: initialDraft?.company?.destinationKind ?? "WEBSITE",
      destinationUrl: initialDraft?.company?.destinationUrl ?? "",
      contributionNotes: initialDraft?.company?.contributionNotes ?? "",
      observations: initialDraft?.company?.observations ?? "",
    },
    contact: {
      firstName: initialDraft?.contact?.firstName ?? "",
      lastName: initialDraft?.contact?.lastName ?? "",
      roleTitle: initialDraft?.contact?.roleTitle ?? "",
      email: initialDraft?.contact?.email ?? "",
      phone: initialDraft?.contact?.phone ?? "",
      whatsapp: initialDraft?.contact?.whatsapp ?? "",
      emailIsPublic: initialDraft?.contact?.emailIsPublic ?? false,
      phoneIsPublic: initialDraft?.contact?.phoneIsPublic ?? false,
    },
    logos: initialDraft?.logos ?? [],
    consents: {
      authority: initialDraft?.consents?.authority ?? false,
      brandUsage: initialDraft?.consents?.brandUsage ?? false,
      marketing: initialDraft?.consents?.marketing ?? false,
    },
    step: initialDraft?.step ?? 1,
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const progressPct = useMemo(() => Math.round((step / STEPS.length) * 100), [step]);

  const logoAssets: PartnerLogoLibraryAsset[] = (draft.logos ?? []).map((logo) => ({
    type: logo.type,
    backgroundType: logo.backgroundType ?? "COLOR",
    assetId: logo.assetId,
    fileUrl: logo.fileUrl,
    storageKey: logo.storageKey,
    mimeType: logo.mimeType,
    width: logo.width,
    height: logo.height,
  }));

  function patchCompany(patch: Partial<NonNullable<PartnerOnboardingDraft["company"]>>) {
    setDraft((prev) => ({ ...prev, company: { ...prev.company, ...patch } }));
  }

  function patchContact(patch: Partial<NonNullable<PartnerOnboardingDraft["contact"]>>) {
    setDraft((prev) => ({ ...prev, contact: { ...prev.contact, ...patch } }));
  }

  function patchConsents(patch: Partial<NonNullable<PartnerOnboardingDraft["consents"]>>) {
    setDraft((prev) => ({
      ...prev,
      consents: {
        authority: prev.consents?.authority ?? false,
        brandUsage: prev.consents?.brandUsage ?? false,
        marketing: prev.consents?.marketing ?? false,
        ...patch,
      },
    }));
  }

  function validateStep(current: number): boolean {
    const nextErrors: Errors = {};
    if (current === 1) {
      if (!draft.company?.name?.trim()) nextErrors.name = "Ingresá el nombre de la empresa.";
      if (!draft.company?.destinationUrl?.trim() && draft.company?.websiteUrl?.trim()) {
        // ok — destination puede derivarse después
      }
    }
    if (current === 2) {
      if (!draft.contact?.firstName?.trim()) {
        nextErrors.firstName = "Ingresá el nombre del contacto.";
      }
      if (!draft.contact?.email?.trim()) {
        nextErrors.email = "Ingresá un email de contacto.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contact.email.trim())) {
        nextErrors.email = "Email inválido.";
      }
    }
    if (current === 3) {
      const hasRequired = (draft.logos ?? []).some(
        (l) =>
          (l.type === "LOGO_GENERAL" || l.type === "LOGO_PRIMARY") &&
          (l.backgroundType == null || l.backgroundType === "COLOR"),
      );
      if (!hasRequired) {
        nextErrors.logos = "Subí al menos el Logo general · Color (PNG o WEBP).";
      }
    }
    if (current === 4) {
      if (!draft.consents?.authority) {
        nextErrors.authority = "Debés confirmar que tenés autoridad para enviar estos datos.";
      }
      if (!draft.consents?.brandUsage) {
        nextErrors.brandUsage =
          "Debés autorizar el uso de la marca según las condiciones indicadas.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function persistDraft(nextStep: number) {
    const payload: PartnerOnboardingDraft = { ...draft, step: nextStep };
    setDraft(payload);
    if (onSaveDraft) await onSaveDraft(payload);
  }

  async function goNext() {
    if (!validateStep(step)) return;
    setPending(true);
    setSubmitError(null);
    try {
      const next = Math.min(step + 1, 4);
      await persistDraft(next);
      setStep(next);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo guardar el borrador.");
    } finally {
      setPending(false);
    }
  }

  async function goBack() {
    const prev = Math.max(step - 1, 1);
    setPending(true);
    try {
      await persistDraft(prev);
      setStep(prev);
    } finally {
      setPending(false);
    }
  }

  async function handleUpload(slot: PartnerLogoUploadSlot, file: File) {
    if (!onUploadLogo) throw new Error("Upload no disponible.");
    const result = await onUploadLogo(slot, file);
    setDraft((prev) => {
      const others = (prev.logos ?? []).filter(
        (l) =>
          !(
            l.type === slot.type &&
            (l.backgroundType ?? "COLOR") === slot.backgroundType
          ),
      );
      const nextLogo = result
        ? {
            assetId: result.assetId ?? `local-${slot.slotKey}`,
            type: slot.type,
            backgroundType: slot.backgroundType,
            fileUrl: result.fileUrl ?? URL.createObjectURL(file),
            storageKey: result.storageKey ?? null,
            mimeType: result.mimeType ?? file.type,
            width: result.width ?? null,
            height: result.height ?? null,
            fileSize: file.size,
          }
        : {
            assetId: `local-${slot.slotKey}`,
            type: slot.type,
            backgroundType: slot.backgroundType,
            fileUrl: URL.createObjectURL(file),
            mimeType: file.type,
            fileSize: file.size,
          };
      return { ...prev, logos: [...others, nextLogo] };
    });
  }

  async function handleSubmit() {
    if (!validateStep(4)) return;
    setPending(true);
    setSubmitError(null);
    try {
      const submission: PartnerOnboardingSubmission = {
        ...draft,
        step: 4,
        submittedAt: new Date().toISOString(),
      };
      await onSubmit(submission);
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo enviar la información.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <Card variant="outlined" className="space-y-4 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-ck-text">Datos enviados</h2>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          Recibimos tu información. El equipo de Clickatón la revisará y se pondrá en contacto si
          hace falta algún ajuste.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium text-ck-yellow">
          Paso {step} de {STEPS.length}
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-ck-surface-strong">
          <div
            className="h-full rounded-full bg-ck-yellow transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-ck-text-muted">{progressPct}% completado · {STEPS[step - 1]?.label}</p>
      </div>

      {step === 1 ? (
        <Card variant="outlined" className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-ck-text">Datos de la empresa</h2>
            <p className="text-sm text-ck-text-secondary">
              Completá la información pública y de contacto institucional.
            </p>
          </div>
          <div className="grid gap-6">
            <Field id="company-name" label="Nombre comercial" required error={errors.name}>
              <Input
                value={draft.company?.name ?? ""}
                onChange={(e) => patchCompany({ name: e.target.value })}
                autoComplete="organization"
              />
            </Field>
            <Field id="legal-name" label="Razón social">
              <Input
                value={draft.company?.legalName ?? ""}
                onChange={(e) => patchCompany({ legalName: e.target.value })}
              />
            </Field>
            <Field id="tax-id" label="CUIT / Tax ID">
              <Input
                value={draft.company?.taxId ?? ""}
                onChange={(e) => patchCompany({ taxId: e.target.value })}
              />
            </Field>
            <Field id="description" label="Descripción breve">
              <Textarea
                rows={3}
                value={draft.company?.description ?? ""}
                onChange={(e) => patchCompany({ description: e.target.value })}
              />
            </Field>
            <Field id="website" label="Sitio web">
              <Input
                type="url"
                placeholder="https://"
                value={draft.company?.websiteUrl ?? ""}
                onChange={(e) => patchCompany({ websiteUrl: e.target.value })}
              />
            </Field>
            <Field id="instagram" label="Instagram">
              <Input
                placeholder="@marca"
                value={draft.company?.instagram ?? ""}
                onChange={(e) => patchCompany({ instagram: e.target.value })}
              />
            </Field>
            <Field id="facebook" label="Facebook">
              <Input
                value={draft.company?.facebookUrl ?? ""}
                onChange={(e) => patchCompany({ facebookUrl: e.target.value })}
              />
            </Field>
            <Field id="linkedin" label="LinkedIn">
              <Input
                value={draft.company?.linkedinUrl ?? ""}
                onChange={(e) => patchCompany({ linkedinUrl: e.target.value })}
              />
            </Field>
            <Field id="destination-kind" label="Destino principal del enlace">
              <Select
                value={draft.company?.destinationKind ?? "WEBSITE"}
                onChange={(e) =>
                  patchCompany({
                    destinationKind: e.target.value as NonNullable<
                      PartnerOnboardingDraft["company"]
                    >["destinationKind"],
                  })
                }
              >
                <option value="WEBSITE">Sitio web</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="OTHER">Otro</option>
              </Select>
            </Field>
            <Field id="destination-url" label="URL de destino">
              <Input
                type="url"
                placeholder="https://"
                value={draft.company?.destinationUrl ?? ""}
                onChange={(e) => patchCompany({ destinationUrl: e.target.value })}
              />
            </Field>
            <Field id="address" label="Dirección">
              <Input
                value={draft.company?.address ?? ""}
                onChange={(e) => patchCompany({ address: e.target.value })}
              />
            </Field>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field id="city" label="Ciudad">
                <Input
                  value={draft.company?.city ?? ""}
                  onChange={(e) => patchCompany({ city: e.target.value })}
                />
              </Field>
              <Field id="province" label="Provincia / Estado">
                <Input
                  value={draft.company?.provinceOrState ?? ""}
                  onChange={(e) => patchCompany({ provinceOrState: e.target.value })}
                />
              </Field>
              <Field id="country" label="País">
                <Input
                  value={draft.company?.country ?? ""}
                  onChange={(e) => patchCompany({ country: e.target.value })}
                />
              </Field>
              <Field id="postal" label="Código postal">
                <Input
                  value={draft.company?.postalCode ?? ""}
                  onChange={(e) => patchCompany({ postalCode: e.target.value })}
                />
              </Field>
            </div>
            <Field id="contribution-notes" label="Notas sobre el aporte / alianza">
              <Textarea
                rows={3}
                value={draft.company?.contributionNotes ?? ""}
                onChange={(e) => patchCompany({ contributionNotes: e.target.value })}
              />
            </Field>
            <Field id="observations" label="Observaciones">
              <Textarea
                rows={2}
                value={draft.company?.observations ?? ""}
                onChange={(e) => patchCompany({ observations: e.target.value })}
              />
            </Field>
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card variant="outlined" className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-ck-text">Persona de contacto</h2>
            <p className="text-sm text-ck-text-secondary">
              Usaremos estos datos para coordinar la alianza. No se publican por defecto.
            </p>
          </div>
          <div className="grid gap-6">
            <Field id="first-name" label="Nombre" required error={errors.firstName}>
              <Input
                value={draft.contact?.firstName ?? ""}
                onChange={(e) => patchContact({ firstName: e.target.value })}
                autoComplete="given-name"
              />
            </Field>
            <Field id="last-name" label="Apellido">
              <Input
                value={draft.contact?.lastName ?? ""}
                onChange={(e) => patchContact({ lastName: e.target.value })}
                autoComplete="family-name"
              />
            </Field>
            <Field id="role-title" label="Cargo / rol">
              <Input
                value={draft.contact?.roleTitle ?? ""}
                onChange={(e) => patchContact({ roleTitle: e.target.value })}
              />
            </Field>
            <Field id="email" label="Email" required error={errors.email}>
              <Input
                type="email"
                value={draft.contact?.email ?? ""}
                onChange={(e) => patchContact({ email: e.target.value })}
                autoComplete="email"
              />
            </Field>
            <Field id="phone" label="Teléfono">
              <Input
                type="tel"
                value={draft.contact?.phone ?? ""}
                onChange={(e) => patchContact({ phone: e.target.value })}
                autoComplete="tel"
              />
            </Field>
            <Field id="whatsapp" label="WhatsApp">
              <Input
                type="tel"
                value={draft.contact?.whatsapp ?? ""}
                onChange={(e) => patchContact({ whatsapp: e.target.value })}
              />
            </Field>
            <label className="flex items-start gap-3 text-sm text-ck-text-secondary">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--ck-brand-primary)]"
                checked={Boolean(draft.contact?.emailIsPublic)}
                onChange={(e) => patchContact({ emailIsPublic: e.target.checked })}
              />
              <span>El email puede mostrarse públicamente si corresponde.</span>
            </label>
            <label className="flex items-start gap-3 text-sm text-ck-text-secondary">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--ck-brand-primary)]"
                checked={Boolean(draft.contact?.phoneIsPublic)}
                onChange={(e) => patchContact({ phoneIsPublic: e.target.checked })}
              />
              <span>El teléfono puede mostrarse públicamente si corresponde.</span>
            </label>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <Card variant="outlined" className="space-y-3 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-ck-text">Logos de marca</h2>
            <p className="text-sm leading-relaxed text-ck-text-secondary">
              Subí al menos el Logo general en Color. Cada casilla (Color / Negativo-Positivo o Fondo
              claro-oscuro) es un archivo distinto. Solo PNG o WEBP.
            </p>
            {errors.logos ? (
              <p className="text-sm text-red-300" role="alert">
                {errors.logos}
              </p>
            ) : null}
          </Card>
          <PartnerLogoLibrary
            assets={logoAssets}
            onUpload={handleUpload}
            showLegacyJpegWarning
          />
        </div>
      ) : null}

      {step === 4 ? (
        <Card variant="outlined" className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-ck-text">Revisar y enviar</h2>
            <p className="text-sm text-ck-text-secondary">
              Confirmá que los datos son correctos antes de enviarlos a revisión.
            </p>
          </div>

          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-ck-text-muted">Empresa</dt>
              <dd className="mt-1 font-medium text-ck-text">{draft.company?.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">Contacto</dt>
              <dd className="mt-1 text-ck-text">
                {[draft.contact?.firstName, draft.contact?.lastName].filter(Boolean).join(" ") ||
                  "—"}
                {draft.contact?.email ? ` · ${draft.contact.email}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-ck-text-muted">Logos cargados</dt>
              <dd className="mt-1 text-ck-text">
                {(draft.logos ?? []).length > 0
                  ? (draft.logos ?? []).map((l) => l.type).join(", ")
                  : "Ninguno"}
              </dd>
            </div>
          </dl>

          <div className="space-y-4 border-t border-ck-border pt-6">
            <label className="flex items-start gap-3 text-sm text-ck-text">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--ck-brand-primary)]"
                checked={Boolean(draft.consents?.authority)}
                onChange={(e) => patchConsents({ authority: e.target.checked })}
              />
              <span>
                Confirmo que tengo autoridad para enviar estos datos en nombre de la empresa.{" "}
                <span className="text-ck-yellow">*</span>
              </span>
            </label>
            {errors.authority ? (
              <p className="text-sm text-red-300" role="alert">
                {errors.authority}
              </p>
            ) : null}

            <label className="flex items-start gap-3 text-sm text-ck-text">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--ck-brand-primary)]"
                checked={Boolean(draft.consents?.brandUsage)}
                onChange={(e) => patchConsents({ brandUsage: e.target.checked })}
              />
              <span>
                Autorizo a Clickatón / DNX a usar los logos y datos de marca enviados para
                comunicación de la alianza. <span className="text-ck-yellow">*</span>
              </span>
            </label>
            {errors.brandUsage ? (
              <p className="text-sm text-red-300" role="alert">
                {errors.brandUsage}
              </p>
            ) : null}

            <label className="flex items-start gap-3 text-sm text-ck-text-secondary">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--ck-brand-primary)]"
                checked={Boolean(draft.consents?.marketing)}
                onChange={(e) => patchConsents({ marketing: e.target.checked })}
              />
              <span>Acepto recibir comunicaciones comerciales relacionadas (opcional).</span>
            </label>
          </div>
        </Card>
      ) : null}

      {submitError ? (
        <p className="text-sm text-red-300" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-ck-border pt-8 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full sm:w-auto"
          disabled={step === 1 || pending}
          onClick={() => void goBack()}
        >
          Atrás
        </Button>
        {step < 4 ? (
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto"
            loading={pending}
            onClick={() => void goNext()}
          >
            Continuar
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto"
            loading={pending}
            onClick={() => void handleSubmit()}
          >
            Enviar datos
          </Button>
        )}
      </div>
    </div>
  );
}
