"use client";

import Link from "next/link";
import type { DragEvent } from "react";
import type { TarjetaVista } from "@/lib/circuitos/tablero";
import { formatoPesos } from "@/lib/consultas/valor";
import { MoverA, type Destino } from "./mover-a";

export type AvisoTarjeta = { mensaje: string; pendientes?: string[]; puedePasarIgual: boolean };

function textoDias(n: number): string {
  if (n === 0) return "Hoy";
  return n === 1 ? "1 día" : `${n} días`;
}

/** Una consulta en el tablero: se arrastra (pantallas grandes) o se mueve con "Mover a…". */
export function Tarjeta({
  tarjeta,
  responsable,
  arrastrable,
  ocupada,
  aviso,
  etapasDestino,
  salidas,
  onArrastrar,
  onSoltar,
  onMover,
  onPasarIgual,
  onCerrarAviso,
}: {
  tarjeta: TarjetaVista;
  responsable: string | null;
  arrastrable: boolean;
  ocupada: boolean;
  aviso: AvisoTarjeta | null;
  etapasDestino: { id: string; nombre: string }[];
  salidas: string[];
  onArrastrar: (ev: DragEvent<HTMLElement>) => void;
  onSoltar: () => void;
  onMover: (destino: Destino) => void;
  onPasarIgual: () => void;
  onCerrarAviso: () => void;
}) {
  const { sujeto, tareas } = tarjeta;
  return (
    <li
      draggable={arrastrable && !ocupada}
      onDragStart={onArrastrar}
      onDragEnd={onSoltar}
      aria-busy={ocupada || undefined}
      className={`space-y-2 rounded-lg border bg-[var(--fo-surface)] p-3 text-sm shadow-sm ${
        tarjeta.vencida ? "border-[var(--fo-danger-border)]" : "border-[var(--fo-border)]"
      } ${arrastrable ? "cursor-grab active:cursor-grabbing" : ""} ${ocupada ? "opacity-60" : ""}`}
    >
      <div className="min-w-0">
        {tarjeta.numero ? <p className="text-xs tabular-nums text-[var(--fo-muted)]">N° {tarjeta.numero}</p> : null}
        <Link href={sujeto.href} className="block truncate font-medium text-[var(--fo-text)] hover:underline" draggable={false}>
          {sujeto.titulo}
        </Link>
        {tarjeta.categoria ? (
          // Con ficha de la etapa 1: categoría y día del evento (fecha de calendario).
          <p className="truncate text-xs text-[var(--fo-muted)]">
            {[tarjeta.categoria, tarjeta.fechaEvento].filter(Boolean).join(" · ")}
          </p>
        ) : sujeto.subtitulo ? (
          <p className="truncate text-xs text-[var(--fo-muted)]">{sujeto.subtitulo}</p>
        ) : null}
        {tarjeta.valor !== null ? (
          <p className="text-xs font-medium tabular-nums text-[var(--fo-text)]" title="Valor estimado">
            {formatoPesos(tarjeta.valor)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700" title="Tiempo en esta etapa">
          {textoDias(tarjeta.diasEnEtapa)}
        </span>
        {tarjeta.vencida ? <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700">Vencida</span> : null}
        {tareas.total > 0 ? (
          <span
            className={`rounded px-1.5 py-0.5 ${tareas.hechas === tareas.total ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
            title="Tareas hechas de esta etapa"
          >
            {tareas.hechas}/{tareas.total} tareas
          </span>
        ) : null}
        {responsable ? <span className="truncate text-[var(--fo-muted)]">{responsable}</span> : null}
      </div>

      <MoverA titulo={sujeto.titulo} etapas={etapasDestino} salidas={salidas} deshabilitado={ocupada} onElegir={onMover} />

      {aviso ? (
        <div role="alert" className="space-y-1 rounded border border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] p-2 text-xs text-[var(--fo-danger)]">
          <p>{aviso.mensaje}</p>
          {aviso.pendientes && aviso.pendientes.length > 0 ? (
            <ul className="list-disc pl-4">
              {aviso.pendientes.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2 pt-1">
            {aviso.puedePasarIgual ? (
              <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={onPasarIgual} disabled={ocupada}>
                Pasar igual
              </button>
            ) : null}
            <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={onCerrarAviso}>
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
