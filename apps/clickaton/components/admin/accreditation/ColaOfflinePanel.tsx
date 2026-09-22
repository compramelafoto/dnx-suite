"use client";

import { Button } from "@/components/ui/Button";
import type { EntradaOffline, EstadoEntrada } from "@/lib/accreditation/ui/offline-queue";
import { horaAr } from "@/lib/fecha-ar";

/** Cómo se ve cada estado en la lista de pendientes. */
const ESTADO: Record<EstadoEntrada, { texto: string; clase: string }> = {
  PENDIENTE: { texto: "Esperando señal", clase: "text-amber-300" },
  SINCRONIZADA: { texto: "Acreditado", clase: "text-emerald-300" },
  CONFLICTO: { texto: "Requiere revisión", clase: "text-amber-300" },
  RECHAZADA: { texto: "Rechazado", clase: "text-red-300" },
};

/**
 * Traduce el motivo técnico que devuelve el servidor a algo accionable en la
 * puerta. Un "ALREADY_CHECKED_IN" en pantalla no le dice nada al operador.
 */
function explicarMotivo(motivo: string | null): string | null {
  if (!motivo) return null;
  const mapa: Record<string, string> = {
    ALREADY_CHECKED_IN: "Ya estaba acreditado: no se duplicó.",
    QR_INVALID: "El QR no corresponde a esta edición.",
    SHORT_CODE_NOT_FOUND: "No hay ningún participante con ese número.",
    SHORT_CODE_TOO_SHORT: "El número quedó incompleto.",
    MISSING_IDENTIFIER: "El escaneo quedó sin datos para identificar a la persona.",
    PAYMENT_PENDING: "La inscripción figura impaga.",
    NOT_CONFIRMED: "La inscripción no está confirmada.",
    CREDENTIAL_MISSING: "No tiene credencial activa.",
    WINDOW_CLOSED: "Quedó fuera del horario de acreditación.",
    ACCREDITATION_DISABLED: "El módulo de acreditación estaba apagado.",
    DEVICE_REVOKED: "El aparato que lo tomó fue dado de baja.",
    OFFLINE_DISABLED: "Esta edición tiene el modo sin conexión apagado.",
  };
  return mapa[motivo] ?? `Motivo del servidor: ${motivo}`;
}

function hora(iso: string): string {
  return horaAr(iso);
}

type Props = {
  entradas: EntradaOffline[];
  sinResolver: number;
  enLinea: boolean;
  sincronizando: boolean;
  mensaje: string | null;
  onSincronizar: () => void;
  onQuitar: (clave: string) => void;
  onLimpiar: () => void;
};

export function ColaOfflinePanel({
  entradas,
  sinResolver,
  enLinea,
  sincronizando,
  mensaje,
  onSincronizar,
  onQuitar,
  onLimpiar,
}: Props) {
  const visibles = entradas.filter((e) => e.estado !== "SINCRONIZADA");
  const haySincronizadas = entradas.some((e) => e.estado === "SINCRONIZADA");

  return (
    <div className="space-y-3">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm ${
          enLinea
            ? "border-ck-border bg-ck-black/20"
            : "border-amber-500/60 bg-amber-500/10"
        }`}
        role="status"
        aria-live="polite"
      >
        <span className="font-semibold">
          {enLinea ? "En línea" : "Sin conexión"}
          {sinResolver > 0 ? ` · ${sinResolver} sin sincronizar` : ""}
        </span>
        {!enLinea ? (
          <span className="text-ck-text-secondary">
            Seguí escaneando: se guarda en este celular.
          </span>
        ) : null}
        {sinResolver > 0 ? (
          <Button type="button" variant="secondary" onClick={onSincronizar} disabled={sincronizando}>
            {sincronizando ? "Sincronizando…" : "Sincronizar ahora"}
          </Button>
        ) : null}
      </div>

      {mensaje ? <p className="text-sm text-ck-text-secondary">{mensaje}</p> : null}

      {visibles.length > 0 ? (
        <ul className="space-y-2 rounded border border-ck-border p-3 text-sm">
          {visibles.map((e) => {
            const explicacion = explicarMotivo(e.motivo);
            return (
              <li
                key={e.idempotencyKey}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-ck-border/50 pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {e.etiqueta}{" "}
                    <span className="text-xs text-ck-text-muted">· {hora(e.clientOccurredAt)}</span>
                  </p>
                  <p className={`text-xs ${ESTADO[e.estado].clase}`}>{ESTADO[e.estado].texto}</p>
                  {explicacion ? (
                    <p className="text-xs text-ck-text-secondary">{explicacion}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onQuitar(e.idempotencyKey)}
                  aria-label={`Quitar ${e.etiqueta} de la cola`}
                >
                  Quitar
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {haySincronizadas ? (
        <Button type="button" variant="outline" onClick={onLimpiar}>
          Limpiar las ya acreditadas
        </Button>
      ) : null}
    </div>
  );
}
