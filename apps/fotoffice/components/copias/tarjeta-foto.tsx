"use client";

import { esNeutro } from "@/lib/impresion/ajustes";
import { papelOrientado, type Papel } from "@/lib/impresion/encuadre";
import { CANTIDAD_MAX, textoDeAviso } from "@/lib/impresion/lote";
import type { FotoCopia } from "@/lib/impresion/copias";
import { PapelConFoto } from "./papel-con-foto";

/** Una foto de la grilla (spec §6): sobre el papel real, con tamaño, impresora, cantidad, aviso, ajustes, "Revisada" y su error. */
export function TarjetaFoto({
  foto,
  papel,
  salida,
  elegida,
  ocupado,
  error = null,
  onElegir,
  onAbrir,
  onCantidad,
  onQuitar,
}: {
  foto: FotoCopia;
  papel: Papel & { nombre: string };
  salida: string;
  elegida: boolean;
  ocupado: boolean;
  /** Lo que salió mal con esta foto (p. ej. al armar su hoja); las demás siguen. */
  error?: string | null;
  onElegir: (v: boolean) => void;
  onAbrir: () => void;
  onCantidad: (n: number) => void;
  onQuitar: () => void;
}) {
  const p = foto.pieza;
  const aviso = p ? textoDeAviso(p.aviso, papel.nombre) : null;
  return (
    <li className="fo-card space-y-2 p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={elegida} onChange={(e) => onElegir(e.target.checked)} className="accent-[var(--fo-accent)]" />
          Elegir
        </label>
        {p?.revisada ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">Revisada</span> : null}
      </div>
      <button type="button" className="mx-auto block" onClick={onAbrir} aria-label={`Editar ${foto.nombre}`}>
        {p ? (
          <PapelConFoto
            src={`/api/impresion/vista/${foto.originalId}`}
            foto={{ ancho: foto.ancho, alto: foto.alto }}
            receta={p.receta}
            papelMm={papelOrientado(papel, p.receta.orientacion ?? "VERTICAL")}
            lado={176}
          />
        ) : (
          <span className="flex size-44 items-center justify-center rounded-[var(--fo-radius-sm)] bg-black/10 text-xs">Sin armar</span>
        )}
      </button>
      <p className="truncate text-xs text-[var(--fo-muted)]" title={foto.nombre}>
        {papel.nombre} · {salida} · {p?.receta.modo === "ENCAJAR" ? "encajada" : "recortada"}
        {p && !esNeutro(p.receta.ajustes) ? " · ● con ajustes" : ""}
      </p>
      {error ? <p className="text-xs font-medium text-[var(--fo-danger)]">{error}</p> : null}
      {aviso ? <p className={p?.aviso === "PIXELADA" ? "text-xs font-medium text-[var(--fo-danger)]" : "text-xs text-amber-700"}>{aviso}</p> : null}
      <div className="flex items-end gap-2">
        <label className="text-xs">
          Copias
          <input
            key={p?.cantidad ?? 0}
            type="number"
            min={1}
            max={CANTIDAD_MAX}
            defaultValue={p?.cantidad ?? 1}
            disabled={!p || ocupado}
            onBlur={(e) => onCantidad(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="fo-input mt-0.5 h-8 w-16"
          />
        </label>
        <button type="button" className="fo-btn fo-btn-secondary ml-auto h-8 px-2 text-xs" onClick={onAbrir}>
          Editar
        </button>
        <button type="button" className="fo-btn fo-btn-danger-outline h-8 px-2 text-xs" disabled={ocupado} onClick={onQuitar}>
          Quitar
        </button>
      </div>
    </li>
  );
}
