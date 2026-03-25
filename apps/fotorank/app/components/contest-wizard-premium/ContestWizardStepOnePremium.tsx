"use client";

import { WizardSectionCardPremium } from "./WizardSectionCardPremium";
import { WizardPremiumFormField, wizardPremiumInputClass, wizardPremiumTextareaClass } from "./WizardPremiumFormField";
import { WizardPremiumUploadZone } from "./WizardPremiumUploadZone";

export interface ContestWizardStepOnePremiumProps {
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  coverImageUrl: string;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onShortDescriptionChange: (value: string) => void;
  onFullDescriptionChange: (value: string) => void;
  onCoverDataUrl: (url: string) => void;
  onCoverClear: () => void;
  fieldErrors?: Record<string, string>;
}

/**
 * Paso 1: portada primero, luego datos y descripción.
 */
export function ContestWizardStepOnePremium({
  title,
  slug,
  shortDescription,
  fullDescription,
  coverImageUrl,
  onTitleChange,
  onSlugChange,
  onShortDescriptionChange,
  onFullDescriptionChange,
  onCoverDataUrl,
  onCoverClear,
  fieldErrors = {},
}: ContestWizardStepOnePremiumProps) {
  return (
    <div className="flex w-full flex-col gap-10">
      <WizardSectionCardPremium
        title="Imagen de portada"
        description="Subí una imagen que represente visualmente el concurso en listados y portada."
      >
        <WizardPremiumUploadZone
          previewUrl={coverImageUrl || null}
          onDataUrl={onCoverDataUrl}
          onClear={onCoverClear}
        />
      </WizardSectionCardPremium>

      <WizardSectionCardPremium
        title="Datos principales"
        description="Definí el nombre visible y el identificador único del concurso."
      >
        <div className="flex flex-col gap-6">
          <WizardPremiumFormField
            id="cw-title"
            label="Título"
            required
            error={fieldErrors.title}
          >
            <input
              id="cw-title"
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Ej: Concurso de Naturaleza 2025"
              className={wizardPremiumInputClass}
              autoComplete="off"
              aria-invalid={!!fieldErrors.title}
            />
          </WizardPremiumFormField>

          <WizardPremiumFormField
            id="cw-slug"
            label="Slug (identificador único)"
            required
            hint="Se usará en la URL pública del concurso"
            error={fieldErrors.slug}
          >
            <input
              id="cw-slug"
              type="text"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value.toLowerCase())}
              placeholder="concurso-naturaleza-2025"
              className={wizardPremiumInputClass}
              autoComplete="off"
              aria-invalid={!!fieldErrors.slug}
            />
          </WizardPremiumFormField>
        </div>
      </WizardSectionCardPremium>

      <WizardSectionCardPremium
        title="Descripción"
        description="Escribí un resumen breve y, si querés, el detalle completo para participantes."
      >
        <div className="flex flex-col gap-6">
          <WizardPremiumFormField
            id="cw-short"
            label="Descripción breve"
            required
            error={fieldErrors.shortDescription}
          >
            <textarea
              id="cw-short"
              rows={3}
              value={shortDescription}
              onChange={(e) => onShortDescriptionChange(e.target.value)}
              placeholder="Resumen corto que verán los participantes"
              className={wizardPremiumTextareaClass}
              aria-invalid={!!fieldErrors.shortDescription}
            />
          </WizardPremiumFormField>

          <WizardPremiumFormField id="cw-full" label="Descripción completa">
            <textarea
              id="cw-full"
              rows={5}
              value={fullDescription}
              onChange={(e) => onFullDescriptionChange(e.target.value)}
              placeholder="Bases, criterios, premios, condiciones generales…"
              className={`${wizardPremiumTextareaClass} min-h-[8rem]`}
            />
          </WizardPremiumFormField>
        </div>
      </WizardSectionCardPremium>
    </div>
  );
}
