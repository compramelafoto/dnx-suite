"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Printer, RotateCcw, Store } from "lucide-react";
import { reintentarEnvioAction } from "@/app/actions/impresiones";

const ESTADOS: Record<string, string> = {
  PAGADO: "Pagado, por preparar",
  PREPARANDO: "Preparando la carpeta",
  ENVIADO: "Enviado al laboratorio",
  PAGADO_SIN_ENVIAR: "Pagado, sin enviar",
};
const pesos = (c: number) => (c / 100).toLocaleString("es-AR", { style: "currency", currency: "ARS" });

/**
 * Tarjeta de la ficha de un trabajo que nació de un pedido de copias impresas: resumen (sólo lectura) y, si el
 * pedido quedó pagado sin salir al laboratorio, el motivo y «Reintentar envío» (lo retoma el próximo cron).
 */
export function PedidoDelTrabajo({
  pedido,
  puedeEditar,
}: {
  pedido: {
    pedidoId: string; numero: number; estado: string; lastError: string | null;
    copias: { tamano: string; papel: string; cantidad: number }[]; totalCents: number; costoCents: number; gananciaCents: number;
    entrega: { direccion: string; km: number | null; envioCents: number; mapa: string | null } | null;
  };
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, start] = useTransition();
  const sinEnviar = pedido.estado === "PAGADO_SIN_ENVIAR";

  function reintentar() {
    start(async () => {
      const r = await reintentarEnvioAction(pedido.pedidoId);
      setMensaje(r.ok ? { ok: true, texto: "Listo: en unos minutos se vuelve a preparar y mandar al laboratorio." } : { ok: false, texto: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <section aria-labelledby="pedido-impresion-titulo" className="fo-card space-y-3 p-4">
      <h2 id="pedido-impresion-titulo" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        <Printer className="size-4" aria-hidden />
        Pedido de impresión N° {pedido.numero}
      </h2>
      <p className="text-xs text-[var(--fo-muted)]">{ESTADOS[pedido.estado] ?? pedido.estado}</p>

      <ul className="space-y-1 text-sm">
        {pedido.copias.map((c) => (
          <li key={`${c.tamano}-${c.papel}`} className="flex justify-between gap-2">
            <span>
              {c.tamano} {c.papel}
            </span>
            <span className="tabular-nums">
              {c.cantidad} {c.cantidad === 1 ? "copia" : "copias"}
            </span>
          </li>
        ))}
      </ul>
      {pedido.entrega ? (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--fo-accent)]" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">Envío a domicilio</p>
            <p className="break-words text-[var(--fo-text-secondary)]">{pedido.entrega.direccion}</p>
            {pedido.entrega.km !== null ? (
              <p className="text-xs text-[var(--fo-muted)]">{String(pedido.entrega.km).replace(".", ",")} km de ida</p>
            ) : null}
            {pedido.entrega.mapa ? (
              <a href={pedido.entrega.mapa} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                Ver en el mapa
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-[var(--fo-text-secondary)]">
          <Store className="size-4 shrink-0" aria-hidden />
          Retiro en el local
        </p>
      )}
      <dl className="space-y-1 border-t border-[var(--fo-border)] pt-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--fo-muted)]">Total cobrado</dt>
          <dd className="tabular-nums">{pesos(pedido.totalCents)}</dd>
        </div>
        {pedido.entrega ? (
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--fo-muted)]">Envío (incluido)</dt>
            <dd className="tabular-nums">{pesos(pedido.entrega.envioCents)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--fo-muted)]">Costo del laboratorio</dt>
          <dd className="tabular-nums">{pesos(pedido.costoCents)}</dd>
        </div>
        <div className="flex justify-between gap-2 font-medium">
          <dt>Ganancia</dt>
          <dd className="tabular-nums">{pesos(pedido.gananciaCents)}</dd>
        </div>
      </dl>

      {sinEnviar ? (
        <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
          <p className="text-sm text-[var(--fo-warning)]" role="alert">
            {pedido.lastError ?? "El pedido está pagado pero no salió al laboratorio."}
          </p>
          {puedeEditar ? (
            <button type="button" className="fo-btn fo-btn-primary w-full gap-2 text-sm" disabled={ocupado} onClick={reintentar}>
              <RotateCcw className="size-4" aria-hidden />
              Reintentar envío
            </button>
          ) : null}
        </div>
      ) : null}
      {mensaje ? (
        <p className={`text-sm ${mensaje.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-warning)]"}`} role="status">
          {mensaje.texto}
        </p>
      ) : null}
    </section>
  );
}
