"use client";

import { esNeutro } from "@/lib/impresion/ajustes";
import { papelOrientado } from "@/lib/impresion/encuadre";
import { medidaEnMm } from "@/lib/impresion/laboratorio";
import { textoDeAviso } from "@/lib/impresion/lote";
import { calidadLab, textoDePieza, type FotoLabVista } from "@/lib/impresion/lote-laboratorio";
import { PapelConFoto } from "./papel-con-foto";

/** Una foto del pedido para laboratorio: sobre su papel, con «10x15 · mate · ×2 · próxima semana», aviso de calidad y «Revisada». */
export function TarjetaFotoLab({
  foto,
  elegida,
  ocupado,
  onElegir,
  onAbrir,
  onQuitar,
}: {
  foto: FotoLabVista;
  elegida: boolean;
  ocupado: boolean;
  onElegir: (v: boolean) => void;
  onAbrir: () => void;
  onQuitar: () => void;
}) {
  const p = foto.pieza;
  const papelMm = p ? medidaEnMm(p.medida) : null;
  const calidad = p ? calidadLab(foto, p) : null;
  const aviso = p && calidad ? textoDeAviso(calidad.aviso, p.medida) : null;
  return (
    <li className="fo-card space-y-2 p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={elegida} onChange={(e) => onElegir(e.target.checked)} className="accent-[var(--fo-accent)]" />
          Elegir
        </label>
        {calidad?.aviso === "PIXELADA" ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">Pixelada</span>
        ) : p?.revisada ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">Revisada</span>
        ) : null}
      </div>
      <button type="button" className="mx-auto block" onClick={onAbrir} disabled={ocupado} aria-label={`Editar ${foto.nombre}`}>
        {p && papelMm ? (
          <PapelConFoto
            src={`/api/impresion/vista/${foto.originalId}`}
            foto={{ ancho: foto.ancho, alto: foto.alto }}
            receta={p.receta}
            papelMm={papelOrientado(papelMm, p.receta.orientacion ?? "VERTICAL")}
            lado={176}
          />
        ) : (
          <span className="flex size-44 items-center justify-center rounded-[var(--fo-radius-sm)] bg-black/10 text-xs">Sin tamaño</span>
        )}
      </button>
      <p className="truncate text-xs font-medium" title={p ? textoDePieza(p) : undefined}>
        {p ? textoDePieza(p) : "Todavía sin tamaño"}
      </p>
      <p className="truncate text-xs text-[var(--fo-muted)]" title={foto.nombre}>
        {foto.nombre}
        {p ? ` · ${p.receta.modo === "ENCAJAR" ? "encajada" : "recortada"}` : ""}
        {p && !esNeutro(p.receta.ajustes) ? " · ● con ajustes" : ""}
      </p>
      {aviso ? <p className={calidad?.aviso === "PIXELADA" ? "text-xs font-medium text-[var(--fo-danger)]" : "text-xs text-amber-700"}>{aviso}</p> : null}
      <div className="flex items-end gap-2">
        <button type="button" className="fo-btn fo-btn-secondary ml-auto h-8 px-2 text-xs" disabled={ocupado} onClick={onAbrir}>
          Editar
        </button>
        <button type="button" className="fo-btn fo-btn-danger-outline h-8 px-2 text-xs" disabled={ocupado} onClick={onQuitar}>
          Quitar
        </button>
      </div>
    </li>
  );
}
