import { parseArsToMinor } from "@/lib/membership/money";
import {
  MOVEMENT_KINDS,
  PAYMENT_METHODS,
  type MovementKind,
  type PaymentMethod,
} from "./constants";

/**
 * Validación del formulario de un movimiento. Módulo PURO.
 *
 * El importe siempre es positivo: el signo lo da `kind`. Guardar un egreso como un número
 * negativo *y además* marcarlo como egreso abre la puerta a que los dos se contradigan, y
 * entonces nadie sabe cuál de los dos manda.
 *
 * `parseArsToMinor` se reusa de Reservas en vez de reescribirlo: acepta "3.000,50", "$ 2.000"
 * y "2000", que es como la gente escribe de verdad.
 */

export type MovementFormValues = {
  kind: MovementKind;
  amountMinor: number;
  occurredAt: Date;
  accountId: string;
  categoryId: string | null;
  paymentMethod: PaymentMethod;
  clientId: string | null;
  description: string;
  receiptRef: string | null;
};

export type MovementFormResult =
  | { ok: true; values: MovementFormValues }
  | { ok: false; error: string };

function texto(fd: FormData, campo: string): string | null {
  const v = String(fd.get(campo) ?? "").trim();
  return v === "" ? null : v;
}

export function parseMovementForm(fd: FormData): MovementFormResult {
  const kindRaw = String(fd.get("kind") ?? "").trim();
  if (!MOVEMENT_KINDS.includes(kindRaw as MovementKind)) {
    return { ok: false, error: "El movimiento tiene que ser un ingreso o un egreso." };
  }

  const amountMinor = parseArsToMinor(String(fd.get("amountArs") ?? ""));
  if (amountMinor === null) return { ok: false, error: "El importe no se entiende." };
  if (amountMinor === 0) return { ok: false, error: "El importe tiene que ser mayor que cero." };

  const accountId = texto(fd, "accountId");
  if (accountId === null) {
    return { ok: false, error: "Elegí en qué cuenta entra o sale la plata." };
  }

  const description = texto(fd, "description");
  if (description === null) {
    return { ok: false, error: "Escribí de qué se trata el movimiento." };
  }

  // Sin fecha es "ahora": cargar un movimiento del momento es el caso del noventa por ciento,
  // y obligar a escribir la fecha para eso sería fricción pura.
  const fechaRaw = texto(fd, "occurredAt");
  let occurredAt = new Date();
  if (fechaRaw !== null) {
    const d = new Date(fechaRaw);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Esa fecha no se entiende." };
    occurredAt = d;
  }

  const metodoRaw = String(fd.get("paymentMethod") ?? "EFECTIVO").trim();
  if (!PAYMENT_METHODS.includes(metodoRaw as PaymentMethod)) {
    return { ok: false, error: "Ese medio de pago no existe." };
  }

  return {
    ok: true,
    values: {
      kind: kindRaw as MovementKind,
      amountMinor,
      occurredAt,
      accountId,
      categoryId: texto(fd, "categoryId"),
      paymentMethod: metodoRaw as PaymentMethod,
      clientId: texto(fd, "clientId"),
      description,
      receiptRef: texto(fd, "receiptRef"),
    },
  };
}
