"use client";

import { useEffect, useState } from "react";
import {
  DIAS_POR_DEFECTO,
  MODOS_ELECCION,
  TEXTOS_MODO,
  esModoEleccion,
  type ReglaEleccion,
} from "@/lib/schools/quien-elige-las-fotos";

type Props = {
  albumId: number;
  albumTitulo: string;
  /** Después de guardar: la pantalla recarga los pedidos (cambia quién tiene que elegir). */
  onGuardado: () => void;
};

/**
 * «¿Quién elige las fotos?» dentro de Pedidos escolares, para el álbum elegido. Es la misma regla
 * que la tarjeta de la pestaña Preventa del álbum (`QuienEligeFotosCard`) y usa la misma API.
 */
export default function QuienEligeEnPedidos({ albumId, albumTitulo, onGuardado }: Props) {
  const [guardada, setGuardada] = useState<ReglaEleccion | null>(null);
  const [regla, setRegla] = useState<ReglaEleccion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{
    tono: "ok" | "error";
    texto: string;
  } | null>(null);

  useEffect(() => {
    let activo = true;
    setGuardada(null);
    setRegla(null);
    setMensaje(null);
    fetch(`/api/dashboard/albums/${albumId}/quien-elige`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ReglaEleccion | null) => {
        if (!activo || !data) return;
        setGuardada(data);
        setRegla(data);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [albumId]);

  if (!regla || !guardada) {
    return <div className="text-sm text-gray-500">Cargando quién elige las fotos…</div>;
  }

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
      const nueva: ReglaEleccion = {
        mode: data.mode,
        familyDays: data.familyDays,
      };
      setGuardada(nueva);
      setRegla(nueva);
      setMensaje({
        tono: "ok",
        texto: "Guardado. Los packs que ya se canjearon no cambian.",
      });
      onGuardado();
    } catch (e) {
      setMensaje({
        tono: "error",
        texto: e instanceof Error ? e.message : "No se pudo guardar.",
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1" htmlFor={`quien-elige-${albumId}`}>
            ¿Quién elige las fotos en «{albumTitulo}»?
          </label>
          <select
            id={`quien-elige-${albumId}`}
            value={regla.mode}
            disabled={guardando}
            onChange={(e) => {
              const m = e.target.value;
              if (esModoEleccion(m)) setRegla({ ...regla, mode: m });
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {MODOS_ELECCION.map((m) => (
              <option key={m} value={m}>
                {TEXTOS_MODO[m].titulo}
              </option>
            ))}
          </select>
        </div>
        {regla.mode === "FAMILY_THEN_PHOTOGRAPHER" ? (
          <div>
            <label className="block text-xs text-gray-600 mb-1" htmlFor={`quien-elige-dias-${albumId}`}>
              Días que tiene la familia
            </label>
            <input
              id={`quien-elige-dias-${albumId}`}
              type="number"
              min={1}
              max={60}
              disabled={guardando}
              value={regla.familyDays}
              onChange={(e) =>
                setRegla({
                  ...regla,
                  familyDays: Number.parseInt(e.target.value, 10) || DIAS_POR_DEFECTO,
                })
              }
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando || !sinGuardar}
          className="rounded-lg bg-[#c27b3d] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {sinGuardar ? <span className="pb-2 text-sm font-medium text-[#b45309]">Sin guardar</span> : null}
      </div>
      <p className="m-0 text-xs text-gray-600">{TEXTOS_MODO[regla.mode].ayuda}</p>
      {mensaje && !sinGuardar ? (
        <p className={`m-0 text-xs ${mensaje.tono === "ok" ? "text-gray-600" : "text-red-700"}`}>{mensaje.texto}</p>
      ) : null}
    </div>
  );
}
