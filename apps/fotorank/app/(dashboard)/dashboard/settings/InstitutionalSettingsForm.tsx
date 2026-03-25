"use client";

import { useActionState } from "react";
import {
  updateOrganizationInstitutionalProfile,
  type UpdateInstitutionalProfileResult,
} from "../../../actions/organization-institutional";
import type { ContestOrganizationProfileDTO } from "../../../lib/fotorank/organizationProfile";

async function formAction(
  _prev: UpdateInstitutionalProfileResult | null,
  formData: FormData,
): Promise<UpdateInstitutionalProfileResult> {
  return updateOrganizationInstitutionalProfile(formData);
}

const inputClass =
  "mt-2 w-full rounded-xl border border-fr-border bg-fr-card px-5 py-4 text-fr-primary placeholder:text-fr-muted-soft focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";
const labelClass = "text-lg font-semibold leading-snug text-fr-primary";

export function InstitutionalSettingsForm({ profile }: { profile: ContestOrganizationProfileDTO }) {
  const [state, action, pending] = useActionState(formAction, null);

  return (
    <form action={action} className="space-y-12">
      {state?.ok === false ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {state.error}
        </div>
      ) : null}
      {state?.ok === true ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
          Cambios guardados. La landing pública de tus concursos se actualizará en breve.
        </div>
      ) : null}

      <section className="fr-recuadro space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-fr-primary">Identidad</h2>
          <p className="mt-2 text-sm text-fr-muted">
            Estos datos se muestran en el panel y en las landings públicas de tus concursos.
          </p>
        </div>

        <div className="space-y-8">
          <div>
            <label htmlFor="name" className={labelClass}>
              Nombre institucional <span className="text-gold">*</span>
            </label>
            <input
              id="name"
              name="name"
              required
              defaultValue={profile.name}
              className={inputClass}
              autoComplete="organization"
            />
          </div>
          <div>
            <label htmlFor="shortDescription" className={labelClass}>
              Descripción corta
            </label>
            <textarea
              id="shortDescription"
              name="shortDescription"
              rows={3}
              defaultValue={profile.shortDescription ?? ""}
              placeholder="Una línea para landings y bloques de confianza"
              className={`${inputClass} min-h-[6rem] resize-y`}
            />
          </div>
          <div>
            <label htmlFor="description" className={labelClass}>
              Descripción completa
            </label>
            <textarea
              id="description"
              name="description"
              rows={6}
              defaultValue={profile.description ?? ""}
              placeholder="Misión, trayectoria, enfoque…"
              className={`${inputClass} min-h-[10rem] resize-y`}
            />
          </div>
          <div>
            <label htmlFor="logoUrl" className={labelClass}>
              URL del logo
            </label>
            <input
              id="logoUrl"
              name="logoUrl"
              type="url"
              defaultValue={profile.logoUrl ?? ""}
              placeholder="https://…"
              className={inputClass}
            />
            <p className="mt-2 text-sm text-fr-muted">PNG o SVG con fondo transparente recomendado.</p>
          </div>
          <div>
            <label htmlFor="coverImageUrl" className={labelClass}>
              URL de portada / cabecera institucional
            </label>
            <input
              id="coverImageUrl"
              name="coverImageUrl"
              type="url"
              defaultValue={profile.coverImageUrl ?? ""}
              placeholder="https://…"
              className={inputClass}
            />
            <p className="mt-2 text-sm text-fr-muted">
              Se puede usar como respaldo visual en landings si el concurso no tiene portada propia.
            </p>
          </div>
        </div>
      </section>

      <section className="fr-recuadro space-y-8">
        <h2 className="text-xl font-semibold text-fr-primary">Contacto y presencia</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <label htmlFor="contactEmail" className={labelClass}>
              Email de contacto
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={profile.contactEmail ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>
              Teléfono
            </label>
            <input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="whatsapp" className={labelClass}>
              WhatsApp
            </label>
            <input
              id="whatsapp"
              name="whatsapp"
              placeholder="+54 9 11 1234-5678 o enlace wa.me"
              defaultValue={profile.whatsapp ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="website" className={labelClass}>
              Sitio web
            </label>
            <input id="website" name="website" type="url" defaultValue={profile.website ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="instagram" className={labelClass}>
              Instagram
            </label>
            <input
              id="instagram"
              name="instagram"
              placeholder="@cuenta o URL"
              defaultValue={profile.instagram ?? ""}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="address" className={labelClass}>
              Dirección
            </label>
            <input id="address" name="address" defaultValue={profile.address ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="city" className={labelClass}>
              Ciudad
            </label>
            <input id="city" name="city" defaultValue={profile.city ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="country" className={labelClass}>
              País
            </label>
            <input id="country" name="country" defaultValue={profile.country ?? ""} className={inputClass} />
          </div>
        </div>
      </section>

      <div className="fr-content-to-actions mt-16 flex justify-end border-t border-fr-border pt-8">
        <button
          type="submit"
          disabled={pending}
          className="fr-btn fr-btn-primary min-w-[12rem] disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
