"use client";

import { useState } from "react";
import { especialidadesPorGrupo, MAX_ESPECIALIDADES } from "@/lib/membership/specialties";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";

/**
 * Presencia profesional del aspirante: rubros, estudio, redes y sitio.
 *
 * Todo opcional. Es información que la institución quiere tener desde el día uno —pedirla
 * después significa escribirle a cada socio de a uno—, pero ninguno de estos campos vale
 * perder una solicitud.
 */
export type PresenciaDefaults = {
  businessName?: string | null;
  bio?: string | null;
  specialties?: readonly string[];
  website?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  directoryOptIn?: boolean;
  studioStreet?: string | null;
  studioCity?: string | null;
  studioProvince?: string | null;
  studioPostalCode?: string | null;
  studioMapsUrl?: string | null;
};

export function ProfessionalPresenceFields({
  institutionName,
  defaults,
  intro,
  vocabulary,
}: {
  institutionName: string;
  /** Valores actuales, cuando el socio edita su perfil desde el portal. */
  defaults?: PresenciaDefaults;
  /** Texto de encabezado. El alta explica para qué se piden; el portal ya no hace falta. */
  intro?: string;
  /** El vocabulario del workspace: sus dos callers (alta pública y portal) ya lo cargan. */
  vocabulary: PersonVocabulary;
}) {
  const v = vocabulary;
  const [elegidas, setElegidas] = useState<string[]>([
    ...(defaults?.specialties ?? []),
  ]);

  const alTope = elegidas.length >= MAX_ESPECIALIDADES;

  function alternar(id: string) {
    setElegidas((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_ESPECIALIDADES
          ? prev
          : [...prev, id],
    );
  }

  return (
    <section className="fo-card space-y-5 p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Tu trabajo</h2>
        <p className="fo-helper">
          {intro ??
            `Nada de esto es obligatorio, pero es lo que le permite a ${institutionName} recomendarte, invitarte a lo que va con lo tuyo y difundir tu trabajo.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="businessName">
            Estudio o marca
          </label>
          <input
            id="businessName"
            name="businessName"
            className="fo-input"
            maxLength={160}
            defaultValue={defaults?.businessName ?? ""}
            placeholder="Si trabajás con un nombre distinto al tuyo"
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="website">
            Sitio web
          </label>
          <input
            id="website"
            name="website"
            className="fo-input"
            maxLength={500}
            inputMode="url"
            defaultValue={defaults?.website ?? ""}
            placeholder="miestudio.com.ar"
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="fo-label">
          ¿A qué te dedicás?{" "}
          <span className="font-normal text-[var(--fo-muted)]">
            (hasta {MAX_ESPECIALIDADES}
            {elegidas.length > 0 ? ` · elegiste ${elegidas.length}` : ""})
          </span>
        </legend>
        {/*
          El orden de elección es el orden de relevancia, y por eso se numera a la vista. Sin el
          número, una persona que marca cinco rubros no tiene forma de saber que el primero pesa
          más, ni de corregirlo.
        */}
        <p className="fo-helper">
          Marcalos en orden: el primero es a lo que más te dedicás. Para cambiar el orden,
          desmarcá y volvé a marcar.
        </p>
        <div className="space-y-3">
          {especialidadesPorGrupo().map((grupo) => (
            <div key={grupo.id} className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--fo-muted-soft)]">
                {grupo.label}
              </p>
              <div className="flex flex-wrap gap-2">
          {grupo.items.map((e) => {
            const posicion = elegidas.indexOf(e.id);
            const activa = posicion >= 0;
            return (
              <label
                key={e.id}
                className={[
                  "cursor-pointer rounded-full border px-3 py-1.5 text-xs transition",
                  activa
                    ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white"
                    : "border-[var(--fo-border)] text-[var(--fo-muted)] hover:border-[var(--fo-accent)]",
                  !activa && alTope ? "cursor-not-allowed opacity-40 hover:border-[var(--fo-border)]" : "",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  name="specialties"
                  value={e.id}
                  checked={activa}
                  disabled={!activa && alTope}
                  onChange={() => alternar(e.id)}
                  className="sr-only"
                />
                {activa ? (
                  <span
                    aria-hidden
                    className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[10px] font-semibold tabular-nums"
                  >
                    {posicion + 1}
                  </span>
                ) : null}
                {e.label}
                <span className="sr-only">
                  {activa ? ` — prioridad ${posicion + 1} de ${elegidas.length}` : ""}
                </span>
              </label>
            );
          })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="bio">
          Contanos brevemente sobre vos
        </label>
        <textarea
          id="bio"
          name="bio"
          className="fo-input min-h-24"
          maxLength={600}
          defaultValue={defaults?.bio ?? ""}
          placeholder="Desde cuándo trabajás, qué te gusta hacer, dónde estudiaste. Un párrafo alcanza."
        />
        <p className="fo-helper">Hasta 600 caracteres.</p>
      </div>

      {/*
        Dónde atiende. Va DESPUÉS de la presentación y antes de las redes: primero quién sos y qué
        hacés, después dónde encontrarte.

        El domicilio del estudio es distinto del particular, que vive en "Mis datos personales" y
        no se publica nunca. Acá se dice explícitamente, porque la confusión entre los dos termina
        con el domicilio de alguien publicado en internet.
      */}
      <fieldset className="space-y-3">
        <legend className="fo-label">Dónde atiende tu estudio</legend>
        <p className="fo-helper">
          Opcional, y se publica. Es lo que le permite a Google mostrarte cuando alguien busca un
          fotógrafo en tu zona. <strong>No es tu domicilio particular</strong>, que nunca se
          muestra.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack sm:col-span-2">
            <label className="fo-label" htmlFor="studioStreet">
              Calle y número
            </label>
            <input
              id="studioStreet"
              name="studioStreet"
              className="fo-input"
              maxLength={120}
              defaultValue={defaults?.studioStreet ?? ""}
              placeholder="San Martín 1234, Local 5"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="studioCity">
              Ciudad
            </label>
            <input
              id="studioCity"
              name="studioCity"
              className="fo-input"
              maxLength={120}
              defaultValue={defaults?.studioCity ?? ""}
              placeholder="Rosario"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="studioProvince">
              Provincia
            </label>
            <input
              id="studioProvince"
              name="studioProvince"
              className="fo-input"
              maxLength={120}
              defaultValue={defaults?.studioProvince ?? ""}
              placeholder="Santa Fe"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="studioPostalCode">
              Código postal
            </label>
            <input
              id="studioPostalCode"
              name="studioPostalCode"
              className="fo-input"
              maxLength={20}
              defaultValue={defaults?.studioPostalCode ?? ""}
              placeholder="2000"
            />
          </div>
          <div className="fo-field-stack sm:col-span-2">
            <label className="fo-label" htmlFor="studioMapsUrl">
              Enlace de Google Maps
            </label>
            <input
              id="studioMapsUrl"
              name="studioMapsUrl"
              className="fo-input"
              defaultValue={defaults?.studioMapsUrl ?? ""}
              placeholder="https://www.google.com/maps/@-32.9174,-60.6505,17z"
            />
            <p className="fo-helper">
              Buscá tu local en Google Maps y copiá la dirección de la barra del navegador. Con
              esto Google sabe exactamente dónde queda y te muestra en las búsquedas de
              &ldquo;fotógrafo cerca mío&rdquo;. Si pegás un enlace corto
              (<code>maps.app.goo.gl</code>), abrilo primero y copiá el largo. Si ya lo cargaste,
              acá vas a ver las coordenadas que guardamos.
            </p>
          </div>
        </div>
      </fieldset>

      <div className="space-y-3">
        <p className="fo-label">Tus redes</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ArrobaField
            id="instagram"
            label="Instagram"
            placeholder="tuusuario"
            defaultValue={defaults?.instagram}
            helper="Podés pegar el enlace completo o solo tu usuario."
          />
          <ArrobaField
            id="tiktok"
            label="TikTok"
            placeholder="tuusuario"
            defaultValue={defaults?.tiktok}
          />
          <UrlField
            id="facebook"
            label="Facebook"
            placeholder="facebook.com/tupagina"
            defaultValue={defaults?.facebook}
          />
          <UrlField
            id="youtube"
            label="YouTube"
            placeholder="youtube.com/@tucanal"
            defaultValue={defaults?.youtube}
          />
          <UrlField
            id="linkedin"
            label="LinkedIn"
            placeholder="linkedin.com/in/vos"
            defaultValue={defaults?.linkedin}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--fo-border)] p-3">
        <input
          type="checkbox"
          name="directoryOptIn"
          className="mt-0.5 h-4 w-4 shrink-0"
          defaultChecked={defaults?.directoryOptIn ?? false}
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium">
            {`Autorizo a publicar estos datos en el directorio de ${v.plural}`}
          </span>
          <span className="fo-helper block">
            Se publicarían tu nombre, tu estudio, tus rubros, tu presentación, tu sitio y tus
            redes. Nunca tu documento, tu domicilio, tu teléfono ni tu email. Podés cambiar
            esto cuando quieras desde tu portal.
          </span>
        </span>
      </label>
    </section>
  );
}

/** Campo de red donde se guarda el usuario. El arroba se muestra, no se escribe. */
function ArrobaField({
  id,
  label,
  placeholder,
  helper,
  defaultValue,
}: {
  id: string;
  label: string;
  placeholder: string;
  helper?: string;
  defaultValue?: string | null;
}) {
  return (
    <div className="fo-field-stack">
      <label className="fo-label" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <span aria-hidden className="text-sm text-[var(--fo-muted)]">
          @
        </span>
        <input
          id={id}
          name={id}
          className="fo-input flex-1"
          maxLength={200}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      {helper ? <p className="fo-helper">{helper}</p> : null}
    </div>
  );
}

/** Campo de red donde se guarda la dirección completa. */
function UrlField({
  id,
  label,
  placeholder,
  defaultValue,
}: {
  id: string;
  label: string;
  placeholder: string;
  defaultValue?: string | null;
}) {
  return (
    <div className="fo-field-stack">
      <label className="fo-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        className="fo-input"
        maxLength={500}
        inputMode="url"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  );
}
