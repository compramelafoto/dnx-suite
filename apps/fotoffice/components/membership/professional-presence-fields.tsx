"use client";

import { useState } from "react";
import { ESPECIALIDADES, MAX_ESPECIALIDADES } from "@/lib/membership/specialties";

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
};

export function ProfessionalPresenceFields({
  institutionName,
  defaults,
  intro,
}: {
  institutionName: string;
  /** Valores actuales, cuando el socio edita su perfil desde el portal. */
  defaults?: PresenciaDefaults;
  /** Texto de encabezado. El alta explica para qué se piden; el portal ya no hace falta. */
  intro?: string;
}) {
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
        <div className="flex flex-wrap gap-2">
          {ESPECIALIDADES.map((e) => {
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
            Autorizo a publicar estos datos en el directorio de socios
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
