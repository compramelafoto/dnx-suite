"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import DragGrip from "./DragGrip";
import {
  buildBenefitDashboardSummary,
  buildBenefitListHeadline,
} from "@/lib/preventa-canjeable/benefit-copy";
import PreventaBenefitForm, { type BenefitFormPayload } from "./PreventaBenefitForm";
import { reorderIdsAfterDrop } from "./reorder-utils";
import type { BenefitRow, PackRow, PhotographerProductOption, TemplateOption } from "./types";

function benefitListSummary(
  b: BenefitRow,
  products: PhotographerProductOption[],
  templates: TemplateOption[]
): string {
  const product = products.find((p) => p.id === b.photographerProductId);
  const photographerProductName = product
    ? `${product.name}${product.size ? ` · ${product.size}` : ""}`
    : null;
  const tpl = templates.find((t) => t.id === b.templateId);
  return buildBenefitDashboardSummary({
    kind: b.kind,
    includedQuantity: b.includedQuantity,
    selectionMode: b.selectionMode,
    requiredPhotoCount: b.requiredPhotoCount,
    maxPhotosPerUnit: b.maxPhotosPerUnit,
    templatePolicy: b.templatePolicy,
    templateName: tpl?.name ?? null,
    photographerProductName,
    extraUnitPriceOverrideArs: b.extraUnitPriceOverrideArs,
  });
}

type View = "list" | "form";

export default function PreventaPackBenefitsEditor({
  albumId,
  pack,
  onPacksChanged,
}: {
  albumId: number;
  pack: PackRow;
  onPacksChanged: () => void;
}) {
  const [view, setView] = useState<View>("list");
  const [benefits, setBenefits] = useState<BenefitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [benefitSaving, setBenefitSaving] = useState(false);
  const [benefitsReordering, setBenefitsReordering] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<BenefitRow | null>(null);
  const [photographerProducts, setPhotographerProducts] = useState<PhotographerProductOption[]>(
    []
  );
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [auxLoading, setAuxLoading] = useState(true);
  const [draggingBenefitId, setDraggingBenefitId] = useState<number | null>(null);

  const loadBenefits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/albums/${albumId}/preventa-packs/${pack.id}/benefits`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data?.benefits)) {
        setBenefits(data.benefits);
      } else {
        setBenefits([]);
      }
    } finally {
      setLoading(false);
    }
  }, [albumId, pack.id]);

  useEffect(() => {
    loadBenefits();
  }, [loadBenefits]);

  const sortedBenefits = useMemo(
    () => [...benefits].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [benefits]
  );
  const sortedBenefitIds = useMemo(() => sortedBenefits.map((b) => b.id), [sortedBenefits]);
  const canReorderBenefits = sortedBenefits.length >= 2 && !benefitsReordering && !benefitSaving;

  useEffect(() => {
    let cancelled = false;
    async function loadAux() {
      setAuxLoading(true);
      try {
        const [prodRes, tplRes] = await Promise.all([
          fetch("/api/fotografo/products", { cache: "no-store" }),
          fetch(`/api/dashboard/albums/${albumId}/preventa-packs/template-options`, {
            cache: "no-store",
          }),
        ]);
        const prodData = await prodRes.json().catch(() => ({}));
        const tplData = await tplRes.json().catch(() => ({}));
        if (cancelled) return;
        setPhotographerProducts(
          Array.isArray(prodData?.products) ? prodData.products : []
        );
        setTemplateOptions(Array.isArray(tplData?.templates) ? tplData.templates : []);
      } finally {
        if (!cancelled) setAuxLoading(false);
      }
    }
    loadAux();
    return () => {
      cancelled = true;
    };
  }, [albumId]);

  async function persistBenefitOrder(orderedIds: number[]) {
    setBenefitsReordering(true);
    try {
      const res = await fetch(
        `/api/dashboard/albums/${albumId}/preventa-packs/${pack.id}/benefits/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ benefitIds: orderedIds }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo reordenar");
      }
      await loadBenefits();
      onPacksChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al reordenar");
    } finally {
      setBenefitsReordering(false);
      setDraggingBenefitId(null);
    }
  }

  async function handleBenefitSubmit(payload: BenefitFormPayload) {
    setBenefitSaving(true);
    try {
      if (editingBenefit) {
        const res = await fetch(
          `/api/dashboard/albums/${albumId}/preventa-packs/${pack.id}/benefits/${editingBenefit.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "No se pudo actualizar");
      } else {
        const res = await fetch(
          `/api/dashboard/albums/${albumId}/preventa-packs/${pack.id}/benefits`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "No se pudo crear");
      }
      await loadBenefits();
      onPacksChanged();
      setView("list");
      setEditingBenefit(null);
    } finally {
      setBenefitSaving(false);
    }
  }

  async function deleteBenefit(b: BenefitRow) {
    if (!confirm("¿Eliminar este producto incluido?")) return;
    try {
      const res = await fetch(
        `/api/dashboard/albums/${albumId}/preventa-packs/${pack.id}/benefits/${b.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error al eliminar");
      }
      await loadBenefits();
      onPacksChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="space-y-4">
      {view === "list" && (
        <>
          {auxLoading && (
            <p className="text-xs text-[#6b7280]">Cargando productos y plantillas…</p>
          )}
          <div className="ds-split-panel w-full gap-3">
            <p className="ds-split-panel__main ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-gray-600 m-0 min-w-0">
              {templateOptions.length === 0 && !auxLoading
                ? "Podés agregar digitales, impresos o diseños. El cliente los usa al canjear cuando las fotos estén listas."
                : `${templateOptions.length} plantilla(s) disponibles para impresos con diseño.`}
            </p>
            <Button
              variant="primary"
              size="sm"
              className="ds-split-panel__aside shrink-0 whitespace-nowrap"
              onClick={() => {
                setEditingBenefit(null);
                setView("form");
              }}
            >
              Agregar producto
            </Button>
          </div>
          {canReorderBenefits && (
            <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-xs text-gray-600 m-0">
              Arrastrá <span className="font-medium text-[#1a1a1a]">⋮⋮</span> para ordenar los
              productos incluidos.
            </p>
          )}
          {loading ? (
            <p className="text-sm text-[#6b7280] py-4">Cargando productos incluidos…</p>
          ) : sortedBenefits.length === 0 ? (
            <p className="text-sm text-[#6b7280] py-4">
              Este pack no tiene productos incluidos todavía. Agregá al menos uno para poder
              publicarlo.
            </p>
          ) : (
            <ul
              className={`space-y-2 ${benefitsReordering ? "opacity-60 pointer-events-none" : ""}`}
            >
              {sortedBenefits.map((b) => (
                <li
                  key={b.id}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 px-3 border border-[#e5e7eb] rounded-lg text-sm ${
                    draggingBenefitId === b.id ? "opacity-50 ring-2 ring-[#c27b3d]/30" : ""
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const raw = e.dataTransfer.getData("text/plain");
                    const fromId = parseInt(raw, 10);
                    if (!Number.isInteger(fromId)) return;
                    const next = reorderIdsAfterDrop(sortedBenefitIds, fromId, b.id);
                    if (next.join(",") === sortedBenefitIds.join(",")) return;
                    void persistBenefitOrder(next);
                  }}
                >
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <DragGrip
                      disabled={!canReorderBenefits}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(b.id));
                        setDraggingBenefitId(b.id);
                      }}
                      onDragEnd={() => setDraggingBenefitId(null)}
                    />
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-medium text-[#1a1a1a]">
                          {b.kind === "DIGITAL" ? "Digital" : "Impreso"} ·{" "}
                          {buildBenefitListHeadline({
                            kind: b.kind,
                            includedQuantity: b.includedQuantity,
                            selectionMode: b.selectionMode,
                            requiredPhotoCount: b.requiredPhotoCount,
                          })}
                        </span>
                        {b.extraUnitPriceOverrideArs != null && b.extraUnitPriceOverrideArs > 0 ? (
                          <span className="text-xs font-semibold text-[#c27b3d] rounded-md bg-[#fef7f3] border border-[#c27b3d]/25 px-2 py-0.5 max-w-full break-words leading-snug">
                            Extra al canjear: +$
                            {b.extraUnitPriceOverrideArs.toLocaleString("es-AR")} c/u
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-[#374151] leading-relaxed">
                        {benefitListSummary(b, photographerProducts, templateOptions)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 sm:pl-0 pl-8">
                    <button
                      type="button"
                      className="text-[#6b7280] hover:text-[#1a1a1a] underline"
                      onClick={() => {
                        setEditingBenefit(b);
                        setView("form");
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-700 underline"
                      onClick={() => deleteBenefit(b)}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {view === "form" && (
        <>
          <button
            type="button"
            className="text-sm text-[#c27b3d] hover:underline"
            onClick={() => {
              setEditingBenefit(null);
              setView("list");
            }}
            disabled={benefitSaving}
          >
            ← Volver a productos incluidos
          </button>
          <PreventaBenefitForm
            benefit={editingBenefit}
            photographerProducts={photographerProducts}
            templateOptions={templateOptions}
            saving={benefitSaving}
            hideHeading
            onCancel={() => {
              setEditingBenefit(null);
              setView("list");
            }}
            onSubmit={handleBenefitSubmit}
          />
        </>
      )}
    </div>
  );
}
