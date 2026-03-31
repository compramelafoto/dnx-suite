"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { DiplomaLayoutJson } from "../../lib/fotorank/diplomas/layoutSchema";
import {
  type PublicTemplateFamily,
  type PublicTemplateStyleTag,
  getPublicTemplateBundle,
  listPublicTemplatesFiltered,
} from "../../lib/fotorank/diplomas/publicTemplates/catalog";
import { DIPLOMA_PAGE_H, DIPLOMA_PAGE_W } from "../../lib/fotorank/diplomas/publicTemplates/helpers";
import { DiplomaLayoutPreview } from "./DiplomaLayoutPreview";
import { PUBLIC_TEMPLATE_GALLERY_DEMO_VARIABLES } from "./galleryDemoVariables";
import { Modal } from "../ui/Modal";

const SPOTLIGHT_MS = 3000;
const SPOTLIGHT_FADE_MS = 320;

const STYLE_FILTER_CHIPS: { tag: PublicTemplateStyleTag | "todas"; label: string }[] = [
  { tag: "todas", label: "Todas" },
  { tag: "fotografia", label: "Fotografía" },
  { tag: "clasico", label: "Clásico" },
  { tag: "premium", label: "Premium" },
  { tag: "gala", label: "Gala" },
  { tag: "moderno", label: "Moderno" },
  { tag: "minimal", label: "Minimal" },
  { tag: "workshop", label: "Workshop" },
  { tag: "participacion", label: "Participación" },
  { tag: "ornamental", label: "Ornamental" },
  { tag: "oscuro", label: "Oscuro" },
  { tag: "institucional", label: "Institucional" },
  { tag: "decorativo", label: "Decorativo" },
  { tag: "creativo", label: "Creativo" },
  { tag: "colorido", label: "Colorido" },
  { tag: "geometrico", label: "Geométrico" },
  { tag: "soft", label: "Soft / orgánico" },
];

const FAMILY_LABEL: Record<PublicTemplateFamily, string> = {
  clasico: "Clásico",
  premium: "Premium / gala",
  moderno: "Moderno",
  "modern-decorative": "Moderno decorativo",
  artistico: "Artístico / editorial",
  vintage: "Vintage",
  workshop: "Workshop / formación",
  participacion: "Participación",
  fotografia: "Premio fotográfico",
  institucional: "Institucional",
  corporativo: "Corporativo",
  minimal: "Minimal / clean",
};

const FAMILY_CHIPS: { id: PublicTemplateFamily | "todas"; label: string }[] = [
  { id: "todas", label: "Todas las familias" },
  { id: "fotografia", label: "Fotografía" },
  { id: "premium", label: "Premium" },
  { id: "clasico", label: "Clásico" },
  { id: "workshop", label: "Workshop" },
  { id: "participacion", label: "Participación" },
  { id: "artistico", label: "Artístico" },
  { id: "vintage", label: "Vintage" },
  { id: "institucional", label: "Institucional" },
  { id: "minimal", label: "Minimal" },
  { id: "moderno", label: "Moderno" },
  { id: "modern-decorative", label: "Moderno decorativo" },
  { id: "corporativo", label: "Corporativo" },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (payload: { backgroundColor: string; layout: DiplomaLayoutJson }) => void;
  onApplyAsNew?: (payload: { backgroundColor: string; layout: DiplomaLayoutJson }) => void;
};

export function PublicTemplateGallery({ isOpen, onClose, onApply, onApplyAsNew }: Props) {
  const [filter, setFilter] = useState<PublicTemplateStyleTag | "todas">("todas");
  const [familyFilter, setFamilyFilter] = useState<PublicTemplateFamily | "todas">("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [spotlightClosing, setSpotlightClosing] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);

  useEffect(() => setPortalMounted(true), []);

  useEffect(() => {
    if (!isOpen) {
      setSpotlightId(null);
      setSpotlightClosing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!spotlightId) return;
    setSpotlightClosing(false);
    const fadeTimer = window.setTimeout(() => setSpotlightClosing(true), SPOTLIGHT_MS - SPOTLIGHT_FADE_MS);
    const closeTimer = window.setTimeout(() => {
      setSpotlightId(null);
      setSpotlightClosing(false);
    }, SPOTLIGHT_MS);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(closeTimer);
    };
  }, [spotlightId]);

  const list = useMemo(
    () =>
      listPublicTemplatesFiltered(
        filter === "todas" ? undefined : filter,
        familyFilter === "todas" ? undefined : familyFilter,
        searchQuery || undefined
      ),
    [filter, familyFilter, searchQuery]
  );

  const applySpotlightAndCloseGallery = useCallback(() => {
    const bundle = spotlightId ? getPublicTemplateBundle(spotlightId) : null;
    if (!bundle) return;
    onApply({ backgroundColor: bundle.backgroundColor, layout: bundle.layout });
    setSpotlightId(null);
    onClose();
  }, [spotlightId, onApply, onClose]);

  useEffect(() => {
    if (!spotlightId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setSpotlightId(null);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.closest?.('[contenteditable="true"]'))
      ) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        applySpotlightAndCloseGallery();
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const idx = list.findIndex((x) => x.id === spotlightId);
      if (idx < 0 || list.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      const nextIdx = (idx + delta + list.length) % list.length;
      const next = list[nextIdx];
      if (next) {
        setSpotlightId(next.id);
        setPreviewId(next.id);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [spotlightId, list, applySpotlightAndCloseGallery]);

  const previewBundle = previewId ? getPublicTemplateBundle(previewId) : null;
  const spotlightBundle = spotlightId ? getPublicTemplateBundle(spotlightId) : null;

  const spotlightOverlay =
    portalMounted && isOpen && spotlightBundle && typeof document !== "undefined"
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa de ejemplo del diploma"
            className={`fixed inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-black/75 p-4 backdrop-blur-sm transition-opacity duration-300 ease-out ${
              spotlightClosing ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <p className="max-w-xl text-center text-xs text-white/85 sm:text-sm">
              Ejemplo con datos ficticios — misma proporción que el PDF final ({Math.round(DIPLOMA_PAGE_W)}×
              {Math.round(DIPLOMA_PAGE_H)} pt horizontal).{" "}
              <span className="text-white/70">
                Flechas ← → para ver la plantilla anterior o siguiente (solo en esta vista).{" "}
                <span className="hidden sm:inline">Enter para confirmar.</span>
              </span>
            </p>
            <div
              className={`w-full max-w-[min(92vw,56rem)] transition duration-300 ease-out ${
                spotlightClosing ? "scale-[0.97] opacity-0" : "scale-100 opacity-100"
              }`}
            >
              <div
                className="overflow-hidden rounded-xl border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
                style={{ backgroundColor: spotlightBundle.backgroundColor }}
              >
                <DiplomaLayoutPreview
                  layout={spotlightBundle.layout}
                  variables={PUBLIC_TEMPLATE_GALLERY_DEMO_VARIABLES}
                  widthPt={DIPLOMA_PAGE_W}
                  heightPt={DIPLOMA_PAGE_H}
                  backgroundColor={spotlightBundle.backgroundColor}
                  className="!max-w-none w-full"
                />
              </div>
            </div>
            <div className="flex w-full max-w-[min(92vw,56rem)] flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
              <p className="order-2 text-center text-xs font-medium text-white/90 sm:order-1 sm:text-left">
                {spotlightBundle.name}
              </p>
              <button
                type="button"
                onClick={applySpotlightAndCloseGallery}
                className="order-1 fr-btn fr-btn-primary min-w-[200px] px-6 py-2.5 text-sm font-semibold shadow-lg shadow-black/40 sm:order-2"
              >
                Seleccionar
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Biblioteca de plantillas"
      maxWidth="6xl"
      showTopLogo={false}
      header="full"
      zIndex={70}
    >
      <div className="flex max-h-[min(78vh,820px)] flex-col gap-4">
        <p className="text-sm leading-relaxed text-fr-muted">
          Elegí una base visual. Los campos dinámicos (nombre, concurso, QR, etc.) se mantienen como placeholders listos para emitir.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar plantillas</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, estilo o palabra clave…"
              className="w-full rounded-xl border border-fr-border bg-fr-bg-elevated px-4 py-2.5 text-sm text-fr-primary placeholder:text-fr-muted/80 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
            />
          </label>
          <p className="shrink-0 text-xs text-fr-muted">
            {list.length} plantilla{list.length === 1 ? "" : "s"}
          </p>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-fr-muted">Estilo</p>
          <div className="flex max-h-[5.5rem] flex-wrap gap-2 overflow-y-auto pr-1 md:max-h-none">
            {STYLE_FILTER_CHIPS.map(({ tag, label }) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilter(tag)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  filter === tag
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-fr-border bg-fr-bg-elevated text-fr-muted hover:border-gold/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-fr-muted">Familia visual</p>
          <div className="flex flex-wrap gap-2">
            {FAMILY_CHIPS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFamilyFilter(id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  familyFilter === id
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-fr-border bg-fr-bg-elevated text-fr-muted hover:border-gold/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-fr-border bg-fr-bg p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.length === 0 ? (
                <p className="col-span-full py-8 text-center text-sm text-fr-muted">
                  No hay plantillas con estos filtros. Probá otra familia o limpiá la búsqueda.
                </p>
              ) : (
                list.map((t) => {
                  const bundle = getPublicTemplateBundle(t.id);
                  if (!bundle) return null;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setPreviewId(t.id);
                        setSpotlightId(t.id);
                      }}
                      className={`group flex flex-col overflow-hidden rounded-xl border text-left transition ${
                        previewId === t.id ? "border-gold ring-1 ring-gold/40" : "border-fr-border hover:border-gold/35"
                      }`}
                    >
                      <div className="relative aspect-[842/595] w-full overflow-hidden bg-[#0a0a0a]">
                        <div className="pointer-events-none absolute inset-0 z-0">
                          <DiplomaLayoutPreview
                            layout={bundle.layout}
                            variables={PUBLIC_TEMPLATE_GALLERY_DEMO_VARIABLES}
                            widthPt={DIPLOMA_PAGE_W}
                            heightPt={DIPLOMA_PAGE_H}
                            backgroundColor={bundle.backgroundColor}
                            thumbnail
                            className="!max-w-none w-full"
                          />
                        </div>
                        <div
                          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/55 via-transparent to-black/25"
                          aria-hidden
                        />
                        <span className="absolute left-2 top-2 z-[2] rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium text-white/95 backdrop-blur-sm">
                          {FAMILY_LABEL[t.family]}
                        </span>
                        <span className="absolute bottom-2 left-2 right-2 z-[2] text-[10px] font-medium text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                          {Math.round(DIPLOMA_PAGE_W)}×{Math.round(DIPLOMA_PAGE_H)} pt
                        </span>
                      </div>
                      <div className="space-y-1 border-t border-fr-border bg-fr-bg-elevated/80 p-3">
                        <p className="font-medium text-fr-primary">{t.name}</p>
                        <p className="line-clamp-2 text-[11px] text-fr-muted">{t.description}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {t.styleTags.slice(0, 4).map((s) => (
                            <span
                              key={s}
                              className="rounded bg-fr-bg px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-fr-muted"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="shrink-0 rounded-xl border border-fr-border bg-fr-bg-elevated/50 p-4">
            <p className="mb-3 text-xs text-fr-muted">
              {previewBundle
                ? `Seleccionada: ${previewBundle.name}. Podés aplicarla o abrir el ejemplo al hacer clic en la tarjeta.`
                : "Elegí una plantilla en la grilla para aplicarla."}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <button
                type="button"
                disabled={!previewBundle}
                className="fr-btn fr-btn-primary w-full text-sm disabled:opacity-40 sm:w-auto sm:min-w-[200px]"
                onClick={() => {
                  if (!previewBundle) return;
                  onApply({ backgroundColor: previewBundle.backgroundColor, layout: previewBundle.layout });
                  onClose();
                }}
              >
                Aplicar a esta plantilla
              </button>
              {onApplyAsNew ? (
                <button
                  type="button"
                  disabled={!previewBundle}
                  className="fr-btn fr-btn-secondary w-full text-sm disabled:opacity-40 sm:w-auto sm:min-w-[200px]"
                  onClick={() => {
                    if (!previewBundle) return;
                    onApplyAsNew({ backgroundColor: previewBundle.backgroundColor, layout: previewBundle.layout });
                    onClose();
                  }}
                >
                  Usar como plantilla nueva
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex w-full items-center justify-center gap-2 text-xs text-fr-muted hover:text-fr-primary sm:ml-auto sm:w-auto"
              >
                <X className="size-3.5" aria-hidden />
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
      {spotlightOverlay}
    </Modal>
  );
}
