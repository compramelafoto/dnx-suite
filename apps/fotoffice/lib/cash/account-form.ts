import { CASH_ACCOUNT_KINDS, type CashAccountKind } from "./constants";

/**
 * Validación del formulario de una cuenta de caja. Módulo PURO.
 *
 * Las cuentas las crea el administrador sin tope: un negocio con tres sucursales crea un
 * efectivo por sucursal y arquea cada uno por separado. No hace falta una entidad
 * "sucursal" — la cuenta ya es la unidad que se abre, se cierra y se cuenta.
 */

export type AccountFormValues = {
  name: string;
  kind: CashAccountKind;
  isDefault: boolean;
  isActive: boolean;
  order: number;
};

export type AccountFormResult =
  | { ok: true; values: AccountFormValues }
  | { ok: false; error: string };

export function parseAccountForm(fd: FormData): AccountFormResult {
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Poné un nombre para la cuenta." };

  const kindRaw = String(fd.get("kind") ?? "EFECTIVO").trim();
  if (!CASH_ACCOUNT_KINDS.includes(kindRaw as CashAccountKind)) {
    return { ok: false, error: "Esa cuenta tiene que ser de efectivo o digital." };
  }

  const orderRaw = Number(String(fd.get("order") ?? "0").trim());
  const order = Number.isFinite(orderRaw) ? Math.floor(orderRaw) : 0;

  return {
    ok: true,
    values: {
      name,
      kind: kindRaw as CashAccountKind,
      isDefault: fd.get("isDefault") === "on" || fd.get("isDefault") === "true",
      isActive: fd.get("isActive") !== "off" && fd.get("isActive") !== "false",
      order,
    },
  };
}
