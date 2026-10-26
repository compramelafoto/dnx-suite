"use client";

import { useEffect, useRef, useState } from "react";
import { WEBSITE_TEMPLATES, type SiteTemplate } from "@/lib/website/templates";
import type { FotofficeOrganizationTypeId } from "@/lib/onboarding-constants";
import type { ModoAplicarPlantilla } from "@/lib/website/apply-template";

/**
 * Panel "Plantillas". La plantilla NUNCA es dueña del contenido (ver `apply-template.ts`): en un
 * sitio vacío arma el sitio completo (`todo`); en un sitio con contenido se elige entre «Sólo el
 * diseño» (lo de siempre) y «Diseño y páginas que falten», que suma las páginas de muestra cuya
 * dirección no exista — nunca pisa ni borra nada. Confirmación in-line (no `window.confirm`)
 * sólo cuando ya hay contenido.
 *
 * Los colores sugeridos de la plantilla pisarían la marca del dueño: se usan sólo si tilda la
 * casilla, que arranca tildada únicamente si su marca sigue con los colores por defecto.
 *
 * Cada tarjeta muestra la plantilla de verdad: su vista previa (`/website/plantillas/<id>/preview`)
 * en un iframe achicado con `transform: scale`, que se carga recién cuando la tarjeta aparece.
 */
export function TemplatePickerPanel({
  hasContent,
  coloresPorDefecto,
  canEdit,
  organizationType,
  onApply,
}: {
  hasContent: boolean;
  /** La marca todavía tiene los colores por defecto: ahí la casilla de colores arranca tildada. */
  coloresPorDefecto: boolean;
  canEdit: boolean;
  organizationType: FotofficeOrganizationTypeId | null;
  onApply: (template: SiteTemplate, modo: ModoAplicarPlantilla, aplicarColoresSugeridos: boolean) => Promise<boolean>;
}) {
  const [appliedFlash, setAppliedFlash] = useState<{ id: string; ok: boolean } | null>(null);
  const [applying, setApplying] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // Por plantilla: si el dueño quiere también sus colores. Sin tocar, sólo si nunca eligió los suyos.
  const [usarColores, setUsarColores] = useState<Record<string, boolean>>({});
  const coloresDe = (template: SiteTemplate) => Boolean(template.coloresSugeridos) && (usarColores[template.id] ?? coloresPorDefecto);

  // «Aplicada ✓» sólo si de verdad se aplicó: sin lo pendiente guardado, el constructor no la aplica.
  async function apply(template: SiteTemplate, modo: ModoAplicarPlantilla) {
    if (applying) return;
    setApplying(true);
    let ok = false;
    try {
      ok = await onApply(template, modo, coloresDe(template));
    } finally {
      setApplying(false);
    }
    setConfirmingId(null);
    setAppliedFlash({ id: template.id, ok });
    setTimeout(() => setAppliedFlash(null), ok ? 2500 : 5000);
  }

  function handleClick(template: SiteTemplate) {
    if (hasContent) {
      setConfirmingId(template.id);
      return;
    }
    void apply(template, "todo");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3 border-b border-[var(--fo-border)] space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">Plantillas</p>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          {hasContent
            ? "Tu sitio ya tiene contenido — una plantilla cambia el estilo y, si querés, suma las páginas que falten. Nunca borra ni pisa nada."
            : "Elegí un punto de partida: trae páginas, textos y fotos de muestra para reemplazar por los tuyos."}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3">
        {WEBSITE_TEMPLATES.map((template) => {
          const recommended = organizationType ? template.recommendedFor.includes(organizationType) : false;
          const previewHref = `/website/plantillas/${template.id}/preview`;
          return (
            <div key={template.id} className="fo-card min-w-0 space-y-2.5">
              <TemplateThumbnail src={`${previewHref}?miniatura=1`} title={`Vista previa de la plantilla ${template.nombre}`} />
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--fo-text)]">{template.nombre}</p>
                {recommended ? (
                  <span className="shrink-0 rounded-full bg-[var(--fo-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--fo-accent)]">
                    Recomendada
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-[var(--fo-muted)] leading-relaxed">{template.descripcion}</p>
              <p className="text-[11px] text-[var(--fo-muted)] leading-relaxed">{template.paraQuien}</p>
              <a href={previewHref} target="_blank" rel="noopener" className="inline-flex text-xs font-medium text-[var(--fo-accent)] underline-offset-2 hover:underline">
                Ver en grande ↗
              </a>

              {canEdit ? (
                <>
                  {template.coloresSugeridos ? (
                    <label className="flex items-start gap-2 text-xs text-[var(--fo-text)] leading-snug">
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0"
                        checked={coloresDe(template)}
                        onChange={(e) => setUsarColores((prev) => ({ ...prev, [template.id]: e.target.checked }))}
                      />
                      <span className="min-w-0">
                        Usar también los colores sugeridos de la plantilla
                        <span className="mt-1 flex gap-1" aria-hidden="true">
                          {Object.values(template.coloresSugeridos).map((color, i) => (
                            <span key={i} className="h-3 w-3 rounded-full border border-[var(--fo-border)]" style={{ backgroundColor: color }} />
                          ))}
                        </span>
                      </span>
                    </label>
                  ) : null}
                  {confirmingId === template.id ? (
                    <div className="space-y-2 rounded-lg border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-2.5">
                      <p className="text-xs text-[var(--fo-warning)] leading-relaxed">
                        Cambia el diseño general y conserva tus secciones y páginas.
                        {coloresDe(template) ? " También cambia los colores de tu sitio." : ""}
                      </p>
                      <div className="flex flex-col gap-2">
                        <button type="button" className="fo-btn fo-btn-primary text-xs justify-center" disabled={applying} onClick={() => void apply(template, "solo-diseno")}>
                          Sólo el diseño
                        </button>
                        <button type="button" className="fo-btn fo-btn-secondary text-xs justify-center" disabled={applying} onClick={() => void apply(template, "diseno-y-paginas")}>
                          Diseño y páginas de muestra que falten
                        </button>
                        <button type="button" className="fo-btn fo-btn-ghost text-xs justify-center" onClick={() => setConfirmingId(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        className="fo-btn fo-btn-secondary text-xs w-full justify-center"
                        disabled={applying}
                        onClick={() => handleClick(template)}
                      >
                        {appliedFlash?.id === template.id && appliedFlash.ok ? "Aplicada ✓" : hasContent ? "Usar esta plantilla…" : "Usar esta plantilla"}
                      </button>
                      {appliedFlash?.id === template.id && !appliedFlash.ok ? (
                        <p role="alert" className="text-xs text-[var(--fo-danger,#b91c1c)] leading-relaxed">
                          No se pudo aplicar: primero tiene que guardarse lo que cambiaste. Probá de nuevo en un momento.
                        </p>
                      ) : null}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Ancho al que se dibuja la vista previa antes de achicarla: el de una pantalla de escritorio. */
const ANCHO_VISTA = 1280;
/** Proporción de la miniatura (alto / ancho). */
const PROPORCION = 0.75;

/**
 * La vista previa real, achicada al ancho de la tarjeta. El iframe no recibe clics ni foco: es
 * una imagen viva, para navegarla está «Ver en grande». Se monta recién cuando la tarjeta entra
 * en pantalla (y además con `loading="lazy"`), así abrir el panel no carga cinco sitios de golpe.
 */
function TemplateThumbnail({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = new ResizeObserver(([entry]) => setAncho(entry.contentRect.width));
    medir.observe(el);
    const aparecer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          aparecer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    aparecer.observe(el);
    return () => {
      medir.disconnect();
      aparecer.disconnect();
    };
  }, []);

  const escala = ancho > 0 ? ancho / ANCHO_VISTA : 0;
  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)]"
      style={{ aspectRatio: `${1 / PROPORCION}` }}
    >
      {visible && escala > 0 ? (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          tabIndex={-1}
          aria-hidden="true"
          className="absolute left-0 top-0 border-0"
          style={{
            width: ANCHO_VISTA,
            height: ANCHO_VISTA * PROPORCION,
            transform: `scale(${escala})`,
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
        />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-[var(--fo-surface-muted,var(--fo-border))]" aria-hidden="true" />
      )}
    </div>
  );
}
