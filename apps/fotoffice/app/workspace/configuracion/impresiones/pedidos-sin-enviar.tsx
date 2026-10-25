"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { reintentarEnvioAction } from "@/app/actions/impresiones";

export type FilaSinEnviar = { pedidoId: string; numero: number; cliente: string; pagadoEl: string; total: string; lastError: string | null };

/**
 * Pedidos pagados que no salieron al laboratorio, con «Reintentar envío». Es el único lugar desde donde se
 * reintenta un pedido que ni siquiera tiene trabajo (por ejemplo, porque no había circuito al cobrarlo).
 */
export function PedidosSinEnviar({ filas }: { filas: FilaSinEnviar[] }) {
  const router = useRouter();
  const [mensajes, setMensajes] = useState<Record<string, { ok: boolean; texto: string }>>({});
  const [ocupado, start] = useTransition();

  function reintentar(pedidoId: string) {
    start(async () => {
      const r = await reintentarEnvioAction(pedidoId);
      setMensajes((m) => ({
        ...m,
        [pedidoId]: r.ok ? { ok: true, texto: "Listo: en unos minutos se vuelve a preparar y mandar al laboratorio." } : { ok: false, texto: r.error },
      }));
      if (r.ok) router.refresh();
    });
  }

  return (
    <section aria-labelledby="sin-enviar-titulo" className="fo-card space-y-3 p-5">
      <h2 id="sin-enviar-titulo" className="text-base font-semibold">
        Pedidos pagados sin enviar
      </h2>
      <p className="text-sm text-[var(--fo-muted)]">Estos pedidos ya se cobraron pero no salieron al laboratorio. Arreglá el motivo y tocá «Reintentar envío».</p>
      <ul className="divide-y divide-[var(--fo-border)]">
        {filas.map((f) => (
          <li key={f.pedidoId} className="space-y-2 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">
                Pedido N° {f.numero} · {f.cliente}
              </span>
              <span className="tabular-nums text-[var(--fo-muted)]">
                {f.pagadoEl ? `Pagado el ${f.pagadoEl} · ` : ""}
                {f.total}
              </span>
            </div>
            <p className="text-sm text-[var(--fo-warning)]">{f.lastError ?? "El pedido está pagado pero no salió al laboratorio."}</p>
            <button type="button" className="fo-btn fo-btn-primary gap-2 text-sm" disabled={ocupado} onClick={() => reintentar(f.pedidoId)}>
              <RotateCcw className="size-4" aria-hidden />
              Reintentar envío
            </button>
            {mensajes[f.pedidoId] ? (
              <p className={`text-sm ${mensajes[f.pedidoId].ok ? "text-[var(--fo-success)]" : "text-[var(--fo-warning)]"}`} role="status">
                {mensajes[f.pedidoId].texto}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
