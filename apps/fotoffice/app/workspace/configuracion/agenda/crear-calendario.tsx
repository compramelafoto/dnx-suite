"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearCalendarioAgendaAction } from "@/app/actions/agenda";

/** Botón «Crear calendario «<organización> Agenda»»: crea el calendario propio en Google y refresca el estado. */
export function CrearCalendario({ nombre }: { nombre: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function crear() {
    setError(null);
    iniciar(async () => {
      try {
        const r = await crearCalendarioAgendaAction();
        if (!r.ok) return setError(r.error);
        router.refresh();
      } catch {
        setError("No pudimos crear el calendario. Probá de nuevo en un rato.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" className="fo-btn fo-btn-primary min-h-11" disabled={pendiente} onClick={crear}>
        {pendiente ? "Creando…" : `Crear calendario «${nombre}»`}
      </button>
      {error ? (
        <p className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
