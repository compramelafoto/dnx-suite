"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enlaceDeFirmanteContratoAction, reenviarEnlaceContratoAction } from "@/app/actions/contratos";
import { ETIQUETA_ESTADO_FIRMANTE, type FirmanteFicha } from "@/lib/contratos/ficha-etiquetas";
import { fechaHoraBA } from "@/lib/ficha/formato";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

const CLASE_ESTADO: Record<FirmanteFicha["estado"], string> = {
  PENDIENTE: "bg-gray-100 text-gray-700",
  VISTO: "bg-blue-100 text-blue-800",
  VERIFICADO: "bg-violet-100 text-violet-800",
  FIRMADO: "bg-green-100 text-green-800",
  RECHAZADO: "bg-red-100 text-red-800",
};

/**
 * Los firmantes de la versión vigente, con el paso en el que está cada uno. Con "Gestionar": "Copiar enlace"
 * (para mandarlo por otro medio) y "Reenviar" (cambia el enlace, le da 30 días nuevos y lo manda por correo).
 */
export function FirmantesContrato({ firmantes, puedeGestionar }: { firmantes: FirmanteFicha[]; puedeGestionar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [manual, setManual] = useState<{ firmanteId: string; url: string } | null>(null);

  function copiar(firmanteId: string) {
    setError(null);
    setAviso(null);
    setManual(null);
    iniciar(async () => {
      const r = await enlaceDeFirmanteContratoAction(firmanteId).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      try {
        await navigator.clipboard.writeText(r.url);
        setAviso("Enlace copiado. Quien lo tenga puede firmar: mandáselo sólo a esa persona.");
      } catch {
        setManual({ firmanteId, url: r.url });
      }
    });
  }

  function reenviar(firmanteId: string) {
    setError(null);
    setAviso(null);
    setManual(null);
    iniciar(async () => {
      const r = await reenviarEnlaceContratoAction(firmanteId).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      setAviso("Listo: el enlace anterior dejó de servir y la persona recibe un correo con el nuevo.");
      router.refresh();
    });
  }

  if (firmantes.length === 0) return <p className="text-sm text-[var(--fo-muted)]">Todavía no hay firmantes: se arman cuando se manda el contrato a firmar.</p>;

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-[var(--fo-border)] text-sm">
        {firmantes.map((f) => (
          <li key={f.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-[var(--fo-text)]">
                  {f.orden}. {f.nombre}
                </p>
                <p className="break-all text-xs text-[var(--fo-muted)]">
                  {f.email}
                  {f.documento ? ` · Doc. ${f.documento}` : ""}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_ESTADO[f.estado]}`}>{ETIQUETA_ESTADO_FIRMANTE[f.estado]}</span>
            </div>
            <p className="text-xs text-[var(--fo-muted)]">
              {f.firmadoEn ? `Firmó el ${fechaHoraBA(f.firmadoEn)}.` : null}
              {f.rechazadoEn ? `Rechazó el ${fechaHoraBA(f.rechazadoEn)}.` : null}
              {!f.firmadoEn && !f.rechazadoEn && f.vistoEn ? `Abrió el enlace el ${fechaHoraBA(f.vistoEn)}.` : null}
              {f.vencido ? " El enlace venció: reenvialo." : null}
            </p>
            {f.motivoRechazo ? <p className="text-xs text-[var(--fo-text)]">Motivo: {f.motivoRechazo}</p> : null}
            {puedeGestionar && f.puedeEnlace ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente || f.vencido} onClick={() => copiar(f.id)}>
                  Copiar enlace
                </button>
                <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente} onClick={() => reenviar(f.id)}>
                  Reenviar
                </button>
              </div>
            ) : null}
            {manual?.firmanteId === f.id ? (
              <label className="block space-y-1 pt-1 text-xs">
                <span className="text-[var(--fo-muted)]">No pudimos copiarlo solos: copialo de acá.</span>
                <input className="fo-input w-full" readOnly value={manual.url} onFocus={(e) => e.currentTarget.select()} />
              </label>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p role="status" className="text-sm text-[var(--fo-muted)]">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
