"use client";

import { useTransition } from "react";
import { cancelar, reactivar } from "@/lib/actividades/acciones";

export function BotonesPublicada({ id, cancelada }: { id: string; cancelada: boolean }) {
  const [pendiente, start] = useTransition();
  return cancelada ? (
    <button disabled={pendiente} className="rounded-[2px] border px-4 py-2" onClick={() => start(async () => { await reactivar(id); })}>Quitar el cartel de cancelada</button>
  ) : (
    <button disabled={pendiente} className="rounded-[2px] border border-[var(--mf-accent)] px-4 py-2 text-[var(--mf-accent)]"
      onClick={() => { if (confirm("¿Marcar como cancelada? Va a seguir visible con el cartel «Cancelada».")) start(async () => { await cancelar(id); }); }}>
      Se suspendió: marcar como cancelada
    </button>
  );
}
