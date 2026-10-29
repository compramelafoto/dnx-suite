"use client";

import { useMemo, useState } from "react";
import { ORDENES, armarLibro, fotosSinUsar, momentos, ordenarFotos, pliegosSugeridos, type OrdenFotos } from "@/lib/fotolibro/modo/armado";
import { FOTOS_POR_PLIEGO_MAX } from "@/lib/fotolibro/modo/disenos";
import type { EstadoFotolibro } from "@/lib/fotolibro/modo/estado";
import { HOJAS_MAX } from "@/lib/fotolibro/limites";

type Props = {
  estado: EstadoFotolibro;
  /** Las fotos elegidas en la tira, si hay. */
  elegidas: string[];
  onArmar: (nuevo: EstadoFotolibro) => void;
  onCerrar: () => void;
};

type Cuales = "todas" | "sin-usar" | "elegidas";

/**
 * La ventana del armado automático: qué fotos, en cuántos pliegos y si rearma todo o sólo llena
 * lo vacío. Muestra antes de armar cuántas fotos van por pliego y cuántos momentos encontró.
 * Se deshace con ⌘Z como cualquier cambio.
 */
export function ArmadoAutomatico({ estado, elegidas, onArmar, onCerrar }: Props) {
  const sinUsar = useMemo(() => fotosSinUsar(estado), [estado]);
  const [cuales, setCuales] = useState<Cuales>(elegidas.length > 1 ? "elegidas" : "todas");
  const [orden, setOrden] = useState<OrdenFotos>(estado.orden);
  const [alcance, setAlcance] = useState<"todo" | "vacios">("todo");
  const [porMomentos, setPorMomentos] = useState(true);
  const fotos = useMemo(() => {
    if (cuales === "sin-usar") return sinUsar;
    if (cuales === "elegidas") return estado.fotos.filter((f) => elegidas.includes(f.id));
    return estado.fotos;
  }, [cuales, sinUsar, estado.fotos, elegidas]);
  const [pliegos, setPliegos] = useState(() => Math.min(HOJAS_MAX, Math.max(estado.pliegos.length, pliegosSugeridos(estado.fotos.length))));

  const vacios = estado.pliegos.filter((p) => p.todo.fotos.length + p.izq.fotos.length + p.der.fotos.length === 0).length;
  const destino = alcance === "todo" ? pliegos : vacios;
  const cantMomentos = useMemo(() => momentos(ordenarFotos(fotos, "fecha")).length, [fotos]);
  const sinHora = fotos.filter((f) => !f.tomada).length;
  const porPliego = destino ? fotos.length / destino : 0;
  const noEntran = Math.max(0, fotos.length - destino * FOTOS_POR_PLIEGO_MAX);
  const opcion = (activo: boolean) => `rounded px-2.5 py-1.5 text-left text-xs ${activo ? "bg-white/15 ring-1 ring-[var(--fo-accent)]" : "bg-white/5 hover:bg-white/10"}`;

  return (
    <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/70 p-6" onClick={onCerrar}>
      <div className="w-full max-w-lg space-y-4 rounded-lg bg-[#202124] p-5 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 className="text-base font-semibold">Armado automático</h2>
          <p className="text-xs text-white/55">Reparte las fotos en los pliegos, en orden y por momentos. Después retocás con A/Q como siempre; ⌘Z lo deshace.</p>
        </header>

        <section className="space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Qué fotos</h3>
          <div className="grid grid-cols-3 gap-1.5">
            <button type="button" className={opcion(cuales === "todas")} onClick={() => setCuales("todas")}>
              Todas ({estado.fotos.length})
            </button>
            <button type="button" className={opcion(cuales === "sin-usar")} onClick={() => setCuales("sin-usar")} disabled={!sinUsar.length}>
              Sin usar ({sinUsar.length})
            </button>
            <button type="button" className={opcion(cuales === "elegidas")} onClick={() => setCuales("elegidas")} disabled={!elegidas.length}>
              Elegidas ({elegidas.length})
            </button>
          </div>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Qué hacer con lo armado</h3>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" className={opcion(alcance === "todo")} onClick={() => setAlcance("todo")}>
              Rearmar todo el libro
            </button>
            <button type="button" className={opcion(alcance === "vacios")} onClick={() => setAlcance("vacios")} disabled={!vacios}>
              Llenar sólo los vacíos ({vacios})
            </button>
          </div>
        </section>

        {alcance === "todo" ? (
          <label className="block text-xs text-white/80">
            <span className="flex justify-between">
              <span>Pliegos</span>
              <span className="tabular-nums text-white/60">{pliegos}</span>
            </span>
            <input type="range" min={1} max={HOJAS_MAX} value={pliegos} onChange={(e) => setPliegos(Number(e.target.value))} className="mt-1 w-full accent-[var(--fo-accent)]" />
            <button type="button" className="mt-1 text-[11px] text-[var(--fo-accent)] underline" onClick={() => setPliegos(Math.min(HOJAS_MAX, pliegosSugeridos(fotos.length)))}>
              Sugerido para {fotos.length} fotos: {pliegosSugeridos(fotos.length)}
            </button>
          </label>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-xs text-white/80">
          <label className="flex items-center gap-1.5">
            Orden
            <select value={orden} onChange={(e) => setOrden(e.target.value as OrdenFotos)} className="rounded border border-white/15 bg-black/30 px-1.5 py-1">
              {ORDENES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={porMomentos} onChange={(e) => setPorMomentos(e.target.checked)} className="accent-[var(--fo-accent)]" />
            Separar por momentos{cantMomentos > 1 ? ` (${cantMomentos})` : ""}
          </label>
        </div>

        <p className="rounded bg-black/30 px-3 py-2 text-xs text-white/70">
          {fotos.length} fotos en {destino} {destino === 1 ? "pliego" : "pliegos"}: unas {porPliego.toLocaleString("es-AR", { maximumFractionDigits: 1 })} por pliego.
          {sinHora ? ` ${sinHora} sin hora de toma van al final.` : ""}
          {noEntran ? <span className="text-amber-300"> No entran {noEntran}: hasta {FOTOS_POR_PLIEGO_MAX} por pliego. Sumá pliegos.</span> : null}
          {alcance === "todo" && estado.pliegos.some((p) => p.todo.fotos.length + p.izq.fotos.length + p.der.fotos.length) ? <span className="block text-white/50">Lo armado se reemplaza (se puede deshacer).</span> : null}
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="rounded px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!fotos.length || !destino}
            onClick={() => onArmar(armarLibro({ ...estado, orden }, { fotos, orden, pliegos, alcance, porMomentos }))}
            className="rounded bg-[var(--fo-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Armar
          </button>
        </div>
      </div>
    </div>
  );
}
