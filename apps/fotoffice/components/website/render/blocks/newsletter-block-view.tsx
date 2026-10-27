"use client";

import { startTransition, useActionState, type CSSProperties } from "react";
import { subscribeNewsletter, type NewsletterState } from "@/app/actions/site-form";
import { CampoTrampa } from "@/components/consultas/campo-trampa";
import { NEWSLETTER_DEFAULT_BUTTON_LABEL, NEWSLETTER_DEFAULT_THANKS, type NewsletterBlockConfig } from "@/lib/website/blocks";
import type { WebsiteDynamicData } from "@/lib/website/dynamic-data";
import { MAX_EMAIL } from "@/lib/website/formularios";
import { levelStyle } from "@/lib/website/typography";

const ESTADO_INICIAL: NewsletterState = { status: "idle" };
const MARCA = { "--fo-accent": "var(--wsite-primary)", "--fo-accent-hover": "var(--wsite-primary)", accentColor: "var(--wsite-primary)" } as CSSProperties;

/**
 * Boletín (bloque NEWSLETTER): correo (y nombre, si el bloque lo pide) → suscriptores del sitio
 * (`subscribeNewsletter`, alta idempotente). En la vista previa del constructor se ve
 * deshabilitado; en el sitio, sin `data.formularios`, no se dibuja.
 */
export function NewsletterBlockView({ config, blockId, data }: { config: NewsletterBlockConfig; blockId?: string; data?: WebsiteDynamicData }) {
  const preview = data === undefined;
  const [state, dispatch, pending] = useActionState(subscribeNewsletter, ESTADO_INICIAL);
  if (data !== undefined && !data.formularios) return null;

  const id = (campo: string) => `nl-${blockId ?? "x"}-${campo}`;
  const labelStyle = levelStyle("body", { color: true });

  return (
    <section className="px-6 py-14" style={MARCA}>
      <div className="mx-auto max-w-xl space-y-5 text-center">
        {config.title.trim() ? (
          <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
        ) : null}
        {config.intro.trim() ? (
          <p className="whitespace-pre-line leading-relaxed" style={labelStyle}>
            {config.intro}
          </p>
        ) : null}
        {state.status === "ok" ? (
          <p role="status" className="rounded-[var(--wsite-button-radius)] border p-5" style={{ ...labelStyle, borderColor: "var(--wsite-primary)" }}>
            {config.thanksMessage.trim() || NEWSLETTER_DEFAULT_THANKS}
          </p>
        ) : (
          <form
            className="space-y-3 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              if (preview) return;
              const fd = new FormData(e.currentTarget);
              startTransition(() => dispatch(fd));
            }}
          >
            <fieldset disabled={preview || pending} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <CampoTrampa />
              <input type="hidden" name="workspaceSlug" value={data?.formularios?.workspaceSlug ?? ""} />
              <input type="hidden" name="blockId" value={blockId ?? ""} />
              {config.askName ? (
                <div className="fo-field-stack flex-1">
                  <label htmlFor={id("name")} style={labelStyle}>
                    Nombre
                  </label>
                  <input id={id("name")} name="name" required maxLength={120} autoComplete="name" className="fo-input" />
                </div>
              ) : null}
              <div className="fo-field-stack flex-1">
                <label htmlFor={id("email")} style={labelStyle}>
                  Correo
                </label>
                <input id={id("email")} name="email" type="email" required maxLength={MAX_EMAIL} autoComplete="email" className="fo-input" />
              </div>
              <button
                type="submit"
                className="disabled:opacity-60"
                style={{
                  ...levelStyle("button", { color: false }),
                  backgroundColor: "var(--wsite-primary)",
                  color: "#ffffff",
                  borderRadius: "var(--wsite-button-radius)",
                  paddingInline: "var(--wsite-button-padding-x)",
                  paddingBlock: "var(--wsite-button-padding-y)",
                }}
              >
                {pending ? "Enviando…" : config.buttonLabel.trim() || NEWSLETTER_DEFAULT_BUTTON_LABEL}
              </button>
            </fieldset>
            {state.status === "error" ? (
              <p role="alert" className="text-sm text-[var(--fo-danger)]">
                {state.error}
              </p>
            ) : null}
            {preview ? (
              <p className="text-center text-xs opacity-60" style={labelStyle}>
                Vista previa: en el sitio publicado los correos llegan a Sitio web → Formularios → Suscriptores.
              </p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}
