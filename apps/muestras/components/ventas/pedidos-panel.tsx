"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FULFILLMENT_LABELS, isFulfillment } from "@repo/muestras";
import { borrarVentasDePrueba, cambiarProduccion, devolverPago, pedirDevolucion, type ResultadoPedidoPanel } from "@/lib/ventas/pedidos-panel";
import { emitirPruebaDeAutor } from "@/lib/ventas/revision";
import { alerta, botonChico, campo, nota } from "./estilos";

/** Los botones de los pedidos en el panel (etapa 8). Cada acción vuelve a mirar el permiso en el servidor. */

function useAccion() {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const correr = (f: () => Promise<ResultadoPedidoPanel | { ok: true; aviso?: string } | { ok: false; errores: string[] }>) =>
    empezar(async () => {
      const r = await f();
      if (r.ok) {
        setMsg(r.aviso ? { ok: true, texto: r.aviso } : null);
        router.refresh();
      } else setMsg({ ok: false, texto: "error" in r ? r.error : r.errores.join(" ") });
    });
  return { pendiente, msg, correr };
}

const Mensaje = ({ msg }: { msg: { ok: boolean; texto: string } | null }) =>
  msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? nota : alerta}>{msg.texto}</p> : null;

const SIGUIENTE: Record<string, Record<string, string>> = {
  PICKUP: { PENDING: "IN_PRODUCTION", IN_PRODUCTION: "READY", READY: "DELIVERED" },
  SHIPPING: { PENDING: "IN_PRODUCTION", IN_PRODUCTION: "SHIPPED", SHIPPED: "DELIVERED" },
};

export function SiguientePaso({ orderId, delivery, fulfillment }: { orderId: string; delivery: string; fulfillment: string }) {
  const { pendiente, msg, correr } = useAccion();
  const [seguimiento, setSeguimiento] = useState("");
  const siguiente = SIGUIENTE[delivery]?.[fulfillment];
  if (!siguiente) return null;
  const pideTexto = siguiente === "SHIPPED" || siguiente === "READY";
  return (
    <div className="space-y-2">
      {pideTexto ? (
        <input
          value={seguimiento}
          onChange={(e) => setSeguimiento(e.target.value)}
          maxLength={500}
          placeholder={siguiente === "SHIPPED" ? "Empresa y número de seguimiento" : "Dónde y cuándo se retira (optativo)"}
          className={campo}
          aria-label="Texto para quien compró"
        />
      ) : null}
      <button type="button" className={botonChico} disabled={pendiente} onClick={() => correr(() => cambiarProduccion(orderId, siguiente, seguimiento))}>
        Pasar a: {isFulfillment(siguiente) ? FULFILLMENT_LABELS[siguiente] : siguiente}
      </button>
      <Mensaje msg={msg} />
    </div>
  );
}

function ConMotivo({ etiqueta, accion, confirmar }: { etiqueta: string; accion: (motivo: string) => Promise<ResultadoPedidoPanel>; confirmar?: string }) {
  const { pendiente, msg, correr } = useAccion();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  if (!abierto) return <><button type="button" className={botonChico} onClick={() => setAbierto(true)}>{etiqueta}</button><Mensaje msg={msg} /></>;
  return (
    <div className="space-y-2">
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={2} placeholder="Motivo" className={campo} aria-label="Motivo" />
      <div className="flex gap-2">
        <button
          type="button"
          className={botonChico}
          disabled={pendiente || !motivo.trim()}
          onClick={() => {
            if (confirmar && !window.confirm(confirmar)) return;
            correr(() => accion(motivo));
          }}
        >
          {etiqueta}
        </button>
        <button type="button" className={botonChico} onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
      <Mensaje msg={msg} />
    </div>
  );
}

export function PedirDevolucion({ orderId }: { orderId: string }) {
  return <ConMotivo etiqueta="Pedir devolución" accion={(m) => pedirDevolucion(orderId, m)} />;
}

export function DevolverPago({ orderId }: { orderId: string }) {
  return <ConMotivo etiqueta="Devolver el pago" accion={(m) => devolverPago(orderId, m)} confirmar="Se devuelve el total en Mercado Pago y la copia queda anulada. ¿Seguimos?" />;
}

export function EmitirPA({ offerId }: { offerId: string }) {
  const { pendiente, msg, correr } = useAccion();
  return (
    <span className="inline-block space-y-1">
      <button type="button" className={botonChico} disabled={pendiente} onClick={() => correr(() => emitirPruebaDeAutor(offerId))}>Emitir certificado de P/A</button>
      <Mensaje msg={msg} />
    </span>
  );
}

export function BorrarPruebas({ activityId }: { activityId: string }) {
  const { pendiente, msg, correr } = useAccion();
  return (
    <span className="inline-block space-y-1">
      <button
        type="button"
        className={botonChico}
        disabled={pendiente}
        onClick={() => {
          if (window.confirm("Se borran los pedidos, las copias y los certificados de prueba de esta muestra. Lo real no se toca. ¿Seguimos?")) correr(() => borrarVentasDePrueba(activityId));
        }}
      >
        Borrar las ventas de prueba
      </button>
      <Mensaje msg={msg} />
    </span>
  );
}
