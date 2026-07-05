"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

type UpsellConfig = {
  digitalExtraEnabled: boolean;
  digitalExtraPriceArs: number | null;
  printExtraEnabled: boolean;
  printExtraPriceArs: number | null;
  upsellPackIds: number[];
};

type PackOption = {
  id: number;
  name: string;
  isActive: boolean;
  priceClientArs: number;
};

type AutosaveUiState = "idle" | "saving" | "saved" | "error";

function AutosaveStatus({
  state,
  errorMessage,
}: {
  state: AutosaveUiState;
  errorMessage: string | null;
}) {
  if (state === "idle") return null;
  if (state === "saving") {
    return <p className="text-xs text-[#6b7280] m-0">Guardando…</p>;
  }
  if (state === "saved") {
    return <p className="text-xs text-emerald-700 m-0">Cambios guardados</p>;
  }
  return (
    <p className="text-xs text-red-700 m-0" role="alert">
      {errorMessage ?? "No se pudo guardar"}
    </p>
  );
}

function buildSaveKey(
  extrasEnabled: boolean,
  digitalEnabled: boolean,
  digitalPrice: string,
  printEnabled: boolean,
  printPrice: string,
  selectedPackIds: number[]
): string {
  return JSON.stringify({
    extrasEnabled,
    digitalEnabled,
    digitalPrice: digitalPrice.trim(),
    printEnabled,
    printPrice: printPrice.trim(),
    selectedPackIds: [...selectedPackIds].sort((a, b) => a - b),
  });
}

export default function AlbumUpsellConfigCard({
  albumId,
  active = true,
  onError,
}: {
  albumId: number;
  active?: boolean;
  onError?: (msg: string | null) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [autosave, setAutosave] = useState<AutosaveUiState>("idle");
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [hasExplicitConfig, setHasExplicitConfig] = useState(false);
  const [packOptions, setPackOptions] = useState<PackOption[]>([]);
  const [extrasEnabled, setExtrasEnabled] = useState(false);
  const [digitalEnabled, setDigitalEnabled] = useState(false);
  const [digitalPrice, setDigitalPrice] = useState("");
  const [printEnabled, setPrintEnabled] = useState(false);
  const [printPrice, setPrintPrice] = useState("");
  const [selectedPackIds, setSelectedPackIds] = useState<number[]>([]);

  const hydratedRef = useRef(false);
  const lastSavedKeyRef = useRef("");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = useCallback(() => {
    setAutosave("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setAutosave("idle"), 2200);
  }, []);

  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;

    async function load() {
      setLoading(true);
      setLocalError(null);
      try {
        const res = await fetch(`/api/dashboard/albums/${albumId}/upsell-config`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "No se pudo cargar la configuración.");
        if (cancelled) return;

        const config: UpsellConfig | null = data?.config ?? null;
        const packs: PackOption[] = Array.isArray(data?.packs) ? data.packs : [];
        const packIds = Array.isArray(config?.upsellPackIds) ? config!.upsellPackIds : [];
        const digitalOn = config?.digitalExtraEnabled ?? false;
        const printOn = config?.printExtraEnabled ?? false;

        setHasExplicitConfig(Boolean(config));
        setPackOptions(packs);
        setDigitalEnabled(digitalOn);
        setDigitalPrice(
          config?.digitalExtraPriceArs != null ? String(config.digitalExtraPriceArs) : ""
        );
        setPrintEnabled(printOn);
        setPrintPrice(
          config?.printExtraPriceArs != null ? String(config.printExtraPriceArs) : ""
        );
        setSelectedPackIds(packIds);
        setExtrasEnabled(Boolean(config) && (digitalOn || printOn || packIds.length > 0));

        lastSavedKeyRef.current = buildSaveKey(
          Boolean(config) && (digitalOn || printOn || packIds.length > 0),
          digitalOn,
          config?.digitalExtraPriceArs != null ? String(config.digitalExtraPriceArs) : "",
          printOn,
          config?.printExtraPriceArs != null ? String(config.printExtraPriceArs) : "",
          packIds
        );
        hydratedRef.current = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error inesperado";
        setLocalError(msg);
        onError?.(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [albumId, onError]);

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const activePackOptions = useMemo(
    () => packOptions.filter((p) => p.isActive),
    [packOptions]
  );

  const togglePack = (packId: number) => {
    setSelectedPackIds((prev) =>
      prev.includes(packId) ? prev.filter((id) => id !== packId) : [...prev, packId]
    );
  };

  const handleExtrasEnabledChange = (next: boolean) => {
    setExtrasEnabled(next);
    if (!next) {
      setDigitalEnabled(false);
      setPrintEnabled(false);
      setSelectedPackIds([]);
    }
  };

  const persist = useCallback(async () => {
    const effectiveDigital = extrasEnabled && digitalEnabled;
    const effectivePrint = extrasEnabled && printEnabled;
    const effectivePackIds = extrasEnabled ? selectedPackIds : [];

    const key = buildSaveKey(
      extrasEnabled,
      effectiveDigital,
      digitalPrice,
      effectivePrint,
      printPrice,
      effectivePackIds
    );
    if (key === lastSavedKeyRef.current) return;

    const digitalPriceNum = digitalPrice.trim() ? Number(digitalPrice) : null;
    const printPriceNum = printPrice.trim() ? Number(printPrice) : null;

    if (
      extrasEnabled &&
      !effectiveDigital &&
      !effectivePrint &&
      effectivePackIds.length === 0
    ) {
      return;
    }

    if (effectiveDigital && !(digitalPriceNum && Number.isFinite(digitalPriceNum) && digitalPriceNum > 0)) {
      setAutosave("error");
      setAutosaveError("Definí un precio válido para foto digital extra.");
      onError?.("Definí un precio válido para foto digital extra.");
      return;
    }
    if (effectivePrint && !(printPriceNum && Number.isFinite(printPriceNum) && printPriceNum > 0)) {
      setAutosave("error");
      setAutosaveError("Definí un precio válido para impresión extra.");
      onError?.("Definí un precio válido para impresión extra.");
      return;
    }

    setAutosave("saving");
    setAutosaveError(null);
    setLocalError(null);
    onError?.(null);

    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/upsell-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digitalExtraEnabled: effectiveDigital,
          digitalExtraPriceArs: effectiveDigital ? digitalPriceNum : null,
          printExtraEnabled: effectivePrint,
          printExtraPriceArs: effectivePrint ? printPriceNum : null,
          upsellPackIds: effectivePackIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar la configuración.");

      setHasExplicitConfig(true);
      lastSavedKeyRef.current = key;
      flashSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setAutosave("error");
      setAutosaveError(msg);
      setLocalError(msg);
      onError?.(msg);
    }
  }, [
    albumId,
    digitalEnabled,
    digitalPrice,
    extrasEnabled,
    flashSaved,
    onError,
    printEnabled,
    printPrice,
    selectedPackIds,
  ]);

  useEffect(() => {
    if (!active || !hydratedRef.current || loading) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persist();
    }, 750);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    active,
    loading,
    extrasEnabled,
    digitalEnabled,
    digitalPrice,
    printEnabled,
    printPrice,
    selectedPackIds,
    persist,
  ]);

  return (
    <Card className="ds-fill-width w-full min-w-0">
      <div className="ds-stack-section w-full gap-4">
        <div className="ds-content-container w-full max-w-3xl">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Extras y ventas adicionales</h2>
          <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0 mt-2">
            Productos o servicios extra que se ofrecen durante la compra o el canje de un pack.
          </p>
          {!loading ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-xs font-medium text-[#374151]">
              {extrasEnabled ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                  Extras activos
                </>
              ) : hasExplicitConfig ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-[#9ca3af]" aria-hidden />
                  Extras desactivados
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                  Sin configuración explícita (comportamiento por defecto)
                </>
              )}
            </div>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-[#6b7280]">Cargando configuración…</p>
        ) : (
          <>
            {localError && autosave !== "error" ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {localError}
              </div>
            ) : null}

            <div className="box-border w-full max-w-none self-stretch rounded-xl border border-[#e8e4df] bg-[#fdfbf8] px-4 py-4 sm:px-5">
              <label className="flex w-full min-w-0 cursor-pointer items-start gap-3 sm:gap-4">
                <input
                  type="checkbox"
                  checked={extrasEnabled}
                  onChange={(e) => handleExtrasEnabledChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#c27b3d]"
                />
                <span className="min-w-0 flex-1 space-y-1.5 text-sm">
                  <span className="block font-semibold text-[#1a1a1a]">
                    Activar extras y adicionales
                  </span>
                  <span className="block text-xs leading-relaxed text-[#4b5563]">
                    Si está desactivado, no se ofrecen compras extra durante la selección ni el canje.
                  </span>
                </span>
              </label>
            </div>

            {!extrasEnabled ? (
              <div
                className="ds-info-panel w-full rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950"
                role="status"
              >
                Los extras están desactivados para este álbum. Activá la opción de arriba para
                configurar digitales, impresiones o packs adicionales.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-[#e5e7eb] p-4 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a]">
                      <input
                        type="checkbox"
                        className="accent-[#c27b3d]"
                        checked={digitalEnabled}
                        onChange={(e) => setDigitalEnabled(e.target.checked)}
                      />
                      Ofrecer foto digital extra
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Precio por foto (ARS)"
                        value={digitalPrice}
                        onChange={(e) => setDigitalPrice(e.target.value)}
                        disabled={!digitalEnabled}
                        className="w-full sm:max-w-[220px]"
                      />
                    </div>
                    <p className="text-xs text-[#6b7280] leading-relaxed">
                      Precio final al cliente. Solo se muestra cuando el álbum tiene fotos publicadas.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#e5e7eb] p-4 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a]">
                      <input
                        type="checkbox"
                        className="accent-[#c27b3d]"
                        checked={printEnabled}
                        onChange={(e) => setPrintEnabled(e.target.checked)}
                      />
                      Ofrecer impresión extra
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Precio por impresión (ARS)"
                        value={printPrice}
                        onChange={(e) => setPrintPrice(e.target.value)}
                        disabled={!printEnabled}
                        className="w-full sm:max-w-[220px]"
                      />
                    </div>
                    <p className="text-xs text-[#6b7280] leading-relaxed">
                      Precio final al cliente. Solo se muestra cuando el álbum tiene fotos publicadas.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#e5e7eb] p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a]">Packs adicionales (POST_UPLOAD)</p>
                    <p className="text-xs text-[#6b7280] mt-1">
                      Elegí qué packs se ofrecen como upsell. Solo se admiten packs POST_UPLOAD activos.
                    </p>
                  </div>
                  {activePackOptions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#e5e7eb] bg-[#fafafa] px-3 py-3 text-sm text-[#6b7280]">
                      No hay packs POST_UPLOAD activos para ofrecer como upsell.
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {activePackOptions.map((pack) => (
                        <label
                          key={pack.id}
                          className="flex items-start gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-[#c27b3d]"
                            checked={selectedPackIds.includes(pack.id)}
                            onChange={() => togglePack(pack.id)}
                          />
                          <span className="text-sm text-[#374151]">
                            {pack.name} · ${pack.priceClientArs.toLocaleString("es-AR")}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <AutosaveStatus state={autosave} errorMessage={autosaveError} />
          </>
        )}
      </div>
    </Card>
  );
}
