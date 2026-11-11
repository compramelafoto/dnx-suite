"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { instantaneasImpresasAction } from "@/app/actions/proyectos-proveedor";

/** Abrir el trabajo (ahí está el ZIP con las fotos) y «Ya las imprimí» (pasa a Listo y avisa al cliente). */
export function InstantaneaAcciones({ proyectoId }: { proyectoId: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  function impresas() {
    setMensaje(null);
    empezar(async () => {
      try {
        const r = await instantaneasImpresasAction(proyectoId);
        if (!r.ok) return setMensaje({ ok: false, texto: r.error });
        setMensaje({ ok: true, texto: `Pasó a «${r.etapa ?? "Listo"}».${r.avisado ? ` ${r.avisado}` : r.avisoError ? ` ${r.avisoError}` : ""}` });
        router.refresh();
      } catch {
        setMensaje({ ok: false, texto: "No se pudo marcar. Revisá la conexión y probá de nuevo." });
      }
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex items-center gap-3">
        <Link className="underline" href={`/proyectos/${proyectoId}`}>
          Abrir el trabajo
        </Link>
        <button type="button" className="fo-btn fo-btn-primary px-3 py-1 text-xs" onClick={impresas} disabled={pendiente}>
          {pendiente ? "Marcando…" : "Ya las imprimí"}
        </button>
      </span>
      {mensaje ? <span className={`text-xs ${mensaje.ok ? "text-[var(--fo-muted)]" : "text-red-600"}`}>{mensaje.texto}</span> : null}
    </span>
  );
}
