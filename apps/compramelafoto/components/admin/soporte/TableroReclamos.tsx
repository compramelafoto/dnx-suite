"use client";

import { useCallback, useEffect, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Ficha } from "@/lib/soporte/tablero";
import { COLUMNAS, columnaDe, type ColumnaId } from "./columnas";
import FichaResumida from "./FichaResumida";

function Arrastrable({ ficha, seleccionada, onAbrir }: { ficha: Ficha; seleccionada: boolean; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ficha.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={isDragging ? "opacity-80" : ""}>
      <FichaResumida ficha={ficha} seleccionada={seleccionada} onAbrir={onAbrir} />
    </div>
  );
}

function Columna({ id, titulo, fichas, seleccionada, onAbrir }: { id: ColumnaId; titulo: string; fichas: Ficha[]; seleccionada: number | null; onAbrir: (id: number) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex min-h-[320px] w-[260px] shrink-0 flex-col gap-2 rounded-xl p-2 lg:w-auto ${isOver ? "bg-blue-50" : "bg-gray-100"}`}>
      <h3 className="flex justify-between px-1 text-sm font-semibold text-gray-700">
        <span>{titulo}</span>
        <span className="text-gray-500">{fichas.length}</span>
      </h3>
      {fichas.map((f) => (
        <Arrastrable key={f.id} ficha={f} seleccionada={seleccionada === f.id} onAbrir={() => onAbrir(f.id)} />
      ))}
    </div>
  );
}

/** Tablero de reclamos: cuatro columnas; arrastrar una ficha cambia su estado al instante y vuelve si el servidor lo rechaza. */
export default function TableroReclamos({ seleccionada, onAbrir, recargar }: { seleccionada: number | null; onAbrir: (id: number) => void; recargar: number }) {
  const [fichas, setFichas] = useState<Ficha[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  );

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/support/tablero", { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      setFichas(((await res.json()) as { fichas: Ficha[] }).fichas);
      setError(null);
    } catch {
      setError("No se pudo cargar el tablero.");
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar, recargar]);
  // El reloj avanza solo: se refresca cada minuto.
  useEffect(() => {
    const t = setInterval(() => void cargar(), 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  const alSoltar = async (e: DragEndEvent) => {
    const destino = e.over?.id as ColumnaId | undefined;
    const id = Number(e.active.id);
    const ficha = fichas?.find((f) => f.id === id);
    if (!destino || !ficha || columnaDe(ficha.status) === destino) return;
    const antes = fichas;
    setFichas((xs) => xs?.map((f) => (f.id === id ? { ...f, status: destino, reloj: destino === "OPEN" || destino === "IN_PROGRESS" ? f.reloj : null } : f)) ?? xs);
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: destino }),
      });
      if (!res.ok) throw new Error(String(res.status));
      void cargar();
    } catch {
      setFichas(antes);
      setError(`No se pudo mover el reclamo #${id}.`);
    }
  };

  if (!fichas) return <p className="py-10 text-center text-gray-500">{error ?? "Cargando reclamos…"}</p>;
  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <DndContext sensors={sensors} onDragEnd={alSoltar}>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {COLUMNAS.map((c) => (
            <Columna key={c.id} id={c.id} titulo={c.titulo} fichas={fichas.filter((f) => columnaDe(f.status) === c.id)} seleccionada={seleccionada} onAbrir={onAbrir} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
