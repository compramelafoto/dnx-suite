"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createFotorankContest,
  updateFotorankContest,
  type CreateFotorankContestInput,
  type ContestCategoryInput,
  type UpdateFotorankContestInput,
} from "../../../actions/contests";
import { normalizeSlug } from "../../../lib/fotorank/slug";
import {
  ContestCreateWizardPremium,
  ContestWizardStepOnePremium,
  WizardPremiumFooter,
  WizardSectionCardPremium,
} from "../../../components/contest-wizard-premium";
import { Step2Dates } from "./steps/Step2Dates";
import { Step3Config } from "./steps/Step3Config";
import { Step4Categories } from "./steps/Step4Categories";
import { routes } from "../../../lib/routes";

export type WizardStepMeta = {
  id: number;
  label: string;
  sublabel?: string;
  headline: string;
  intro: string;
};

export const WIZARD_STEPS: readonly WizardStepMeta[] = [
  {
    id: 1,
    label: "Datos generales",
    sublabel: "Identidad",
    headline: "Información básica",
    intro:
      "Completá los datos principales del concurso. Esta información será la base de la publicación y te ayudará a identificarlo dentro de la plataforma.",
  },
  {
    id: 2,
    label: "Fechas",
    sublabel: "Calendario",
    headline: "Fechas del concurso",
    intro: "Opcionales. Dejá en blanco lo que no tengas definido.",
  },
  {
    id: 3,
    label: "Configuración",
    sublabel: "Estado",
    headline: "Visibilidad y estado",
    intro: "Borrador, público o privado. Lo podés cambiar en cualquier momento.",
  },
  {
    id: 4,
    label: "Categorías",
    sublabel: "Participación",
    headline: "Categorías de fotos",
    intro: "Al menos una categoría con nombre. Los participantes eligen una al subir.",
  },
] as const;

export type WizardData = {
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  coverImageUrl: string;
  startAt: string;
  submissionDeadline: string;
  judgingStartAt: string;
  judgingEndAt: string;
  resultsAt: string;
  status: "DRAFT" | "SETUP_IN_PROGRESS" | "READY_TO_PUBLISH" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  categories: ContestCategoryInput[];
};

const initialData: WizardData = {
  title: "",
  slug: "",
  shortDescription: "",
  fullDescription: "",
  coverImageUrl: "",
  startAt: "",
  submissionDeadline: "",
  judgingStartAt: "",
  judgingEndAt: "",
  resultsAt: "",
  status: "DRAFT",
  visibility: "PUBLIC",
  categories: [{ name: "", slug: "", description: "", maxFiles: 1, sortOrder: 0 }],
};

export function validateStep1(data: WizardData): Record<string, string> {
  const e: Record<string, string> = {};
  if (!data.title.trim()) e.title = "Agregá un nombre visible para el concurso.";
  if (!data.slug.trim()) {
    e.slug = "Necesitamos un identificador único (se genera desde el título).";
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) {
    e.slug = "Solo letras minúsculas, números y guiones, sin espacios.";
  }
  if (!data.shortDescription.trim()) {
    e.shortDescription = "La descripción breve es obligatoria para el listado.";
  }
  return e;
}

function validateStep4(data: WizardData): Record<string, string> {
  const e: Record<string, string> = {};
  if (data.categories.length === 0) {
    e.categories = "Agregá al menos una categoría.";
  }
  data.categories.forEach((c, i) => {
    if (!c.name.trim()) {
      e[`categoryName-${i}`] = "Completá el nombre de la categoría.";
    }
    const slug = (c.slug || "").trim();
    if (!slug) {
      e[`categorySlug-${i}`] = "El slug es obligatorio (se genera desde el nombre).";
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      e[`categorySlug-${i}`] = "Solo minúsculas, números y guiones.";
    }
  });
  return e;
}

function mapWizardCategories(data: WizardData): ContestCategoryInput[] {
  return data.categories
    .filter((c) => c.name.trim())
    .map((c, i) => ({
      name: c.name.trim(),
      slug: normalizeSlug(c.slug) || normalizeSlug(c.name) || `cat-${i + 1}`,
      description: c.description?.trim() || undefined,
      maxFiles: Math.max(1, c.maxFiles),
      sortOrder: i,
    }));
}

function buildUpdatePayload(data: WizardData): UpdateFotorankContestInput {
  return {
    title: data.title,
    slug: data.slug,
    shortDescription: data.shortDescription,
    fullDescription: data.fullDescription || undefined,
    coverImageUrl: data.coverImageUrl || undefined,
    startAt: data.startAt || undefined,
    submissionDeadline: data.submissionDeadline || undefined,
    judgingStartAt: data.judgingStartAt || undefined,
    judgingEndAt: data.judgingEndAt || undefined,
    resultsAt: data.resultsAt || undefined,
    status: data.status,
    visibility: data.visibility,
    categories: mapWizardCategories(data),
  };
}

function buildCreatePayload(data: WizardData): CreateFotorankContestInput {
  return {
    title: data.title,
    slug: data.slug,
    shortDescription: data.shortDescription,
    fullDescription: data.fullDescription || undefined,
    coverImageUrl: data.coverImageUrl || undefined,
    startAt: data.startAt || undefined,
    submissionDeadline: data.submissionDeadline || undefined,
    judgingStartAt: data.judgingStartAt || undefined,
    judgingEndAt: data.judgingEndAt || undefined,
    resultsAt: data.resultsAt || undefined,
    status: "DRAFT",
    visibility: "PUBLIC",
    categories: mapWizardCategories(data),
  };
}

function clearFieldErrorsForUpdates(
  prev: Record<string, string>,
  updates: Partial<WizardData>
): Record<string, string> {
  const next = { ...prev };
  for (const k of Object.keys(updates) as (keyof WizardData)[]) {
    if (k === "categories") {
      delete next.categories;
      for (const ek of Object.keys(next)) {
        if (ek.startsWith("categoryName-") || ek.startsWith("categorySlug-")) {
          delete next[ek];
        }
      }
    } else {
      delete next[String(k)];
    }
  }
  return next;
}

interface CreateContestWizardProps {
  isOpen: boolean;
  onClose: () => void;
  organizationName: string;
  onSuccess?: () => void;
}

export function CreateContestWizard({ isOpen, onClose, organizationName, onSuccess }: CreateContestWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData);
  const [contestId, setContestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draftSaved, setDraftSaved] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [maxStepReached, setMaxStepReached] = useState(1);

  const dataRef = useRef(data);
  dataRef.current = data;

  const updateData = (updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
    setError(null);
    setFieldErrors((prev) => clearFieldErrorsForUpdates(prev, updates));
  };

  const currentMeta = WIZARD_STEPS[step - 1] ?? WIZARD_STEPS[0]!;

  const saveStep = async (): Promise<boolean> => {
    setError(null);
    setSaving(true);
    try {
      if (!contestId) {
        const result = await createFotorankContest(buildCreatePayload(data));
        if (result.ok) {
          setContestId(result.contestId);
          setDraftSaved(true);
          return true;
        }
        setError(result.error);
        return false;
      }
      const result = await updateFotorankContest(contestId, buildUpdatePayload(data));
      if (result.ok) {
        setDraftSaved(true);
        return true;
      }
      setError(result.error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!contestId || saving) return;

    const id = contestId;
    const timer = window.setTimeout(() => {
      void (async () => {
        setAutoSaveState("saving");
        const result = await updateFotorankContest(id, buildUpdatePayload(dataRef.current));
        if (result.ok) {
          setDraftSaved(true);
          setAutoSaveState("saved");
          window.setTimeout(() => {
            setAutoSaveState((s) => (s === "saved" ? "idle" : s));
          }, 2000);
        } else {
          setAutoSaveState("error");
        }
      })();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [contestId, data, saving]);

  const step1Errors = validateStep1(data);
  const step1Valid = Object.keys(step1Errors).length === 0;
  const step4Errors = validateStep4(data);
  const step4Valid = Object.keys(step4Errors).length === 0;

  const primaryBlockedByValidation =
    (step === 1 && !step1Valid) || (step === 4 && !step4Valid);

  const handleTitleChange = (name: string) => {
    setData((prev) => ({
      ...prev,
      title: name,
      slug: slugManuallyEdited ? prev.slug : normalizeSlug(name) || prev.slug,
    }));
    setError(null);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.title;
      if (!slugManuallyEdited) delete next.slug;
      return next;
    });
  };

  const handleNext = async () => {
    if (step === 1) {
      const v = validateStep1(data);
      setFieldErrors(v);
      if (Object.keys(v).length > 0) return;
    }
    const ok = await saveStep();
    if (ok && step < 4) {
      const nextStep = step + 1;
      setStep(nextStep);
      setMaxStepReached((prev) => Math.max(prev, nextStep));
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setFieldErrors({});
      setError(null);
    }
  };

  const handleFinish = async () => {
    const v = validateStep4(data);
    setFieldErrors(v);
    if (Object.keys(v).length > 0) return;

    const ok = await saveStep();
    if (ok && contestId) {
      router.refresh();
      if (onSuccess) onSuccess();
      else router.push(routes.dashboard.concursos.detalle(contestId));
    }
  };

  const stepperSteps = WIZARD_STEPS.map(({ id, label }) => ({ id, label }));

  const statusLine = (() => {
    if (autoSaveState === "saving") return "Guardando borrador…";
    if (autoSaveState === "error") return <span className="text-red-400/90">Error al guardar</span>;
    if (draftSaved || autoSaveState === "saved") return "Guardado";
    if (contestId) return "Autoguardado";
    return "Se crea el borrador al avanzar";
  })();

  return (
    <ContestCreateWizardPremium
      isOpen={isOpen}
      onClose={onClose}
      organizationName={organizationName}
      currentStep={step}
      headline={currentMeta.headline}
      intro={currentMeta.intro}
      steps={stepperSteps}
      onStepClick={setStep}
      maxStepReached={maxStepReached}
      statusLine={statusLine}
      footer={
        <WizardPremiumFooter
          onCancel={onClose}
          onBack={handleBack}
          onPrimary={step < 4 ? handleNext : handleFinish}
          backDisabled={step === 1}
          primaryDisabled={primaryBlockedByValidation}
          primaryLabel={step < 4 ? "Siguiente" : "Crear concurso"}
          saving={saving}
          showArrow
        />
      }
    >
      <div className="w-full space-y-8">
        {step === 1 && (
          <ContestWizardStepOnePremium
            title={data.title}
            slug={data.slug}
            shortDescription={data.shortDescription}
            fullDescription={data.fullDescription}
            coverImageUrl={data.coverImageUrl}
            onTitleChange={handleTitleChange}
            onSlugChange={(v) => {
              setSlugManuallyEdited(true);
              updateData({ slug: v });
            }}
            onShortDescriptionChange={(v) => updateData({ shortDescription: v })}
            onFullDescriptionChange={(v) => updateData({ fullDescription: v })}
            onCoverDataUrl={(url) => updateData({ coverImageUrl: url })}
            onCoverClear={() => updateData({ coverImageUrl: "" })}
            fieldErrors={fieldErrors}
          />
        )}
        {step === 2 && (
          <WizardSectionCardPremium title="Fechas del concurso" hideTitle centerContent>
            <Step2Dates data={data} updateData={updateData} />
          </WizardSectionCardPremium>
        )}
        {step === 3 && (
          <WizardSectionCardPremium title="Visibilidad y estado">
            <Step3Config data={data} updateData={updateData} />
          </WizardSectionCardPremium>
        )}
        {step === 4 && (
          <WizardSectionCardPremium title="Categorías de fotos">
            <Step4Categories data={data} updateData={updateData} fieldErrors={fieldErrors} />
          </WizardSectionCardPremium>
        )}
      </div>

      {error ? (
        <div
          className="mt-6 flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300"
          role="alert"
          aria-live="assertive"
        >
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

    </ContestCreateWizardPremium>
  );
}
