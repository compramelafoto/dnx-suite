"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

export type OrganizerCommissionAppliesTo = "PREVENTA" | "POST_EVENT" | "EXTRAS";

export type AlbumSchoolCommissionInitial = {
  organizerCommissionEnabled: boolean;
  organizerCommissionPercentage: number | null;
  organizerCommissionAppliesTo: OrganizerCommissionAppliesTo[];
};

type AlbumSchoolCommissionSectionProps = {
  albumId: number;
  active: boolean;
  initial: AlbumSchoolCommissionInitial;
  onSaved?: (patch: AlbumSchoolCommissionInitial) => void;
  onError?: (message: string | null) => void;
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
  enabled: boolean,
  percentage: string,
  appliesTo: OrganizerCommissionAppliesTo[]
): string {
  return JSON.stringify({
    enabled,
    percentage: percentage.trim(),
    appliesTo: [...appliesTo].sort(),
  });
}

export default function AlbumSchoolCommissionSection({
  albumId,
  active,
  initial,
  onSaved,
  onError,
}: AlbumSchoolCommissionSectionProps) {
  const [commissionEnabled, setCommissionEnabled] = useState(
    Boolean(initial.organizerCommissionEnabled)
  );
  const [commissionPercentage, setCommissionPercentage] = useState(
    initial.organizerCommissionPercentage != null
      ? String(initial.organizerCommissionPercentage)
      : ""
  );
  const [commissionAppliesTo, setCommissionAppliesTo] = useState<OrganizerCommissionAppliesTo[]>(
    initial.organizerCommissionAppliesTo.length
      ? initial.organizerCommissionAppliesTo
      : ["PREVENTA"]
  );
  const [autosave, setAutosave] = useState<AutosaveUiState>("idle");
  const [autosaveError, setAutosaveError] = useState<string | null>(null);

  const hydratedRef = useRef(false);
  const lastSavedKeyRef = useRef(
    buildSaveKey(
      Boolean(initial.organizerCommissionEnabled),
      initial.organizerCommissionPercentage != null
        ? String(initial.organizerCommissionPercentage)
        : "",
      initial.organizerCommissionAppliesTo.length
        ? initial.organizerCommissionAppliesTo
        : ["PREVENTA"]
    )
  );
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = useCallback(() => {
    setAutosave("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setAutosave("idle"), 2200);
  }, []);

  useEffect(() => {
    hydratedRef.current = true;
  }, []);

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const persist = useCallback(async () => {
    const key = buildSaveKey(commissionEnabled, commissionPercentage, commissionAppliesTo);
    if (key === lastSavedKeyRef.current) return;

    const trimmed = commissionPercentage.trim();
    if (trimmed !== "") {
      const value = Number(trimmed.replace(",", "."));
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        setAutosave("error");
        setAutosaveError("El porcentaje debe estar entre 0 y 100.");
        onError?.("El porcentaje debe estar entre 0 y 100.");
        return;
      }
    }

    setAutosave("saving");
    setAutosaveError(null);
    onError?.(null);

    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerCommissionEnabled: commissionEnabled,
          organizerCommissionPercentage: trimmed === "" ? null : Number(trimmed.replace(",", ".")),
          organizerCommissionAppliesTo: commissionAppliesTo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "No se pudo guardar la comisión para administradores de escuela"
        );
      }

      const patch: AlbumSchoolCommissionInitial = {
        organizerCommissionEnabled: Boolean(data.organizerCommissionEnabled),
        organizerCommissionPercentage: data.organizerCommissionPercentage ?? null,
        organizerCommissionAppliesTo: Array.isArray(data.organizerCommissionAppliesTo)
          ? data.organizerCommissionAppliesTo
          : commissionAppliesTo,
      };

      lastSavedKeyRef.current = buildSaveKey(
        patch.organizerCommissionEnabled,
        patch.organizerCommissionPercentage != null
          ? String(patch.organizerCommissionPercentage)
          : "",
        patch.organizerCommissionAppliesTo
      );
      onSaved?.(patch);
      flashSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la comisión";
      setAutosave("error");
      setAutosaveError(message);
      onError?.(message);
    }
  }, [
    albumId,
    commissionAppliesTo,
    commissionEnabled,
    commissionPercentage,
    flashSaved,
    onError,
    onSaved,
  ]);

  useEffect(() => {
    if (!active || !hydratedRef.current) return;

    const key = buildSaveKey(commissionEnabled, commissionPercentage, commissionAppliesTo);
    if (key === lastSavedKeyRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persist();
    }, 750);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    active,
    commissionAppliesTo,
    commissionEnabled,
    commissionPercentage,
    persist,
  ]);

  return (
    <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6">
      <div className="ds-stack-section w-full gap-5">
        <div className="ds-content-container w-full max-w-3xl space-y-1">
          <h3 className="text-base font-semibold text-[#1a1a1a] m-0">
            Comisión para administradores de escuela
          </h3>
          <p className="ds-readable-text ds-readable-text--sm text-[#6b7280] m-0">
            Reconocimiento comercial por ventas desde el link de difusión escolar. Parte del sistema
            de ventas del álbum.
          </p>
        </div>

        <label className="flex w-full min-w-0 items-start gap-3 rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 shrink-0 accent-[#c27b3d]"
            checked={commissionEnabled}
            onChange={(e) => setCommissionEnabled(e.target.checked)}
          />
          <span className="min-w-0">Activar comisión para ventas desde link de escuela</span>
        </label>

        <label className="block space-y-1.5 max-w-md">
          <span className="text-sm font-medium text-[#1a1a1a]">Porcentaje de comisión</span>
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={commissionPercentage}
              placeholder="Ej: 5"
              onChange={(e) => setCommissionPercentage(e.target.value)}
              className="w-full pr-8"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[#6b7280]">
              %
            </span>
          </div>
        </label>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[#1a1a1a] m-0">Tipos de venta con comisión</p>
          <div className="grid gap-2">
            {(
              [
                ["PREVENTA", "Preventa", "Compras antes de publicar fotos."],
                ["POST_EVENT", "Ventas posteriores", "Compras después de publicar el álbum."],
                ["EXTRAS", "Extras y canjes", "Productos agregados en selección."],
              ] as const
            ).map(([value, label, description]) => (
              <label
                key={value}
                className="flex items-start gap-3 rounded-lg border border-[#f1f5f9] bg-[#fafafa] p-3"
              >
                <input
                  type="checkbox"
                  className="mt-1 shrink-0 accent-[#c27b3d]"
                  checked={commissionAppliesTo.includes(value)}
                  onChange={(e) => {
                    const next = new Set(commissionAppliesTo);
                    if (e.target.checked) next.add(value);
                    else next.delete(value);
                    setCommissionAppliesTo(Array.from(next));
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#1a1a1a]">{label}</span>
                  <span className="mt-0.5 block text-xs text-[#6b7280]">{description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 m-0 max-w-3xl">
          La comisión es un acuerdo directo entre fotógrafo e institución. ComprameLaFoto no gestiona
          ni paga estas comisiones.
        </p>

        <AutosaveStatus state={autosave} errorMessage={autosaveError} />
      </div>
    </Card>
  );
}
