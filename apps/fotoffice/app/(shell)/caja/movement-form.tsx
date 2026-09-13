"use client";

import { useState } from "react";
import { createMovementAction } from "./actions";
import { MOVEMENT_KINDS, PAYMENT_METHODS, type MovementKind, type PaymentMethod } from "@/lib/cash/constants";
import type { CashCategoryRow } from "@/lib/cash/repository";
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
 * Cargar un movimiento manual, con la cuenta ya fija.
 *
 * Arranca escondido: es el botón "Nuevo movimiento" del turno abierto, no una pantalla
 * propia. El único motivo para correr en el navegador es que la categoría depende de si el
 * movimiento es ingreso o egreso — un ingreso no puede ir a "Sueldos" — y mostrar las diez
 * categorías juntas confunde más de lo que ahorra.
 */
export function MovementForm({
  accountId,
  accountName,
  categories,
  clients,
}: {
  accountId: string;
  accountName: string;
  categories: CashCategoryRow[];
  clients: ClientRow[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [kind, setKind] = useState<MovementKind>("INGRESO");

  if (!abierto) {
    return (
      <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setAbierto(true)}>
        Nuevo movimiento
      </button>
    );
  }

  const categoriasDelLado = categories.filter((c) => c.kind === kind);

  return (
    <form action={createMovementAction} className="fo-card space-y-4 p-5">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Nuevo movimiento — {accountName}</h3>
        <button
          type="button"
          className="text-xs text-[var(--fo-muted)] underline underline-offset-4"
          onClick={() => setAbierto(false)}
        >
          Cancelar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
