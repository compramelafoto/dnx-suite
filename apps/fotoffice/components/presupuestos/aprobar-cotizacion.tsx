"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aprobarCotizacionAction, descartarCotizacionAction } from "@/app/actions/presupuestos";
import { AVISO_CAMBIOS_SIN_GUARDAR, hayCambiosSinGuardar } from "./cambios-sin-guardar";

/**
 * El último resultado (en esta pestaña). Al aprobar o descartar, la página se refresca y la fila o
 * el aviso desaparecen: el resultado se sigue mostrando con `UltimoResultadoAprobacion`.
 */
let ultimo: { presupuestoId: string; ok: boolean; texto: string; en: number } | null = null;
const VIGENCIA_MS = 60_000;

/** El resultado de la última aprobación (de ese presupuesto, o de cualquiera), si es reciente. */
export function UltimoResultadoAprobacion({ presupuestoId }: { presupuestoId?: string }) {
  const [r] = useState(() =>
    ultimo && Date.now() - ultimo.en < VIGENCIA_MS && (!presupuestoId || ultimo.presupuestoId === presupuestoId) ? ultimo : null,
  );
  if (!r) return null;
  return (
    <p role="status" className={`fo-card text-sm ${r.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`}>
      {r.texto}
    </p>
  );
}

/**
 * «Aprobar y enviar al cliente» de una cotización que armó el bot (el mismo camino que el botón de
 * Telegram) y, en la lista, «Descartar». Con cambios sin guardar en el editor de ese presupuesto,
 * no aprueba: pide guardar primero para no mandar la versión vieja.
 */
export function AprobarCotizacion({
  aprobacionId,
  presupuestoId,
  conDescartar = false,
  compacto = false,
}: {
  aprobacionId: string;
  presupuestoId: string;
  conDescartar?: boolean;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  function aprobar() {
    if (hayCambiosSinGuardar(presupuestoId)) {
      setResultado({ ok: false, texto: AVISO_CAMBIOS_SIN_GUARDAR });
      return;
    }
    setResultado(null);
    iniciar(async () => {
      const r = await aprobarCotizacionAction(aprobacionId).catch(() => ({ ok: false as const, error: "No se pudo enviar. Probá de nuevo." }));
      const res = r.ok ? { ok: true, texto: r.texto } : { ok: false, texto: r.error };
      setResultado(res);
      ultimo = { presupuestoId, ...res, en: Date.now() };
      router.refresh();
    });
  }

  function descartar() {
    if (!window.confirm("¿Descartar esta cotización? Deja de aparecer en la lista y no se le manda nada al cliente.")) return;
    setResultado(null);
    iniciar(async () => {
      const r = await descartarCotizacionAction(aprobacionId).catch(() => ({ ok: false as const, error: "No se pudo descartar. Probá de nuevo." }));
      const res = r.ok ? { ok: true, texto: r.texto } : { ok: false, texto: r.error };
      setResultado(res);
      ultimo = { presupuestoId, ...res, en: Date.now() };
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={aprobar} disabled={pendiente} className={`fo-btn fo-btn-primary ${compacto ? "text-xs" : "text-sm"}`}>
          {pendiente ? "Enviando…" : compacto ? "Aprobar y enviar" : "Aprobar y enviar al cliente"}
        </button>
        {conDescartar ? (
          <button type="button" onClick={descartar} disabled={pendiente} className={`fo-btn fo-btn-secondary ${compacto ? "text-xs" : "text-sm"}`}>
            Descartar
          </button>
        ) : null}
      </div>
      {resultado ? (
        <p role="status" className={`text-sm ${resultado.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`}>
          {resultado.texto}
        </p>
      ) : null}
    </div>
  );
}
