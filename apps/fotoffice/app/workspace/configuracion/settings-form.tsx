"use client";

import { useActionState } from "react";
import {
  FOTOFFICE_ORGANIZATION_TYPES,
  FOTOFFICE_SPECIALTIES,
} from "@/lib/onboarding-constants";
import { EMAIL_SIGNATURE_NOTE_MAX } from "@/lib/communications/constants";
import { ImageUploadField } from "@/components/image-upload-field";
import { updateWorkspaceSettingsAction, type SettingsState } from "./actions";

type Initial = {
  commercialName: string;
  publicSlug: string;
  contactEmail: string;
  phone: string;
  whatsapp: string;
  city: string;
  province: string;
  country: string;
  website: string;
  instagram: string;
  emailSignatureNote: string;
  activityType: string;
  specialties: string[];
  logoUrl: string | null;
  coverImageUrl: string | null;
  displayName: string;
};

export function WorkspaceSettingsForm({ initial, canEdit }: { initial: Initial; canEdit: boolean }) {
  const [state, action, pending] = useActionState(
    updateWorkspaceSettingsAction,
    undefined as SettingsState | undefined,
  );

  return (
    <form action={action} className="fo-card space-y-6">
      <fieldset disabled={!canEdit} className="space-y-6 border-0 p-0 m-0">
        <Field label="Nombre visible (propietario)" name="displayName" defaultValue={initial.displayName} />
        <Field
          label="Nombre comercial"
          name="commercialName"
          defaultValue={initial.commercialName}
          required
        />
        <Field
          label="Slug público del workspace"
          name="publicSlug"
          defaultValue={initial.publicSlug}
          required
          helper="Único en toda la plataforma. Solo minúsculas, números y guiones. Se usa en /w/[slug]/…"
          className="font-mono text-sm"
        />
        <label className="block space-y-3">
          <span className="text-sm font-semibold">Tipo de organización</span>
          <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
            Esto nos ayuda a adaptar FotoOffice a tu actividad. Después vas a poder elegir qué
            módulos querés utilizar.
          </p>
          <select
            name="activityType"
            defaultValue={initial.activityType}
            className="w-full rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 text-sm"
          >
            {FOTOFFICE_ORGANIZATION_TYPES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Field label="Email de contacto" name="contactEmail" defaultValue={initial.contactEmail} />
        <Field label="Teléfono" name="phone" defaultValue={initial.phone} />
        <Field label="WhatsApp" name="whatsapp" defaultValue={initial.whatsapp} />
        <Field label="Ciudad" name="city" defaultValue={initial.city} />
        <Field label="Provincia" name="province" defaultValue={initial.province} />
        <Field label="País" name="country" defaultValue={initial.country} />
        <Field label="Sitio web" name="website" defaultValue={initial.website} />
        <Field label="Instagram" name="instagram" defaultValue={initial.instagram} />
        <label className="block space-y-3">
          <span className="text-sm font-semibold">Nota institucional del pie de los emails</span>
          <textarea
            name="emailSignatureNote"
            defaultValue={initial.emailSignatureNote}
            rows={4}
            maxLength={EMAIL_SIGNATURE_NOTE_MAX}
            className="w-full rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 text-sm"
          />
          <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
            Se agrega al final de los emails que envía el workspace: razón social, CUIT,
            personería o aviso legal. Texto plano — las etiquetas HTML se muestran tal cual.
            Máximo {EMAIL_SIGNATURE_NOTE_MAX} caracteres.
          </p>
        </label>
        <div className="grid gap-6 sm:grid-cols-2">
          <ImageUploadField
            name="logoUrl"
            presetKey="workspaceLogo"
            label="Logo"
            initialUrl={initial.logoUrl}
          />
          <ImageUploadField
            name="coverImageUrl"
            presetKey="workspaceCover"
            label="Portada"
            initialUrl={initial.coverImageUrl}
          />
        </div>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Especialidades</legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {FOTOFFICE_SPECIALTIES.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="specialties"
                  value={s.id}
                  defaultChecked={initial.specialties.includes(s.id)}
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-green-700">Guardado.</p> : null}
      {canEdit ? (
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      ) : null}
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  helper,
  className,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  helper?: string;
  className?: string;
}) {
  return (
    <label className="block space-y-3">
      <span className="text-sm font-semibold">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className={[
          "w-full rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 text-sm",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {helper ? <p className="text-xs text-[var(--fo-muted)] leading-relaxed">{helper}</p> : null}
    </label>
  );
}
