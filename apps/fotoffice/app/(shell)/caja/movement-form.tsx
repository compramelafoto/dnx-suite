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
 * Cargar un movimiento manual.
 *
 * Tiene dos modos, según de dónde se lo llame:
 *
 * - Con `accountId` fijo (el uso original): es el botón "Nuevo movimiento" del turno
 *   abierto de mostrador. Arranca escondido detrás del botón, la cuenta no se elige.
 * - Con `accounts` (una lista): es la carga manual de `/caja/movimientos`, para una cuenta
 *   que no tiene panel de turno —Mercado Pago, el banco, la caja fuerte— y que si no fuera
 *   por acá no tendría ningún lugar de la interfaz donde anotar un movimiento. Siempre está
 *   visible y deja elegir la cuenta con un `<select>` en vez de fijarla. La lista que
 *   recibe ya viene filtrada a las cuentas activas del workspace activo, pero eso es sólo
 *   comodidad de la pantalla: `createMovementAction` vuelve a verificar la cuenta contra el
 *   workspace en el servidor, porque esconder una opción en el cliente no es control de
 *   acceso.
 *
 * En los dos modos el único motivo para correr en el navegador es que la categoría depende
 * de si el movimiento es ingreso o egreso — un ingreso no puede ir a "Sueldos" — y mostrar
 * las diez categorías juntas confunde más de lo que ahorra.
 *
 * `returnTo` es de `/caja/movimientos` nomás: sin él, `createMovementAction` vuelve a
 * `/caja` por omisión, que es el comportamiento de siempre del botón del mostrador.
 */
export function MovementForm({
  accountId,
  accountName,
  accounts,
  categories,
  clients,
  returnTo,
}: {
  accountId?: string;
  accountName?: string;
  accounts?: CashAccountRow[];
  categories: CashCategoryRow[];
  clients: ClientRow[];
  returnTo?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [kind, setKind] = useState<MovementKind>("INGRESO");
  const conSelector = accounts !== undefined;

  if (!conSelector && !abierto) {
    return (
      <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setAbierto(true)}>
        Nuevo movimiento
      </button>
    );
  }

  const categoriasDelLado = categories.filter((c) => c.kind === kind);

  return (
    <form action={createMovementAction} className="fo-card space-y-4 p-5">
      {conSelector ? null : <input type="hidden" name="accountId" value={accountId} />}
      {/* Sin `returnTo` el mostrador sigue volviendo a `/caja`, que es lo que ya hacía —el
          gesto rápido del día a día no cambia. Sólo `/caja/movimientos` lo manda. */}
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {conSelector ? "Cargar movimiento" : `Nuevo movimiento — ${accountName}`}
        </h3>
        {conSelector ? null : (
          <button
            type="button"
            className="text-xs text-[var(--fo-muted)] underline underline-offset-4"
            onClick={() => setAbierto(false)}
          >
            Cancelar
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {conSelector ? (
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
        ) : null}
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
