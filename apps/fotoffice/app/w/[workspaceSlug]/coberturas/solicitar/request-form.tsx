"use client";

import { useActionState } from "react";
import type { CoverageBrand } from "@/lib/coverages/branding";
import type { ConsentKind } from "@/lib/coverages/consents";
import {
  visibleRequestSections,
  type RequestFormFieldConfig,
} from "@/lib/coverages/request-fields";
import {
  submitCoverageRequestAction,
  type CoverageRequestFormState,
} from "@/app/actions/coverage-request";

const inicial: CoverageRequestFormState = { error: null, ok: null };

/** Un permiso ya resuelto por el servidor: etiqueta, texto de la versión vigente y si es obligatorio. */
export type ConsentItem = {
  kind: ConsentKind;
  label: string;
  text: string;
  required: boolean;
};

/**
 * El formulario público.
 *
 * Lo completa alguien que no conoce el sistema, casi siempre desde el teléfono. De ahí las
 * decisiones de forma: una sola columna, campos táctiles de 44 px para arriba, y los permisos
 * al final con su texto completo a la vista en vez de detrás de un enlace que nadie abre.
 *
 * `useActionState` deja el botón deshabilitado mientras se envía, que es lo que evita el doble
 * pedido cuando la conexión está lenta y la persona vuelve a apretar.
 *
 * Los permisos llegan ya armados desde `page.tsx` (`ConsentItem[]`), en vez de importar acá
 * `CONSENT_KINDS`/`CONSENT_LABELS`/`REQUIRED_CONSENTS` de `lib/coverages/consents`: ese módulo
 * usa `node:crypto` (`hashConsentText`) a nivel de módulo, y Webpack no puede empaquetarlo para
 * el cliente. Sólo el tipo `ConsentKind` cruza la frontera, como `import type` — se borra en
 * la compilación y no arrastra el módulo.
 */
export function CoverageRequestForm({
  workspaceSlug,
  institutionName,
  intro,
  consents,
  fields,
  brand,
}: {
  workspaceSlug: string;
  institutionName: string;
  intro: string | null;
  consents: ConsentItem[];
  fields: RequestFormFieldConfig;
  brand: CoverageBrand | null;
}) {
  const accion = submitCoverageRequestAction.bind(null, workspaceSlug);
  const [state, formAction, pending] = useActionState(accion, inicial);
  // `lib/coverages/request-fields` sí se puede importar acá —es un módulo puro, sin `node:crypto`
  // ni Prisma— así que la pantalla resuelve qué dibujar con la misma regla que usa la acción
  // para validar. Si las dos leyeran listas distintas, el formulario pediría una cosa y el
  // servidor exigiría otra.
  const secciones = visibleRequestSections(fields);

  if (state.ok) {
    return (
      <section className="fo-card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Listo, lo recibimos</h2>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{state.ok}</p>
        {state.publicCode ? (
          <p className="text-sm">
            Tu número es{" "}
            <strong className="tabular-nums">{state.publicCode}</strong>. Anotalo por las dudas.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    // `accentColor` pinta las tildes de los permisos con el color de la institución. Es una
    // propiedad del navegador: si el color no sirviera, la tilde vuelve sola a la del sistema.
    <form
      action={formAction}
      className="space-y-8"
      style={brand ? { accentColor: brand.accent } : undefined}
    >
      {intro ? (
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{intro}</p>
      ) : null}

      {secciones.map((seccion) => (
        <fieldset key={seccion.key} className="fo-card space-y-4 p-5">
          <legend className="px-1 text-sm font-semibold">{seccion.legend}</legend>
          {seccion.fields.map((campo) => (
            <Campo
              key={campo.key}
              name={campo.key}
              label={campo.label}
              type={campo.input}
              required={campo.state === "OBLIGATORIO"}
              textarea={campo.input === "textarea"}
            />
          ))}
        </fieldset>
      ))}

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Permisos</legend>
        <p className="text-sm text-[var(--fo-muted)]">
          Leé cada uno. Los marcados con * son necesarios para que {institutionName} pueda
          tomar el pedido.
        </p>
        {consents.map((c) => (
          <label key={c.kind} className="flex gap-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              name={`consent_${c.kind}`}
              className="mt-1 size-5 shrink-0"
              required={c.required}
            />
            <span>
              <span className="font-medium">
                {c.label}
                {c.required ? " *" : ""}
              </span>
              <br />
              <span className="text-[var(--fo-muted)]">{c.text}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}

      {/*
        Con la marca cargada, el botón va con el color de la institución y el texto que se lee
        encima —blanco o negro, lo decide la luminancia y no una suposición—. Sin marca,
        `fo-btn-primary` deja el botón como el resto del sistema. `.fo-btn` a secas no pinta
        ningún fondo, así que sin la variante el botón venía transparente.
      */}
      <button
        type="submit"
        className="fo-btn fo-btn-primary min-h-12 w-full"
        disabled={pending}
        style={brand ? { background: brand.primary, color: brand.onPrimary } : undefined}
      >
        {pending ? "Enviando…" : "Enviar el pedido"}
      </button>
    </form>
  );
}

function Campo({
  name,
  label,
  type = "text",
  required = false,
  textarea = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const clases =
    "w-full min-h-11 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-base";
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </span>
      {textarea ? (
        <textarea name={name} rows={3} className={clases} required={required} />
      ) : (
        <input name={name} type={type} className={clases} required={required} />
      )}
    </label>
  );
}
