"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, RefreshCw, SearchCheck } from "lucide-react";
import { formatMinorArs } from "@/lib/membership/money";
import type { PagoCandidato } from "@/lib/sales/verificar-pago";
import { verificarPagoAction } from "./pedido-actions";

/**
 * "Verificar pago": busca en la cuenta de Mercado Pago del negocio una transferencia (o pago) por
 * el monto exacto de las últimas dos horas. Con una sola coincidencia queda elegida; con varias,
 * se elige cuál. Lo elegido viaja con Cobrar y el servidor lo vuelve a comprobar y lo reserva,
 * así la misma transferencia no sirve para dos ventas.
 */
export function VerificarPago({
  montoMinor,
  verificado,
  onVerificado,
  compacto = false,
}: {
  montoMinor: number;
  verificado: PagoCandidato | null;
  onVerificado: (p: PagoCandidato | null) => void;
  compacto?: boolean;
}) {
  const [buscando, start] = useTransition();
  const [resultado, setResultado] = useState<{ montoMinor: number; candidatos: PagoCandidato[] } | { error: string } | null>(null);
  const vigente = verificado && verificado.montoMinor === montoMinor ? verificado : null;

  function buscar() {
    onVerificado(null);
    start(async () => {
      const r = await verificarPagoAction(montoMinor);
      if (!r.ok) {
        setResultado({ error: r.error });
        return;
      }
      setResultado({ montoMinor, candidatos: r.candidatos });
      if (r.candidatos.length === 1) onVerificado(r.candidatos[0]!);
    });
  }

  if (vigente) {
    return (
      <div className="flex items-start gap-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-success)] bg-[var(--fo-success-soft,transparent)] p-2.5 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--fo-success)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--fo-success)]">Pago recibido: {formatMinorArs(vigente.montoMinor)}</p>
          <p className="truncate text-xs text-[var(--fo-muted)]">
            {[vigente.pagador ? `De ${vigente.pagador}` : null, vigente.fecha ? `a las ${hora(vigente.fecha)}` : null, vigente.medio].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button type="button" onClick={() => onVerificado(null)} className="shrink-0 text-xs text-[var(--fo-muted)] hover:text-[var(--fo-text)] hover:underline">
          Quitar
        </button>
      </div>
    );
  }

  const deEsteMonto = resultado && "candidatos" in resultado && resultado.montoMinor === montoMinor ? resultado.candidatos : null;
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={buscar}
        disabled={buscando || montoMinor <= 0}
        className={`fo-btn fo-btn-secondary inline-flex w-full items-center justify-center gap-1.5 ${compacto ? "text-xs" : "text-sm"}`}
      >
        {deEsteMonto && deEsteMonto.length === 0 ? <RefreshCw className="size-4" aria-hidden /> : <SearchCheck className="size-4" aria-hidden />}
        {buscando ? "Buscando en Mercado Pago…" : deEsteMonto && deEsteMonto.length === 0 ? "Buscar de nuevo" : `Verificar pago de ${formatMinorArs(montoMinor)}`}
      </button>
      {resultado && "error" in resultado ? <p className="text-xs text-[var(--fo-danger)]">{resultado.error}</p> : null}
      {deEsteMonto && deEsteMonto.length === 0 ? (
        <p className="text-xs text-[var(--fo-muted)]">
          Todavía no llegó ningún pago de {formatMinorArs(montoMinor)} en las últimas dos horas. Las transferencias desde un banco pueden tardar un minuto.
        </p>
      ) : null}
      {deEsteMonto && deEsteMonto.length > 1 ? (
        <div className="space-y-1">
          <p className="text-xs text-[var(--fo-muted)]">Hay {deEsteMonto.length} pagos por ese monto. Elegí el de este cliente:</p>
          {deEsteMonto.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onVerificado(c)}
              className="flex w-full items-center justify-between gap-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] px-2.5 py-1.5 text-left text-xs hover:border-[var(--fo-accent)]"
            >
              <span className="truncate">{c.pagador ?? "Sin nombre"}</span>
              <span className="shrink-0 tabular-nums text-[var(--fo-muted)]">{c.fecha ? hora(c.fecha) : ""}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" });
}
