"use client";

import { useState } from "react";
import { WEBSITE_TEMPLATES, type LayoutPreviewBand, type WebsiteTemplate } from "@/lib/website/templates";
import type { FotofficeOrganizationTypeId } from "@/lib/onboarding-constants";

/**
 * Panel "Plantillas". La plantilla NUNCA es dueña del contenido (ver `templates.ts`): en un
 * sitio vacío siembra secciones + estilo de una vez; en un sitio con contenido, aplicarla solo
 * cambia el preset de diseño — el contenido existente queda intacto, siempre. Confirmación
 * in-line (no `window.confirm`) solo cuando ya hay contenido que podría preocupar perder.
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
  onApply: (template: WebsiteTemplate, mode: "full" | "designOnly") => void;
}) {
  const [appliedFlash, setAppliedFlash] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function apply(template: WebsiteTemplate) {
    onApply(template, hasContent ? "designOnly" : "full");
    setConfirmingId(null);
    setAppliedFlash(template.id);
    setTimeout(() => setAppliedFlash(null), 2500);
  }

  function handleClick(template: WebsiteTemplate) {
    if (hasContent) {
      setConfirmingId(template.id);
      return;
    }
    apply(template);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3 border-b border-[var(--fo-border)] space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">Plantillas</p>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          {hasContent
            ? "Tu sitio ya tiene contenido — elegir una plantilla solo cambia el estilo, nunca borra secciones."
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
                <p className="text-sm font-semibold text-[var(--fo-text)]">{template.name}</p>
                {recommended ? (
                  <span className="shrink-0 rounded-full bg-[var(--fo-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--fo-accent)]">
                    Recomendada
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-[var(--fo-muted)] leading-relaxed">{template.description}</p>

              {canEdit ? (
                confirmingId === template.id ? (
                  <div className="space-y-2 rounded-lg border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-2.5">
                    <p className="text-xs text-[var(--fo-warning)] leading-relaxed">
                      Aplicar esta plantilla cambiará el diseño general pero conservará tus secciones.
                    </p>
                    <div className="flex gap-2">
                      <button type="button" className="fo-btn fo-btn-ghost text-xs flex-1 justify-center" onClick={() => setConfirmingId(null)}>
                        Cancelar
                      </button>
                      <button type="button" className="fo-btn fo-btn-primary text-xs flex-1 justify-center" onClick={() => apply(template)}>
                        Aplicar diseño
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
