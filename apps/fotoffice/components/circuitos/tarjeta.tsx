"use client";

import Link from "next/link";
import type { DragEvent } from "react";
import type { TarjetaVista } from "@/lib/circuitos/tablero";
import { AlarmClock, CalendarDays, Clock, ListChecks, CirclePause } from "lucide-react";
import { formatoPesos } from "@/lib/consultas/valor";
import { iniciales } from "@/lib/circuitos/tablero-vista";
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
  const meta = tarjeta.categoria ? [tarjeta.categoria, tarjeta.fechaEvento].filter(Boolean).join(" · ") : (sujeto.subtitulo ?? null);
  const tareasCompletas = tareas.total > 0 && tareas.hechas === tareas.total;
  return (
    <li
      draggable={arrastrable && !ocupada}
      onDragStart={onArrastrar}
      onDragEnd={onSoltar}
      aria-busy={ocupada || undefined}
      data-vencida={tarjeta.vencida || undefined}
      className={`group relative space-y-2.5 rounded-[var(--fo-radius-sm)] border bg-[var(--fo-surface)] p-3 text-sm shadow-[var(--fo-shadow-xs)] transition-[box-shadow,border-color,transform] duration-150 hover:border-[var(--fo-border-strong)] hover:shadow-[var(--fo-shadow-md)] focus-within:border-[var(--fo-accent)] focus-within:ring-2 focus-within:ring-[var(--fo-accent-muted)] ${
        tarjeta.vencida ? "border-[var(--fo-danger-border)] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r before:bg-[var(--fo-danger)] before:content-['']" : "border-[var(--fo-border)]"
      } ${arrastrable ? "cursor-grab active:cursor-grabbing" : ""} ${ocupada ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] leading-4">
        <span className="tabular-nums text-[var(--fo-muted-soft)]">{tarjeta.numero ? `N° ${tarjeta.numero}` : null}</span>
        <span className="flex shrink-0 items-center gap-1">
          {tarjeta.suspendido ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fo-warning-soft)] px-1.5 py-0.5 font-medium text-[var(--fo-warning)]">
              <CirclePause className="size-3" aria-hidden="true" /> Suspendido
            </span>
          ) : null}
          {tarjeta.vencida ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fo-danger-soft)] px-1.5 py-0.5 font-medium text-[var(--fo-danger)]">
              <AlarmClock className="size-3" aria-hidden="true" /> Vencida
            </span>
          ) : null}
        </span>
      </div>

      <div className="min-w-0 space-y-1">
        <Link
          href={sujeto.href}
          className="line-clamp-2 font-semibold leading-snug text-[var(--fo-text)] outline-none hover:text-[var(--fo-accent-hover)] focus-visible:underline"
          draggable={false}
          title={sujeto.titulo}
        >
          {sujeto.titulo}
        </Link>
        {meta ? (
          // Con ficha de la etapa 1: categoría y día del evento (fecha de calendario).
          <p className="flex items-center gap-1.5 truncate text-xs text-[var(--fo-muted)]">
            {tarjeta.fechaEvento ? <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" /> : null}
            <span className="truncate">{meta}</span>
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--fo-muted)]">
          {tarjeta.valor !== null ? (
            <span className="font-semibold tabular-nums text-[var(--fo-text)]" title="Valor estimado">
              {formatoPesos(tarjeta.valor)}
            </span>
          ) : null}
          <span className={`inline-flex items-center gap-1 tabular-nums ${tarjeta.vencida ? "text-[var(--fo-danger)]" : ""}`} title="Tiempo en esta etapa">
            <Clock className="size-3.5" aria-hidden="true" />
            {textoDias(tarjeta.diasEnEtapa)}
          </span>
          {tareas.total > 0 ? (
            <span
              className={`inline-flex items-center gap-1 tabular-nums ${tareasCompletas ? "text-[var(--fo-success)]" : ""}`}
              title="Tareas hechas de esta etapa"
            >
              <ListChecks className="size-3.5" aria-hidden="true" />
              {tareas.hechas}/{tareas.total}
              <span className="sr-only"> tareas</span>
            </span>
          ) : null}
        </div>
        {responsable ? (
          <span
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent-soft)] text-[10px] font-semibold text-[var(--fo-accent-hover)] ring-2 ring-[var(--fo-surface)]"
            title={`Responsable: ${responsable}`}
          >
            <span aria-hidden="true">{iniciales(responsable)}</span>
            <span className="sr-only">Responsable: {responsable}</span>
          </span>
        ) : null}
      </div>

      <div className="-mx-1 -mb-1 border-t border-[var(--fo-border-muted)] pt-1">
      <MoverA titulo={sujeto.titulo} etapas={etapasDestino} salidas={salidas} deshabilitado={ocupada} onElegir={onMover} />
      </div>

      {aviso ? (
        <div role="alert" className="space-y-1 rounded-md border border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] p-2 text-xs text-[var(--fo-danger)]">
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
