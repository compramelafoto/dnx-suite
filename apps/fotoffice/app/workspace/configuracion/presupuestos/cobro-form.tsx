"use client";

import { useActionState } from "react";
import type { AjustesCobro } from "@/lib/cobro-ajustes/datos";
import { guardarAjustesCobroAction, type EstadoPresupuestosConfig } from "./actions";

const INICIAL: EstadoPresupuestosConfig = { error: null };

/**
 * Cobro de los presupuestos aceptados (etapa B): crear el pedido solo al aceptar, datos para
 * transferir y monto único. Sin Mercado Pago conectado, el cliente paga por transferencia o en
 * efectivo con estos datos.
 */
export function CobroForm({ ajustes, mercadoPago }: { ajustes: AjustesCobro; mercadoPago: boolean }) {
  const [estado, guardar, guardando] = useActionState(guardarAjustesCobroAction, INICIAL);
  const campo = (nombre: keyof AjustesCobro, etiqueta: string, ayuda?: string) => (
    <label className="block space-y-1 text-sm">
      <span className="fo-label">{etiqueta}</span>
      <input name={nombre} defaultValue={(ajustes[nombre] as string | null) ?? ""} maxLength={120} className="fo-input w-full" />
      {ayuda ? <span className="block text-xs text-[var(--fo-muted)]">{ayuda}</span> : null}
    </label>
  );
  return (
    <form action={guardar} className="fo-card space-y-4 p-5" aria-labelledby="cobro-titulo">
      <h2 id="cobro-titulo" className="text-base font-semibold">
        Cobro al aceptar
      </h2>
      <p className="text-sm text-[var(--fo-muted)]">
        {mercadoPago
          ? "Mercado Pago está conectado: el cliente puede pagar la seña con Mercado Pago o por transferencia."
          : "Mercado Pago no está conectado: el cliente paga por transferencia o en efectivo con los datos de abajo."}
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="autoConfirmarPedido" defaultChecked={ajustes.autoConfirmarPedido} className="mt-1" />
        <span>
          Crear el pedido solo cuando el cliente acepta
          <span className="block text-xs text-[var(--fo-muted)]">
            El cliente pasa directo a su pedido para pagar la seña. Apagado: el pedido lo confirmás vos («Pedido por confirmar»).
          </span>
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {campo("alias", "Alias")}
        {campo("cbuCvu", "CBU o CVU", "22 números.")}
        {campo("titular", "Titular de la cuenta")}
        {campo("cuit", "CUIT del titular")}
        {campo("banco", "Banco o billetera")}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="montoUnico" defaultChecked={ajustes.montoUnico} className="mt-1" />
        <span>
          Monto único
          <span className="block text-xs text-[var(--fo-muted)]">
            A cada transferencia esperada se le suman de 1 a 99 pesos para que no haya dos iguales y se reconozca sola.
          </span>
        </span>
      </label>
      {estado.error ? <p role="alert" className="text-sm text-[var(--fo-danger)]">{estado.error}</p> : null}
      {estado.ok ? <p role="status" className="text-sm text-[var(--fo-success)]">{estado.ok}</p> : null}
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
