"use client";

import { useActionState } from "react";
import {
  FOTOFFICE_ACTIVITY_TYPES,
  FOTOFFICE_SPECIALTIES,
} from "@/lib/onboarding-constants";
import { updateWorkspaceSettingsAction, type SettingsState } from "./actions";

type Initial = {
  commercialName: string;
  contactEmail: string;
  phone: string;
  city: string;
  province: string;
  country: string;
  website: string;
  instagram: string;
  activityType: string;
  specialties: string[];
  businessLogoUrl: string;
  displayName: string;
};

export function WorkspaceSettingsForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState(
    updateWorkspaceSettingsAction,
    undefined as SettingsState | undefined,
  );

  return (
    <form action={action} className="fo-card space-y-6">
      <Field label="Nombre visible (propietario)" name="displayName" defaultValue={initial.displayName} />
      <Field
        label="Nombre comercial"
        name="commercialName"
        defaultValue={initial.commercialName}
        required
      />
      <label className="block space-y-3">
        <span className="text-sm font-semibold">Tipo de actividad</span>
        <select
          name="activityType"
          defaultValue={initial.activityType}
          className="w-full rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 text-sm"
        >
          {FOTOFFICE_ACTIVITY_TYPES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <Field label="Email de contacto" name="contactEmail" defaultValue={initial.contactEmail} />
      <Field label="Teléfono" name="phone" defaultValue={initial.phone} />
      <Field label="Ciudad" name="city" defaultValue={initial.city} />
      <Field label="Provincia" name="province" defaultValue={initial.province} />
      <Field label="País" name="country" defaultValue={initial.country} />
      <Field label="Sitio web" name="website" defaultValue={initial.website} />
      <Field label="Instagram" name="instagram" defaultValue={initial.instagram} />
      <Field
        label="URL del logo del negocio (no el de FotOffice)"
        name="businessLogoUrl"
        defaultValue={initial.businessLogoUrl}
      />
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
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-green-700">Guardado.</p> : null}
      <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-3">
      <span className="text-sm font-semibold">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 text-sm"
      />
    </label>
  );
}
