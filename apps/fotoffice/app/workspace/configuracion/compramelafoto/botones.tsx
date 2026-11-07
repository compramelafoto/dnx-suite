"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { desconectarClfAction, sincronizarClfAhoraAction } from "./actions";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

export function BotonesConexionClf() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  function sincronizar() {
    setAviso(null);
    iniciar(async () => {
      const r = await sincronizarClfAhoraAction().catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      setAviso(r.ok ? (r.nuevas ? `Listo: ${r.nuevas} ventas nuevas.` : "Listo: no hay ventas nuevas.") : r.error);
      router.refresh();
    });
  }

  function desconectarCuenta() {
    if (!window.confirm("¿Desconectar CompraMeLaFoto? Las ventas ya traídas se conservan, pero no van a llegar nuevas.")) return;
    setAviso(null);
    iniciar(async () => {
      const r = await desconectarClfAction().catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) setAviso(r.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={sincronizar}>
          {pendiente ? "Trabajando…" : "Actualizar ahora"}
        </button>
        <button type="button" className="fo-btn fo-btn-ghost text-sm" disabled={pendiente} onClick={desconectarCuenta}>
          Desconectar
        </button>
      </div>
      {aviso ? (
        <p role="status" className="text-sm text-[var(--fo-muted)]">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
