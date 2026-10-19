"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, QrCode, X } from "lucide-react";
import { formatMinorArs } from "@/lib/membership/money";
import { cancelarCobroQrAction, estadoCobroQrAction, iniciarCobroQrAction } from "./pedido-actions";

type Estado =
  | { tipo: "LIBRE"; aviso: string | null }
  | { tipo: "CREANDO" }
  | { tipo: "ESPERANDO"; ordenId: string; montoMinor: number; desde: number }
  | { tipo: "PAGADO"; ordenId: string; montoMinor: number };

const CADA_MS = 3000;

/**
 * Cobrar con el QR fijo del mostrador: el monto aparece en el celular del cliente al escanear.
 * Mientras espera, pregunta a Mercado Pago cada 3 segundos; cuando se acredita avisa con
 * `onPagado` y el mostrador registra la venta sola. Si el ticket cambia, se cierra la pantalla o se
 * cancela, la order se cancela en Mercado Pago para que el QR no siga cobrando ese monto.
 */
export function CobroQr({
  montoMinor,
  descripcion,
  pagadoId,
  onPagado,
}: {
  montoMinor: number;
  descripcion: string;
  /** La order ya pagada de este ticket (para no volver a pedir el pago si el registro falló). */
  pagadoId: string | null;
  onPagado: (o: { id: string; montoMinor: number }) => void;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: "LIBRE", aviso: null });
  const onPagadoRef = useRef(onPagado);
  const montoRef = useRef(montoMinor);
  useEffect(() => {
    onPagadoRef.current = onPagado;
    montoRef.current = montoMinor;
  });

  // Esperando: consulta periódica, y cancelar si cambia el monto o se va de la pantalla.
  const ordenEsperando = estado.tipo === "ESPERANDO" ? estado.ordenId : null;
  const montoEsperando = estado.tipo === "ESPERANDO" ? estado.montoMinor : null;
  useEffect(() => {
    if (!ordenEsperando || montoEsperando === null) return;
    let vigente = true;
    let terminada = false;
    const tick = async () => {
      if (!vigente) return;
      if (montoRef.current !== montoEsperando) {
        terminada = true;
        await cancelarCobroQrAction(ordenEsperando);
        if (vigente) setEstado({ tipo: "LIBRE", aviso: "El ticket cambió: volvé a mostrar el monto en el QR." });
        return;
      }
      const r = await estadoCobroQrAction(ordenEsperando);
      if (!vigente) return;
      if (r.ok) {
        if (r.orden.estado === "PAGADO") {
          terminada = true;
          setEstado({ tipo: "PAGADO", ordenId: ordenEsperando, montoMinor: r.orden.montoMinor });
          onPagadoRef.current({ id: ordenEsperando, montoMinor: r.orden.montoMinor });
          return;
        }
        if (r.orden.estado === "VENCIDO" || r.orden.estado === "CANCELADO" || r.orden.estado === "DEVUELTO") {
          terminada = true;
          setEstado({ tipo: "LIBRE", aviso: r.orden.estado === "VENCIDO" ? "Pasaron 10 minutos sin pago: el cobro venció." : "El cobro se canceló." });
          return;
        }
      }
      setTimeout(tick, CADA_MS);
    };
    const t = setTimeout(tick, CADA_MS);
    return () => {
      vigente = false;
      clearTimeout(t);
      if (!terminada) void cancelarCobroQrAction(ordenEsperando);
    };
  }, [ordenEsperando, montoEsperando]);

  async function mostrar() {
    setEstado({ tipo: "CREANDO" });
    const r = await iniciarCobroQrAction(montoMinor, descripcion);
    setEstado(r.ok ? { tipo: "ESPERANDO", ordenId: r.ordenId, montoMinor, desde: Date.now() } : { tipo: "LIBRE", aviso: r.error });
  }

  async function cancelar() {
    if (estado.tipo !== "ESPERANDO") return;
    const id = estado.ordenId;
    setEstado({ tipo: "LIBRE", aviso: null });
    const r = await cancelarCobroQrAction(id);
    if (!r.ok) setEstado({ tipo: "LIBRE", aviso: r.error });
  }

  if (pagadoId || estado.tipo === "PAGADO") {
    return (
      <div className="flex items-center gap-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-success)] p-3 text-sm font-semibold text-[var(--fo-success)]">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden />
        <span>
          Pagado con QR.
          <span className="block text-xs font-normal text-[var(--fo-muted)]">Se registra sola; si ves un error, apretá Cobrar de nuevo.</span>
        </span>
      </div>
    );
  }

  if (estado.tipo === "ESPERANDO") {
    return (
      <div className="space-y-2 rounded-[var(--fo-radius-sm)] border-2 border-[var(--fo-accent)] bg-[var(--fo-bg-elevated)] p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">Que escaneen el QR del mostrador</p>
        <p className="text-3xl font-bold tabular-nums text-[var(--fo-text)]">{formatMinorArs(estado.montoMinor)}</p>
        <p className="inline-flex items-center gap-1.5 text-sm text-[var(--fo-muted)]">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Esperando el pago…
        </p>
        <div>
          <button type="button" onClick={cancelar} className="fo-btn fo-btn-ghost inline-flex items-center gap-1 text-xs">
            <X className="size-3.5" aria-hidden /> Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={mostrar}
        disabled={estado.tipo === "CREANDO" || montoMinor < 100}
        className="fo-btn fo-btn-secondary inline-flex w-full items-center justify-center gap-1.5 text-sm"
      >
        <QrCode className="size-4" aria-hidden />
        {estado.tipo === "CREANDO" ? "Preparando el QR…" : `Cobrar ${formatMinorArs(montoMinor)} con el QR`}
      </button>
      {estado.tipo === "LIBRE" && estado.aviso ? <p className="text-xs text-[var(--fo-danger)]">{estado.aviso}</p> : null}
    </div>
  );
}
