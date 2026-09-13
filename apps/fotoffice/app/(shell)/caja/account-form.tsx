"use client";

import { useState } from "react";
import { saveAccountAction } from "./actions";
import { CASH_ACCOUNT_KINDS, type CashAccountKind } from "@/lib/cash/constants";
import type { CashAccountRow } from "@/lib/cash/repository";
import { formatMinorArs } from "@/lib/membership/money";

const ETIQUETA_KIND: Record<CashAccountKind, string> = { EFECTIVO: "Efectivo", DIGITAL: "Digital" };

/**
 * Alta y edición de una cuenta.
 *
 * El fondo fijo y la marca de caja fuerte sólo tienen sentido en una cuenta de efectivo: lo
 * digital no lleva vuelto ni se cuenta a mano. Por eso el único motivo para correr en el
 * navegador es esconder esos dos campos cuando se elige "Digital" — la misma razón por la
 * que `ClientForm` esconde razón social o nombre y apellido según el tipo.
 */
export function AccountForm({ account }: { account: CashAccountRow | null }) {
  const [kind, setKind] = useState<CashAccountKind>((account?.kind as CashAccountKind) ?? "EFECTIVO");

  const fondoFijo =
    account?.fixedFloatMinor && account.fixedFloatMinor > 0
      ? formatMinorArs(account.fixedFloatMinor).replace("$", "").trim()
      : "";

  return (
    <form action={saveAccountAction} className="grid gap-4 sm:grid-cols-2">
      {account ? <input type="hidden" name="accountId" value={account.id} /> : null}

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={`acc-name-${account?.id ?? "nueva"}`}>
          Nombre
        </label>
        <input
          id={`acc-name-${account?.id ?? "nueva"}`}
          name="name"
          className="fo-input"
          defaultValue={account?.name ?? ""}
          placeholder="Caja diaria"
          required
        />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={`acc-kind-${account?.id ?? "nueva"}`}>
          Tipo
        </label>
        <select
          id={`acc-kind-${account?.id ?? "nueva"}`}
          name="kind"
          className="fo-input"
          value={kind}
          onChange={(e) => setKind(e.target.value as CashAccountKind)}
        >
          {CASH_ACCOUNT_KINDS.map((k) => (
            <option key={k} value={k}>
              {ETIQUETA_KIND[k]}
            </option>
          ))}
        </select>
      </div>

      {kind === "EFECTIVO" ? (
        <>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`acc-float-${account?.id ?? "nueva"}`}>
              Fondo fijo
            </label>
            <input
              id={`acc-float-${account?.id ?? "nueva"}`}
              name="fixedFloatArs"
              className="fo-input"
              defaultValue={fondoFijo}
              placeholder="20.000"
            />
            <p className="fo-helper">Lo que queda para dar vuelto. Al cerrar, se propone pasar el resto.</p>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="isVault" defaultChecked={account?.isVault ?? false} />
            Es la caja fuerte
          </label>
        </>
      ) : null}

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={`acc-order-${account?.id ?? "nueva"}`}>
          Orden
        </label>
        <input
          id={`acc-order-${account?.id ?? "nueva"}`}
          name="order"
          type="number"
          className="fo-input"
          defaultValue={account?.order ?? 0}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 self-end pb-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isDefault" defaultChecked={account?.isDefault ?? false} />
          Cuenta por omisión
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={account?.isActive ?? true} />
          Activa
        </label>
      </div>

      <div className="fo-form-actions sm:col-span-2">
        <button type="submit" className="fo-btn fo-btn-primary text-sm">
          {account ? "Guardar cambios" : "Crear cuenta"}
        </button>
      </div>
    </form>
  );
}
