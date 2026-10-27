"use client";

import { startTransition, useActionState, useEffect, type CSSProperties } from "react";
import { submitSiteForm, type SiteFormState } from "@/app/actions/site-form";
import { CampoTrampa } from "@/components/consultas/campo-trampa";
import { FORM_DEFAULT_BUTTON_LABEL, type FormBlockConfig } from "@/lib/website/blocks";
import {
  camposConClave,
  MAX_EMAIL,
  MAX_TELEFONO,
  MAX_VALOR_CORTO,
  MAX_VALOR_LARGO,
  mensajeDeGracias,
  nombreDelInput,
  tipoEfectivo,
  type ContenidoRevelado,
} from "@/lib/website/formularios";
import { levelStyle } from "@/lib/website/typography";

const ESTADO_INICIAL: SiteFormState = { status: "idle" };

/** Los campos toman el color principal del sitio en el borde al enfocarse y en el botón. */
const MARCA = { "--fo-accent": "var(--wsite-primary)", "--fo-accent-hover": "var(--wsite-primary)", accentColor: "var(--wsite-primary)" } as CSSProperties;

const BOTON: CSSProperties = {
  ...levelStyle("button", { color: false }),
  backgroundColor: "var(--wsite-primary)",
  color: "#ffffff",
  borderRadius: "var(--wsite-button-radius)",
  paddingInline: "var(--wsite-button-padding-x)",
  paddingBlock: "var(--wsite-button-padding-y)",
};

function Revelado({ contenido }: { contenido: ContenidoRevelado }) {
  const externo = contenido.enlace ? /^https:/i.test(contenido.enlace.href) : false;
  return (
    <div className="space-y-4 rounded-[var(--wsite-button-radius)] border p-6 text-center" style={{ borderColor: "var(--wsite-primary)" }}>
      {contenido.texto ? (
        <p className="whitespace-pre-line leading-relaxed" style={levelStyle("body", { color: true })}>
          {contenido.texto}
        </p>
      ) : null}
      {contenido.enlace ? (
        <a href={contenido.enlace.href} className="inline-flex" style={BOTON} {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {contenido.enlace.etiqueta}
        </a>
      ) : null}
    </div>
  );
}

/**
 * La parte de cliente del bloque FORM (ver `form-block-view.tsx`). Envía con `submitSiteForm`,
 * que valida contra el bloque publicado. El envío va por `onSubmit` y no por `<form action>`: con
 * `action`, React vacía el formulario al terminar y, si hubo un error, se perdería lo escrito.
 */
export function FormBlockClient({
  config,
  blockId,
  workspaceSlug,
  preview,
  redirectHref,
  ocultoDeMuestra,
}: {
  config: FormBlockConfig;
  blockId: string;
  workspaceSlug: string;
  preview: boolean;
  redirectHref: string | null;
  ocultoDeMuestra: ContenidoRevelado | null;
}) {
  const [state, dispatch, pending] = useActionState(submitSiteForm, ESTADO_INICIAL);
  const campos = camposConClave(config.fields);
  const id = (clave: string) => `frm-${blockId || "x"}-${clave}`;
  const labelStyle = levelStyle("body", { color: true });
  const ok = state.status === "ok";

  useEffect(() => {
    if (ok && config.afterSubmit === "redirect" && redirectHref) window.location.assign(redirectHref);
  }, [ok, config.afterSubmit, redirectHref]);

  return (
    <section className="px-6 py-14" style={MARCA}>
      <div className="mx-auto max-w-2xl space-y-6">
        {config.title.trim() || config.intro.trim() ? (
          <div className="space-y-3">
            {config.title.trim() ? (
              <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
            ) : null}
            {config.intro.trim() ? (
              <p className="whitespace-pre-line leading-relaxed" style={levelStyle("body", { color: true })}>
                {config.intro}
              </p>
            ) : null}
          </div>
        ) : null}

        {state.status === "ok" ? (
          state.revelado ? (
            <Revelado contenido={state.revelado} />
          ) : (
            <p role="status" className="rounded-[var(--wsite-button-radius)] border p-6 text-center" style={{ ...labelStyle, borderColor: "var(--wsite-primary)" }}>
              {config.afterSubmit === "redirect" && redirectHref ? "Enviado. Te llevamos…" : mensajeDeGracias(config)}
            </p>
          )
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (preview) return;
              const fd = new FormData(e.currentTarget);
              startTransition(() => dispatch(fd));
            }}
          >
            <fieldset disabled={preview || pending} className="space-y-4">
              <CampoTrampa />
              <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
              <input type="hidden" name="blockId" value={blockId} />
              {campos.map((campo) => {
                const tipo = tipoEfectivo(campo);
                const name = nombreDelInput(campo.clave);
                const ayuda = campo.help.trim() ? (
                  <p className="text-sm opacity-70" style={labelStyle} id={`${id(campo.clave)}-ayuda`}>
                    {campo.help}
                  </p>
                ) : null;
                const describedBy = campo.help.trim() ? `${id(campo.clave)}-ayuda` : undefined;
                if (tipo === "checkbox") {
                  return (
                    <div key={campo.clave} className="space-y-1">
                      <label className="flex items-start gap-2" style={labelStyle}>
                        <input type="checkbox" name={name} value="on" required={campo.required} aria-describedby={describedBy} className="mt-1" />
                        <span>
                          {campo.etiquetaVisible}
                          {campo.required ? " *" : ""}
                        </span>
                      </label>
                      {ayuda}
                    </div>
                  );
                }
                const comunes = { id: id(campo.clave), name, required: campo.required, className: "fo-input", "aria-describedby": describedBy };
                return (
                  <div key={campo.clave} className="fo-field-stack">
                    <label htmlFor={id(campo.clave)} style={labelStyle}>
                      {campo.etiquetaVisible}
                      {campo.required ? " *" : ""}
                    </label>
                    {tipo === "textarea" ? (
                      <textarea {...comunes} rows={4} maxLength={MAX_VALOR_LARGO} />
                    ) : tipo === "select" ? (
                      <select {...comunes} defaultValue="">
                        <option value="" disabled={campo.required}>
                          Elegí una opción
                        </option>
                        {campo.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : tipo === "email" ? (
                      <input {...comunes} type="email" maxLength={MAX_EMAIL} autoComplete="email" />
                    ) : tipo === "phone" ? (
                      <input {...comunes} type="tel" maxLength={MAX_TELEFONO} autoComplete="tel" />
                    ) : tipo === "number" ? (
                      <input {...comunes} type="number" step="any" inputMode="decimal" />
                    ) : tipo === "date" ? (
                      <input {...comunes} type="date" />
                    ) : (
                      <input {...comunes} type="text" maxLength={MAX_VALOR_CORTO} />
                    )}
                    {ayuda}
                  </div>
                );
              })}
            </fieldset>

            {state.status === "error" ? (
              <p role="alert" className="text-sm text-[var(--fo-danger)]">
                {state.error}
              </p>
            ) : null}

            <button type="submit" disabled={preview || pending || campos.length === 0} className="w-full disabled:opacity-60" style={BOTON}>
              {pending ? "Enviando…" : config.buttonLabel.trim() || FORM_DEFAULT_BUTTON_LABEL}
            </button>
            {preview ? (
              <div className="space-y-3 text-center text-xs opacity-70" style={labelStyle}>
                <p>Vista previa: el formulario se puede completar en el sitio publicado.</p>
                {campos.length === 0 ? <p>Agregá al menos un campo en el panel.</p> : null}
                {ocultoDeMuestra ? (
                  <>
                    <p>Después de enviar se va a ver esto:</p>
                    <Revelado contenido={ocultoDeMuestra} />
                  </>
                ) : null}
              </div>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}
