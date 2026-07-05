"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import DragGrip from "./DragGrip";
import { reorderIdsAfterDrop } from "./reorder-utils";
import PreventaPackCompositionSummary from "./PreventaPackCompositionSummary";
import PreventaPackPublishControl from "./PreventaPackPublishControl";
import type { PackRow } from "./types";
import { isPreventaUxV2EnabledClient } from "@/lib/preventa-canjeable/preventa-ux-v2-feature-flag";

type PublishFilter = "all" | "published" | "draft";

const PUBLISH_FILTER_OPTIONS: { id: PublishFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "published", label: "Publicados" },
  { id: "draft", label: "Borradores" },
];

function formatRange(validFrom: string | null, validUntil: string | null): string {
  if (!validFrom && !validUntil) return "—";
  const fmt = (s: string) =>
    new Date(s).toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  if (validFrom && validUntil) return `${fmt(validFrom)} → ${fmt(validUntil)}`;
  if (validFrom) return `Desde ${fmt(validFrom)}`;
  return `Hasta ${fmt(validUntil!)}`;
}

export default function PreventaPackList({
  packs,
  platformFeePercent = 10,
  loading,
  onCreate,
  onEdit,
  onDelete,
  onManageBenefits,
  onDuplicate,
  onTogglePublish,
  togglingPackId = null,
  albumPublicSlug,
  onReorderPacks,
  reordering,
  hideHeaderCreateButton = false,
}: {
  packs: PackRow[];
  /** % fee plataforma (misma base que el checkout del álbum). */
  platformFeePercent?: number;
  loading: boolean;
  /** Oculta el botón del encabezado cuando la acción principal está arriba de la lista. */
  hideHeaderCreateButton?: boolean;
  onCreate: () => void;
  onEdit: (p: PackRow) => void;
  onDelete: (p: PackRow) => void;
  onManageBenefits: (p: PackRow) => void;
  onDuplicate: (p: PackRow) => void;
  onTogglePublish: (p: PackRow) => void;
  togglingPackId?: number | null;
  albumPublicSlug?: string | null;
  onReorderPacks?: (orderedIds: number[]) => Promise<void>;
  reordering?: boolean;
}) {
  const sortedPacks = useMemo(
    () => [...packs].sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id),
    [packs]
  );
  const [publishFilter, setPublishFilter] = useState<PublishFilter>("all");
  const filteredPacks = useMemo(() => {
    if (publishFilter === "published") return sortedPacks.filter((p) => p.isActive);
    if (publishFilter === "draft") return sortedPacks.filter((p) => !p.isActive);
    return sortedPacks;
  }, [sortedPacks, publishFilter]);
  const publishCounts = useMemo(
    () => ({
      all: sortedPacks.length,
      published: sortedPacks.filter((p) => p.isActive).length,
      draft: sortedPacks.filter((p) => !p.isActive).length,
    }),
    [sortedPacks]
  );
  const preUploadPacks = useMemo(
    () =>
      filteredPacks.filter(
        (p) => p.availabilityPhase === "PRE_UPLOAD" || p.availabilityPhase == null
      ),
    [filteredPacks]
  );
  const postUploadPacks = useMemo(
    () => filteredPacks.filter((p) => p.availabilityPhase === "POST_UPLOAD"),
    [filteredPacks]
  );
  const sortedIds = useMemo(() => sortedPacks.map((p) => p.id), [sortedPacks]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [copiedPackId, setCopiedPackId] = useState<number | null>(null);
  const canReorder = Boolean(onReorderPacks) && sortedPacks.length >= 2 && !reordering;
  const uxV2 = isPreventaUxV2EnabledClient();
  const shareBaseUrl = useMemo(() => {
    if (!albumPublicSlug) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/album/${albumPublicSlug}`;
  }, [albumPublicSlug]);
  const actionButtonClass =
    "inline-flex items-center justify-center h-10 w-10 rounded-lg border border-[#e5e7eb] text-[#374151] bg-white shadow-sm hover:text-[#111827] hover:border-[#cbd5f5] hover:bg-[#f8fafc]";

  const renderPackList = (list: PackRow[], label: string, description?: string) => {
    if (list.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-[#e5e7eb] bg-[#fafafa] p-4 text-sm text-[#6b7280]">
          No hay packs en esta etapa todavía.
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-[#1a1a1a]">{label}</p>
          {description ? <p className="text-xs text-[#6b7280]">{description}</p> : null}
        </div>
        <ul className={`space-y-2 ${reordering ? "opacity-60 pointer-events-none" : ""}`}>
          {list.map((p) => {
            const nBenefits = p.benefits?.length ?? 0;
            const phaseBadge =
              p.availabilityPhase === "POST_UPLOAD"
                ? "Después de subir fotos"
                : "Antes de subir fotos";
            const phaseClass =
              p.availabilityPhase === "POST_UPLOAD"
                ? "bg-indigo-50 text-indigo-800"
                : "bg-amber-50 text-amber-800";
            return (
              <li
                key={p.id}
                className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4 px-4 border border-[#e5e7eb] rounded-lg bg-white ${
                  draggingId === p.id ? "opacity-50 ring-2 ring-[#c27b3d]/30" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const raw = e.dataTransfer.getData("text/plain");
                  const fromId = parseInt(raw, 10);
                  if (!Number.isInteger(fromId) || !onReorderPacks) return;
                  const next = reorderIdsAfterDrop(sortedIds, fromId, p.id);
                  if (next.join(",") === sortedIds.join(",")) return;
                  void onReorderPacks(next);
                  setDraggingId(null);
                }}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <DragGrip
                    disabled={!canReorder}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(p.id));
                      setDraggingId(p.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                  />
                  {p.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.coverImageUrl}
                      alt=""
                      className="w-11 h-11 rounded-lg object-cover shrink-0 border border-[#e5e7eb] bg-[#f9fafb]"
                    />
                  ) : (
                    <div
                      className="w-11 h-11 rounded-lg shrink-0 border border-dashed border-[#e5e7eb] bg-[#f9fafb]"
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[#1a1a1a]">{p.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${phaseClass}`}>{phaseBadge}</span>
                    </div>
                    <div className="text-sm text-[#1a1a1a] space-y-1">
                      <p className="m-0">
                        <span className="font-medium">
                          ${p.priceClientArs.toLocaleString("es-AR")}
                        </span>
                        <span className="text-[#6b7280]"> · tu precio</span>
                      </p>
                      {p.priceFinalClientArs != null && p.priceFinalClientArs !== p.priceClientArs ? (
                        <p className="m-0 text-[#374151]">
                          <span className="font-medium">
                            ${p.priceFinalClientArs.toLocaleString("es-AR")}
                          </span>
                          <span className="text-[#6b7280]">
                            {" "}
                            precio para familias (comisión de plataforma {platformFeePercent}%)
                          </span>
                        </p>
                      ) : p.priceFinalClientArs != null ? (
                        <p className="m-0 text-[#6b7280]">
                          Mismo monto para familias (sin comisión de plataforma)
                        </p>
                      ) : null}
                      <p className="m-0 text-[#6b7280]">
                        {nBenefits} producto{nBenefits !== 1 ? "s" : ""} incluido
                        {nBenefits !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <PreventaPackCompositionSummary benefits={p.benefits} />
                    {p.isActive && nBenefits === 0 ? (
                      <p className="text-xs text-amber-700 m-0">
                        Este pack está publicado pero no tiene productos incluidos. Despublicalo o agregá
                        productos incluidos.
                      </p>
                    ) : null}
                    <p className="text-xs text-[#6b7280] m-0">
                      Vigencia de venta: {formatRange(p.validFrom, p.validUntil)}
                      {p.redemptionDeadlineAt && (
                        <>
                          {" "}
                          · Usar hasta:{" "}
                          {new Date(p.redemptionDeadlineAt).toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 shrink-0 w-full sm:w-auto sm:pl-0 pl-8">
                  <PreventaPackPublishControl
                    isPublished={p.isActive}
                    busy={togglingPackId === p.id}
                    disabled={reordering}
                    onToggle={() => onTogglePublish(p)}
                  />
                  <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onManageBenefits(p)}
                    className={actionButtonClass}
                    aria-label="Ver contenido del pack"
                    title="Ver contenido del pack"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(p)}
                    className={actionButtonClass}
                    aria-label="Editar pack"
                    title="Editar pack"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M4 20h4l10-10a2.1 2.1 0 0 0-4-4L4 16v4Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="m13 7 4 4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicate(p)}
                    className={actionButtonClass}
                    aria-label="Duplicar pack"
                    title="Duplicar pack"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                      <rect
                        x="8"
                        y="8"
                        width="12"
                        height="12"
                        rx="2.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <rect
                        x="4"
                        y="4"
                        width="12"
                        height="12"
                        rx="2.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!shareBaseUrl) return;
                      const url = `${shareBaseUrl}?pack=${p.id}`;
                      navigator.clipboard.writeText(url);
                      setCopiedPackId(p.id);
                      setTimeout(() => setCopiedPackId(null), 2000);
                    }}
                    className={actionButtonClass}
                    aria-label="Compartir link del pack"
                    title={copiedPackId === p.id ? "Link copiado" : "Compartir link del pack"}
                    disabled={!shareBaseUrl}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 1 1 7 7L17.5 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 11a5 5 0 0 1 0 7L12.5 19.5a5 5 0 1 1-7-7L6.5 11"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(p)}
                    className={`${actionButtonClass} text-red-600 hover:text-red-700`}
                    aria-label="Eliminar pack"
                    title="Eliminar pack"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const renderFilteredEmpty = () => {
    if (publishFilter === "all") return null;
    const label = publishFilter === "published" ? "publicados" : "en borrador";
    return (
      <div className="rounded-xl border border-dashed border-[#e5e7eb] bg-[#fafafa] p-4 text-sm text-[#6b7280]">
        No hay packs {label} con este filtro.
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#6b7280] m-0">
          Armá los packs que el cliente puede comprar en la preventa pública del álbum.
        </p>
        {!hideHeaderCreateButton ? (
          <Button variant="primary" onClick={onCreate}>
            Crear pack
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-[#6b7280]">
        Cada pack se vende en una sola etapa. Si querés vender antes y después, creá dos packs distintos.
      </p>
      {canReorder && (
        <p className="text-xs text-[#6b7280]">
          Arrastrá el icono <span className="font-medium text-[#1a1a1a]">⋮⋮</span> para ordenar los
          packs (en escritorio; en móvil el arrastre puede no estar disponible según el navegador).
        </p>
      )}
      {sortedPacks.length > 0 ? (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filtrar por estado de publicación"
        >
          {PUBLISH_FILTER_OPTIONS.map((opt) => {
            const count = publishCounts[opt.id];
            const active = publishFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPublishFilter(opt.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-[#c27b3d] bg-[#fef7f3] text-[#9a5f2e]"
                    : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#d1d5db]"
                }`}
                aria-pressed={active}
              >
                {opt.label}
                <span className="text-[#6b7280] font-normal"> ({count})</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-[#6b7280] py-2">Cargando packs…</p>
      ) : sortedPacks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e5e7eb] bg-[#fafafa] px-6 py-10 text-center ds-catalog-empty-shell">
          <h3 className="text-base font-semibold text-[#1a1a1a] m-0">
            {uxV2 ? "Todavía no configuraste la preventa" : "Todavía no hay packs"}
          </h3>
          <p className="ds-intro-prose ds-intro-prose--fluid mx-auto mt-2 text-sm text-[#6b7280] m-0">
            {uxV2
              ? "Creá tu primer pack de preventa. Las familias compran antes de las fotos y eligen imágenes cuando publiques la galería."
              : "Creá uno para empezar a vender en la preventa pública del álbum."}
          </p>
          <Button variant="primary" className="mt-5" onClick={onCreate}>
            Crear pack
          </Button>
        </div>
      ) : filteredPacks.length === 0 ? (
        renderFilteredEmpty()
      ) : (
        <div className="space-y-4">
          {renderPackList(
            preUploadPacks,
            "Antes de subir fotos",
            "Se muestran mientras el álbum todavía no tiene fotos publicadas."
          )}
          {renderPackList(
            postUploadPacks,
            "Después de subir fotos",
            "Se muestran cuando el álbum ya tiene fotos publicadas."
          )}
        </div>
      )}
    </div>
  );
}
