"use client";

import CityPicker, { type PickedCity } from "./CityPicker";

export interface ProfileState {
  firstName: string;
  lastName: string;
  whatsapp: string;
  instagram: string;
  company: string;
  city: PickedCity | null;
  jobAlerts: boolean;
}

export const EMPTY_PROFILE: ProfileState = { firstName: "", lastName: "", whatsapp: "", instagram: "", company: "", city: null, jobAlerts: false };

/** Lo que se manda a la API (la ciudad va desarmada con su ubicación). */
export function profilePayload(p: ProfileState) {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    whatsapp: p.whatsapp,
    instagram: p.instagram,
    company: p.company,
    city: p.city?.city ?? "",
    province: p.city?.province ?? "",
    country: p.city?.country ?? "",
    latitude: p.city?.latitude ?? null,
    longitude: p.city?.longitude ?? null,
    jobAlerts: p.jobAlerts,
  };
}

function Field({ id, label, value, onChange, error, hint, ...rest }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id">) {
  return (
    <div className="cod-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} {...rest} />
      {hint && !error ? <span className="cod-field__hint">{hint}</span> : null}
      {error ? <span className="cod-field__error">{error}</span> : null}
    </div>
  );
}

/** Datos del fotógrafo: los mismos en el registro y en "completá tus datos". */
export default function ProfileFields({ value, onChange, errors }: { value: ProfileState; onChange: (p: ProfileState) => void; errors: Record<string, string> }) {
  const set = (patch: Partial<ProfileState>) => onChange({ ...value, ...patch });
  return (
    <>
      <div className="cod-field-row">
        <Field id="cod-first" label="Nombre" value={value.firstName} onChange={(v) => set({ firstName: v })} error={errors.firstName} autoComplete="given-name" />
        <Field id="cod-last" label="Apellido" value={value.lastName} onChange={(v) => set({ lastName: v })} error={errors.lastName} autoComplete="family-name" />
      </div>
      <div className="cod-field-row">
        <Field id="cod-wa" label="WhatsApp" value={value.whatsapp} onChange={(v) => set({ whatsapp: v })} error={errors.whatsapp} hint="Con código de área, por ejemplo 341 5123456" type="tel" autoComplete="tel" />
        <Field id="cod-ig" label="Instagram (opcional)" value={value.instagram} onChange={(v) => set({ instagram: v })} error={errors.instagram} placeholder="@tuusuario" />
      </div>
      <Field id="cod-company" label="Tu empresa o estudio de fotografía" value={value.company} onChange={(v) => set({ company: v })} error={errors.company} hint="Si trabajás por tu cuenta, poné «Independiente»" autoComplete="organization" />
      <CityPicker value={value.city} onChange={(city) => set({ city })} error={errors.city} />
      <label className="cod-check cod-check--highlight">
        <input type="checkbox" checked={value.jobAlerts} onChange={(e) => set({ jobAlerts: e.target.checked })} />
        <span>
          <strong>¿Te gustaría enterarte de trabajos como fotógrafo cerca de tu ciudad?</strong>
          <br />
          Te avisamos por email o WhatsApp cuando haya un trabajo en tu zona. Lo podés desactivar cuando quieras.
        </span>
      </label>
    </>
  );
}
