"use client";

import { useState } from "react";
import { WEBSITE_TEMPLATES, type LayoutPreviewBand, type SiteTemplate } from "@/lib/website/templates";
import type { FotofficeOrganizationTypeId } from "@/lib/onboarding-constants";
import type { ModoAplicarPlantilla } from "@/lib/website/apply-template";

/**
 * Panel "Plantillas". La plantilla NUNCA es dueña del contenido (ver `apply-template.ts`): en un
 * sitio vacío arma el sitio completo (`todo`); en un sitio con contenido se elige entre «Sólo el
 * diseño» (lo de siempre) y «Diseño y páginas que falten», que suma las páginas de muestra cuya
 * dirección no exista — nunca pisa ni borra nada. Confirmación in-line (no `window.confirm`)
 * sólo cuando ya hay contenido.
 */
export function TemplatePickerPanel({
  hasContent,
  canEdit,
  organizationType,
  onApply,
}: {
  hasContent: boolean;
  canEdit: boolean;
  organizationType: FotofficeOrganizationTypeId | null;
  onApply: (template: SiteTemplate, modo: ModoAplicarPlantilla) => void;
}) {
  const [appliedFlash, setAppliedFlash] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function apply(template: SiteTemplate, modo: ModoAplicarPlantilla) {
    onApply(template, modo);
    setConfirmingId(null);
    setAppliedFlash(template.id);
    setTimeout(() => setAppliedFlash(null), 2500);
  }

  function handleClick(template: SiteTemplate) {
    if (hasContent) {
      setConfirmingId(template.id);
      return;
    }
    apply(template, "todo");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3 border-b border-[var(--fo-border)] space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">Plantillas</p>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          {hasContent
            ? "Tu sitio ya tiene contenido — una plantilla cambia el estilo y, si querés, suma las páginas que falten. Nunca borra ni pisa nada."
            : "Elegí un punto de partida. Vas a poder cambiar todo después."}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {WEBSITE_TEMPLATES.map((template) => {
          const recommended = organizationType ? template.recommendedFor.includes(organizationType) : false;
          return (
            <div key={template.id} className="fo-card space-y-2.5">
              <LayoutThumbnail bands={template.layoutPreview} />
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--fo-text)]">{template.nombre}</p>
                {recommended ? (
                  <span className="shrink-0 rounded-full bg-[var(--fo-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--fo-accent)]">
                    Recomendada
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-[var(--fo-muted)] leading-relaxed">{template.descripcion}</p>

              {canEdit ? (
                confirmingId === template.id ? (
                  <div className="space-y-2 rounded-lg border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-2.5">
                    <p className="text-xs text-[var(--fo-warning)] leading-relaxed">
                      Cambia el diseño general y conserva tus secciones y páginas.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button type="button" className="fo-btn fo-btn-primary text-xs justify-center" onClick={() => apply(template, "solo-diseno")}>
                        Sólo el diseño
                      </button>
                      <button type="button" className="fo-btn fo-btn-secondary text-xs justify-center" onClick={() => apply(template, "diseno-y-paginas")}>
                        Diseño y páginas de muestra que falten
                      </button>
                      <button type="button" className="fo-btn fo-btn-ghost text-xs justify-center" onClick={() => setConfirmingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="fo-btn fo-btn-secondary text-xs w-full justify-center" onClick={() => handleClick(template)}>
                    {appliedFlash === template.id ? "Aplicada ✓" : hasContent ? "Usar este estilo" : "Usar esta plantilla"}
                  </button>
                )
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Miniatura abstracta del layout — franjas proporcionales al tipo de bloque, no una imagen
 * generada. Suficiente para distinguir plantillas de un vistazo sin depender de assets. */
function LayoutThumbnail({ bands }: { bands: LayoutPreviewBand[] }) {
  const heights: Record<LayoutPreviewBand, string> = { hero: "h-8", text: "h-4", image: "h-6", cta: "h-5" };
  const tones: Record<LayoutPreviewBand, string> = {
    hero: "bg-[var(--fo-text)]",
    text: "bg-[var(--fo-border-strong)]",
    image: "bg-[var(--fo-muted-soft)]",
    cta: "bg-[var(--fo-accent)]",
  };
  return (
    <div className="space-y-1 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] p-2" aria-hidden="true">
      {bands.map((band, i) => (
        <div key={i} className={`rounded-sm ${heights[band]} ${tones[band]} opacity-70`} />
      ))}
    </div>
  );
}
