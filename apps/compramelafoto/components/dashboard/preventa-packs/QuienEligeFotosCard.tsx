"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DIAS_POR_DEFECTO,
  MODOS_ELECCION,
  TEXTOS_MODO,
  type ModoEleccion,
} from "@/lib/schools/quien-elige-las-fotos";

type Regla = { mode: ModoEleccion; familyDays: number };

/**
 * «¿Quién elige las fotos?» de la preventa: la familia, el fotógrafo, o la familia con un plazo
 * y después el fotógrafo. Los pedidos que le tocan al fotógrafo aparecen en «Pedidos escolares»
 * → «Por canjear» → «Te toca elegir».
 */
export default function QuienEligeFotosCard({ albumId }: { albumId: number }) {
  const [guardada, setGuardada] = useState<Regla | null>(null);
  const [regla, setRegla] = useState<Regla | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/dashboard/albums/${albumId}/quien-elige`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as Regla;
    setGuardada(data);
    setRegla(data);
  }, [albumId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!regla || !guardada) return null;

  const sinGuardar = regla.mode !== guardada.mode || regla.familyDays !== guardada.familyDays;

  async function guardar() {
    if (!regla) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/quien-elige`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regla),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar.");
      const nueva = { mode: data.mode, familyDays: data.familyDays } as Regla;
      setGuardada(nueva);
      setRegla(nueva);
      setMensaje("Guardado. Los packs que ya se canjearon no cambian.");
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="w-full max-w-3xl rounded-xl border border-[#e5e7eb] bg-white p-5 space-y-3">
      <h3 className="m-0 text-base font-semibold text-[#1a1a1a]">¿Quién elige las fotos?</h3>
      <div className="space-y-2" role="radiogroup" aria-label="Quién elige las fotos">
        {MODOS_ELECCION.map((m) => (
          <label
            key={m}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
              regla.mode === m ? "border-[#c27b3d] bg-[#fef7f3]" : "border-[#e5e7eb]"
            }`}
          >
            <input
              type="radio"
              name={`quien-elige-${albumId}`}
              className="mt-1"
              checked={regla.mode === m}
              onChange={() => setRegla({ ...regla, mode: m })}
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-semibold text-[#1a1a1a]">{TEXTOS_MODO[m].titulo}</span>
              <span className="block text-sm text-[#4b5563]">{TEXTOS_MODO[m].ayuda}</span>
            </span>
          </label>
        ))}
      </div>
      {regla.mode === "FAMILY_THEN_PHOTOGRAPHER" ? (
        <label className="flex items-center gap-2 text-sm text-[#1a1a1a]">
          Días que tiene la familia
          <input
            type="number"
            min={1}
            max={60}
            value={regla.familyDays}
            onChange={(e) =>
              setRegla({ ...regla, familyDays: Number.parseInt(e.target.value, 10) || DIAS_POR_DEFECTO })
            }
            className="w-20 rounded-md border border-[#d1d5db] px-2 py-1"
          />
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando || !sinGuardar}
          className="rounded-lg bg-[#c27b3d] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {sinGuardar ? <span className="text-sm font-medium text-[#b45309]">Sin guardar</span> : null}
        {mensaje && !sinGuardar ? <span className="text-sm text-[#4b5563]">{mensaje}</span> : null}
      </div>
    </section>
  );
}
