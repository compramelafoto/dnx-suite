"use client";

import { useActionState, useState, startTransition, type CSSProperties } from "react";
import { createSiteInquiry, type SiteInquiryState } from "@/app/actions/site-inquiry";
import { CampoOrigen } from "@/components/consultas/campo-origen";
import { CampoTrampa } from "@/components/consultas/campo-trampa";
import { INQUIRY_DEFAULT_BUTTON_LABEL, INQUIRY_DEFAULT_THANKS, type InquiryFormBlockConfig } from "@/lib/website/blocks";
import type { WebsiteDynamicData } from "@/lib/website/dynamic-data";
import { CATEGORIAS_DE_EJEMPLO, categoriasDelBloque, ORIGENES_DE_EJEMPLO } from "@/lib/website/inquiry-form";
import { levelStyle } from "@/lib/website/typography";

const ESTADO_INICIAL: SiteInquiryState = { status: "idle" };

/** Los campos toman el color principal del sitio en el borde al enfocarse y en el botón. */
const MARCA = { "--fo-accent": "var(--wsite-primary)", "--fo-accent-hover": "var(--wsite-primary)", accentColor: "var(--wsite-primary)" } as CSSProperties;

/**
 * Formulario de presupuesto: da de alta una consulta en Consultas (`createSiteInquiry`).
 *
 * En el sitio publicado, las categorías y orígenes llegan en `data.inquiry`; si no llegan
 * (Consultas apagado o la lectura falló) la sección no se dibuja. En la vista previa del
 * constructor no llega nada (`data` es `undefined`): se ve el formulario deshabilitado con
 * categorías de ejemplo, para que el dueño vea cómo queda sin mandar nada.
 *
 * El envío va por `onSubmit` y no por `<form action>`: con `action`, React vacía el formulario
 * al terminar y, si hubo un error, la persona perdería lo que escribió.
 */
export function InquiryFormBlockView({ config, blockId, data }: { config: InquiryFormBlockConfig; blockId?: string; data?: WebsiteDynamicData }) {
  const preview = data === undefined;
  const inquiry = data?.inquiry;
  const [state, dispatch, pending] = useActionState(createSiteInquiry, ESTADO_INICIAL);
  const [error, setError] = useState<string | null>(null);

  if (!preview && !inquiry) return null;

  const categorias = preview ? [...CATEGORIAS_DE_EJEMPLO] : categoriasDelBloque(config.categoryIds, inquiry!.categorias);
  const origenes = preview ? ORIGENES_DE_EJEMPLO : inquiry!.origenes;
  const preelegida = inquiry?.categoriaPreelegida && categorias.some((c) => c.id === inquiry.categoriaPreelegida) ? inquiry.categoriaPreelegida : "";
  const id = (campo: string) => `inq-${blockId ?? "x"}-${campo}`;
  const mensajeError = error ?? (state.status === "error" ? state.error : null);
  const labelStyle = levelStyle("body", { color: true });

  return (
    <section className="px-6 py-14" style={MARCA}>
      <div className="mx-auto max-w-2xl space-y-6">
        {config.title?.trim() || config.intro?.trim() ? (
          <div className="space-y-3">
            {config.title?.trim() ? (
              <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
            ) : null}
            {config.intro?.trim() ? (
              <p className="whitespace-pre-line leading-relaxed" style={levelStyle("body", { color: true })}>
                {config.intro}
              </p>
            ) : null}
          </div>
        ) : null}

        {state.status === "ok" ? (
          <p role="status" className="rounded-[var(--wsite-button-radius)] border p-6 text-center" style={{ ...levelStyle("body", { color: true }), borderColor: "var(--wsite-primary)" }}>
            {config.thanksMessage.trim() || INQUIRY_DEFAULT_THANKS}
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (preview) return;
              const fd = new FormData(e.currentTarget);
              if (!fd.get("email")?.toString().trim() && !fd.get("phone")?.toString().trim()) {
                setError("Dejanos un correo o un teléfono para poder responderte.");
                return;
              }
              setError(null);
              startTransition(() => dispatch(fd));
            }}
          >
            <fieldset disabled={preview || pending} className="space-y-4">
              <CampoTrampa />
              <input type="hidden" name="workspaceSlug" value={inquiry?.workspaceSlug ?? ""} />
              {categorias.length > 0 ? (
                <div className="fo-field-stack">
                  <label htmlFor={id("categoria")} style={labelStyle}>
                    ¿Qué necesitás?
                  </label>
                  <select id={id("categoria")} name="categoriaId" className="fo-input" required defaultValue={preelegida}>
                    <option value="" disabled>
                      Elegí una opción
                    </option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="fo-field-stack">
                <label htmlFor={id("name")} style={labelStyle}>
                  Nombre
                </label>
                <input id={id("name")} name="name" required maxLength={120} autoComplete="name" className="fo-input" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="fo-field-stack">
                  <label htmlFor={id("email")} style={labelStyle}>
                    Correo
                  </label>
                  <input id={id("email")} name="email" type="email" maxLength={254} autoComplete="email" className="fo-input" />
                </div>
                <div className="fo-field-stack">
                  <label htmlFor={id("phone")} style={labelStyle}>
                    WhatsApp
                  </label>
                  <input id={id("phone")} name="phone" type="tel" maxLength={40} autoComplete="tel" className="fo-input" />
                </div>
              </div>
              {config.askEventDate || config.askEventLocation ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {config.askEventDate ? (
                    <div className="fo-field-stack">
                      <label htmlFor={id("date")} style={labelStyle}>
                        Fecha del evento (si ya la tenés)
                      </label>
                      <input id={id("date")} name="eventDate" type="date" className="fo-input" />
                    </div>
                  ) : null}
                  {config.askEventLocation ? (
                    <div className="fo-field-stack">
                      <label htmlFor={id("location")} style={labelStyle}>
                        Lugar
                      </label>
                      <input id={id("location")} name="eventLocation" maxLength={200} className="fo-input" placeholder="Ciudad, salón…" />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="fo-field-stack">
                <label htmlFor={id("message")} style={labelStyle}>
                  Contanos qué estás buscando
                </label>
                <textarea id={id("message")} name="message" rows={4} maxLength={4000} className="fo-input" />
              </div>
              {config.askOrigin ? <CampoOrigen id={id("origen")} origenes={origenes} labelClassName="" labelStyle={labelStyle} /> : null}
            </fieldset>

            {mensajeError ? (
              <p role="alert" className="text-sm text-[var(--fo-danger)]">
                {mensajeError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={preview || pending}
              className="w-full disabled:opacity-60"
              style={{
                ...levelStyle("button", { color: false }),
                backgroundColor: "var(--wsite-primary)",
                color: "#ffffff",
                borderRadius: "var(--wsite-button-radius)",
                paddingInline: "var(--wsite-button-padding-x)",
                paddingBlock: "var(--wsite-button-padding-y)",
              }}
            >
              {pending ? "Enviando…" : config.buttonLabel.trim() || INQUIRY_DEFAULT_BUTTON_LABEL}
            </button>
            {preview ? (
              <p className="text-center text-xs opacity-60" style={levelStyle("body", { color: true })}>
                Vista previa: las categorías son de ejemplo. En el sitio se ven las tuyas.
              </p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}
