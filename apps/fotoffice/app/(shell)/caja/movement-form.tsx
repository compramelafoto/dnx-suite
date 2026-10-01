"use client";

import { useState } from "react";
import { createMovementAction } from "./actions";
import { MOVEMENT_KINDS, PAYMENT_METHODS, type MovementKind, type PaymentMethod } from "@/lib/cash/constants";
import type { CashAccountRow, CashCategoryRow } from "@/lib/cash/repository";
import type { ClientRow } from "@/lib/clients/repository";

const ETIQUETA_KIND: Record<MovementKind, string> = { INGRESO: "Ingreso", EGRESO: "Egreso" };

const ETIQUETA_METODO: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
};

/**
 * Cargar un movimiento manual, con selector de cuenta.
 *
 * Siempre visible y con la cuenta a elegir, a propósito: es el único gesto de carga manual
 * de todo el módulo, tanto para el panorama de `/caja` como para el libro completo de
 * `/caja/movimientos`. No depende de que haya un turno abierto —ni de que la cuenta elegida
 * sea de efectivo—, porque cargar un ingreso o pagar algo no puede bloquearse por eso. La
 * lista de cuentas que recibe ya viene filtrada a las activas del workspace, pero eso es
 * sólo comodidad de la pantalla: `createMovementAction` vuelve a verificar la cuenta contra
 * el workspace en el servidor, porque esconder una opción en el cliente no es control de
 * acceso.
 *
 * El único motivo para correr en el navegador es que la categoría depende de si el
 * movimiento es ingreso o egreso —un ingreso no puede ir a "Sueldos"— y mostrar las diez
 * categorías juntas confunde más de lo que ahorra.
 *
 * `returnTo` decide adónde volver después de guardar: `/caja/movimientos` lo manda para
 * quedarse en el libro completo, `/caja` para volver al panorama. Sin él,
 * `createMovementAction` cae en `/caja` por omisión.
 */
export function MovementForm({
  accounts,
  categories,
  clients,
  returnTo,
}: {
  accounts: CashAccountRow[];
  categories: CashCategoryRow[];
  clients: ClientRow[];
  returnTo?: string;
}) {
  const [kind, setKind] = useState<MovementKind>("INGRESO");
  const categoriasDelLado = categories.filter((c) => c.kind === kind);

  return (
    <form action={createMovementAction} className="fo-card space-y-4 p-5">
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <h3 className="text-sm font-semibold">Cargar movimiento</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="mov-account">
            Cuenta
          </label>
          <select id="mov-account" name="accountId" className="fo-input" required defaultValue="">
            <option value="" disabled>
              Elegí una cuenta
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="mov-kind">
            Tipo
          </label>
          <select
            id="mov-kind"
            name="kind"
            className="fo-input"
            value={kind}
            onChange={(e) => setKind(e.target.value as MovementKind)}
          >
            {MOVEMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {ETIQUETA_KIND[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="mov-amount">
            Importe
          </label>
          <input id="mov-amount" name="amountArs" className="fo-input" placeholder="5.000" required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="mov-category">
            Categoría
          </label>
          <select id="mov-category" name="categoryId" className="fo-input" defaultValue="">
            <option value="">Sin categoría</option>
            {categoriasDelLado.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="mov-payment-method">
            Medio de pago
          </label>
          <select id="mov-payment-method" name="paymentMethod" className="fo-input" defaultValue="EFECTIVO">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {ETIQUETA_METODO[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="mov-client">
            Cliente
          </label>
          <select id="mov-client" name="clientId" className="fo-input" defaultValue="">
            <option value="">Sin cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="mov-receipt">
            Comprobante
          </label>
          <input id="mov-receipt" name="receiptRef" className="fo-input" placeholder="Número de factura o recibo" />
        </div>
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="mov-description">
          Descripción
        </label>
        <input id="mov-description" name="description" className="fo-input" placeholder="De qué se trata" required />
      </div>

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary text-sm">
          Cargar movimiento
        </button>
      </div>
    </form>
  );
}
