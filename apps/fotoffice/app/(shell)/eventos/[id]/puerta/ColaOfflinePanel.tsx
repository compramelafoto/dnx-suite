"use client";

import type { EntradaOffline, EstadoEntrada } from "@/lib/eventos/acreditacion/ui/offline-queue";

/** Cómo se ve cada estado en la lista de pendientes. */
const ESTADO: Record<EstadoEntrada, { texto: string; clase: string }> = {
  PENDIENTE: { texto: "Esperando señal", clase: "text-amber-600" },
  SINCRONIZADA: { texto: "Acreditado", clase: "text-emerald-600" },
  CONFLICTO: { texto: "Requiere revisión", clase: "text-amber-600" },
  RECHAZADA: { texto: "Rechazado", clase: "text-red-600" },
};

/**
 * Traduce el motivo técnico que devuelve el servidor a algo accionable en la
 * puerta. Un "ALREADY_CHECKED_IN" en pantalla no le dice nada al operador.
 */
function explicarMotivo(motivo: string | null): string | null {
  if (!motivo) return null;
  const mapa: Record<string, string> = {
    ALREADY_CHECKED_IN: "Ya estaba acreditado: no se duplicó.",
    QR_INVALID: "El QR no corresponde a este evento.",
    SHORT_CODE_NOT_FOUND: "No hay ninguna entrada con ese código.",
    MISSING_IDENTIFIER: "El escaneo quedó sin datos para identificar a la persona.",
    PAYMENT_PENDING: "La entrada figura impaga: revisala en el listado.",
    ACCREDITATION_DISABLED: "La acreditación estaba apagada.",
    REGISTRATION_INACTIVE: "La entrada está anulada.",
    NOT_FOUND: "No se encontró a esa persona en este evento.",
  };
  return mapa[motivo] ?? `Motivo del servidor: ${motivo}`;
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
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
            ? "border-[var(--fo-border)]"
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
          <span className="text-[var(--fo-muted)]">
            Seguí escaneando: se guarda en este celular.
          </span>
        ) : null}
        {sinResolver > 0 ? (
          <button type="button" className="fo-btn fo-btn-secondary" onClick={onSincronizar} disabled={sincronizando}>
            {sincronizando ? "Sincronizando…" : "Sincronizar ahora"}
          </button>
        ) : null}
      </div>

      {mensaje ? <p className="text-sm text-[var(--fo-muted)]">{mensaje}</p> : null}

      {visibles.length > 0 ? (
        <ul className="space-y-2 rounded border border-[var(--fo-border)] p-3 text-sm">
          {visibles.map((e) => {
            const explicacion = explicarMotivo(e.motivo);
            return (
              <li
                key={e.idempotencyKey}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--fo-border)] pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {e.etiqueta}{" "}
                    <span className="text-xs text-[var(--fo-muted)]">· {hora(e.clientOccurredAt)}</span>
                  </p>
                  <p className={`text-xs ${ESTADO[e.estado].clase}`}>{ESTADO[e.estado].texto}</p>
                  {explicacion ? (
                    <p className="text-xs text-[var(--fo-muted)]">{explicacion}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="fo-btn fo-btn-ghost"
                  onClick={() => onQuitar(e.idempotencyKey)}
                  aria-label={`Quitar ${e.etiqueta} de la cola`}
                >
                  Quitar
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {haySincronizadas ? (
        <button type="button" className="fo-btn fo-btn-ghost" onClick={onLimpiar}>
          Limpiar las ya acreditadas
        </button>
      ) : null}
    </div>
  );
}
