"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { preventaSelectClassName } from "./preventa-form-controls";
import {
  CATALOG_INCOMPATIBLE_REASON_LABEL,
  type CatalogImportOptionsResponse,
  fetchCatalogImportOptions,
  formatCatalogOptionLabel,
  parseCatalogSelectionValue,
  resolveCatalogProductIdForImport,
} from "./preventa-catalog-import-shared";
import type { PackRow } from "./types";

export type PreventaPackCatalogImportStepHandle = {
  submit: () => Promise<PackRow | null>;
  canSubmit: boolean;
  busy: boolean;
};

const PreventaPackCatalogImportStep = forwardRef<
  PreventaPackCatalogImportStepHandle,
  {
    albumId: number;
    availabilityPhase: "PRE_UPLOAD" | "POST_UPLOAD";
    onAvailabilityPhaseChange: (phase: "PRE_UPLOAD" | "POST_UPLOAD") => void;
    onError: (message: string | null) => void;
    onStateChange?: (state: { canSubmit: boolean; busy: boolean }) => void;
  }
>(function PreventaPackCatalogImportStep(
  { albumId, availabilityPhase, onAvailabilityPhaseChange, onError, onStateChange },
  ref
) {
  const router = useRouter();
  const [options, setOptions] = useState<CatalogImportOptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");
  const [priceArs, setPriceArs] = useState("");
  const [showIncomplete, setShowIncomplete] = useState(false);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      setOptions(await fetchCatalogImportOptions(albumId));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error cargando productos");
      setOptions(null);
    } finally {
      setLoading(false);
    }
  }, [albumId, onError]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const selection = useMemo(
    () => parseCatalogSelectionValue(selectedValue, options),
    [selectedValue, options]
  );

  useEffect(() => {
    if (!selection) return;
    if (selection.kind === "product") {
      setPriceArs(String(Math.round(selection.basePriceCents)));
      return;
    }
    const suggestedArs = selection.suggestedPriceCents;
    setPriceArs(
      suggestedArs != null && suggestedArs > 0 ? String(Math.round(suggestedArs)) : ""
    );
  }, [selection]);

  const compatibleCount = useMemo(() => {
    if (!options) return 0;
    return (
      options.compatibleCount ??
      options.photographerProducts.length +
        options.systemFromCatalog.length +
        options.systemTemplates.length
    );
  }, [options]);

  const createPackFromSelection = useCallback(async (): Promise<PackRow | null> => {
    const parsed = parseCatalogSelectionValue(selectedValue, options);
    if (!parsed) {
      onError("Elegí un producto existente para continuar.");
      return null;
    }

    const price = Number(priceArs);
    if (!Number.isFinite(price) || price < 0) {
      onError("Ingresá un precio válido.");
      return null;
    }

    setCreating(true);
    onError(null);

    try {
      const catalogProductId = await resolveCatalogProductIdForImport(parsed);

      const res = await fetch(`/api/dashboard/albums/${albumId}/preventa-packs/from-catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogProductId, price }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "No se pudo crear el pack"
        );
      }

      const packId = Number(data?.pack?.id);
      if (!Number.isInteger(packId) || packId <= 0) {
        throw new Error("No se obtuvo el pack creado");
      }

      if (data.pack.availabilityPhase !== availabilityPhase) {
        const patchRes = await fetch(
          `/api/dashboard/albums/${albumId}/preventa-packs/${packId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ availabilityPhase }),
          }
        );
        const patchData = await patchRes.json().catch(() => ({}));
        if (!patchRes.ok) {
          throw new Error(patchData?.error || "No se pudo guardar la etapa del pack");
        }
        return patchData.pack as PackRow;
      }

      return data.pack as PackRow;
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al crear el pack");
      return null;
    } finally {
      setCreating(false);
    }
  }, [albumId, availabilityPhase, onError, options, priceArs, selectedValue]);

  const canSubmit = Boolean(selectedValue) && compatibleCount > 0 && !loading;

  useImperativeHandle(
    ref,
    () => ({
      submit: createPackFromSelection,
      canSubmit,
      busy: creating,
    }),
    [canSubmit, createPackFromSelection, creating]
  );

  useEffect(() => {
    onStateChange?.({ canSubmit, busy: creating });
  }, [canSubmit, creating, onStateChange]);

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-sm text-[#6b7280] m-0">Cargando tus productos…</p>
      ) : compatibleCount === 0 ? (
        <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 space-y-3">
          <p className="text-sm text-[#374151] m-0">
            No hay productos listos para usar. Creá un pack o combo con al menos un componente
            (digital, impreso o diseño).
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => router.push("/dashboard/productos")}
          >
            Ir a Mis packs y combos
          </Button>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
              Producto existente *
            </label>
            <select
              className={preventaSelectClassName}
              value={selectedValue}
              onChange={(e) => setSelectedValue(e.target.value)}
              disabled={creating}
            >
              <option value="">Elegir…</option>
              {options!.photographerProducts.length > 0 ? (
                <optgroup label="Tus packs y combos">
                  {options!.photographerProducts.map((p) => (
                    <option key={`product-${p.id}`} value={`product:${p.id}`}>
                      {formatCatalogOptionLabel(p.name, p.compositionSummary)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {options!.systemFromCatalog.length > 0 ? (
                <optgroup label="Recomendados (ya en tu lista)">
                  {options!.systemFromCatalog.map((p) => (
                    <option key={`product-${p.id}`} value={`product:${p.id}`}>
                      {formatCatalogOptionLabel(p.name, p.compositionSummary)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {options!.systemTemplates.length > 0 ? (
                <optgroup label="Recomendados del sistema">
                  {options!.systemTemplates.map((t) => (
                    <option key={`template-${t.templateId}`} value={`template:${t.templateId}`}>
                      {formatCatalogOptionLabel(t.name, t.compositionSummary)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
                Tu precio ($) *
              </label>
              <Input
                type="number"
                min={0}
                step={1}
                value={priceArs}
                onChange={(e) => setPriceArs(e.target.value)}
                disabled={creating || !selectedValue}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Cuándo se vende</label>
              <select
                value={availabilityPhase}
                onChange={(e) =>
                  onAvailabilityPhaseChange(e.target.value as "PRE_UPLOAD" | "POST_UPLOAD")
                }
                disabled={creating}
                className={preventaSelectClassName}
              >
                <option value="PRE_UPLOAD">Antes de subir fotos</option>
                <option value="POST_UPLOAD">Después de subir fotos</option>
              </select>
            </div>
          </div>

          {selection?.kind === "template" ? (
            <p className="text-xs text-[#6b7280] m-0">
              Agregamos el pack recomendado a tu lista y armamos el pack de preventa con sus
              productos incluidos.
            </p>
          ) : null}
        </>
      )}

      {options && options.incompatible.length > 0 ? (
        <div className="border-t border-[#f1f5f9] pt-3 space-y-2">
          <button
            type="button"
            className="text-xs font-medium text-[#6b7280] hover:text-[#374151]"
            onClick={() => setShowIncomplete((v) => !v)}
          >
            {showIncomplete ? "Ocultar" : "Mostrar"} productos no disponibles (
            {options.incompatible.length})
          </button>
          {showIncomplete ? (
            <ul className="m-0 pl-4 space-y-1 text-xs text-[#6b7280] list-disc">
              {options.incompatible.map((item) => (
                <li key={item.id}>
                  <span className="text-[#374151]">{item.name}</span>
                  {" — "}
                  <span>{CATALOG_INCOMPATIBLE_REASON_LABEL[item.reason]}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

export default PreventaPackCatalogImportStep;
