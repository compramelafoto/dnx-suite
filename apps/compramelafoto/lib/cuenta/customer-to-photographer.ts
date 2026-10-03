/**
 * Un fotógrafo que se registró como cliente por error puede pasar su cuenta a fotógrafo
 * sin escribir a soporte, siempre que la cuenta nunca haya comprado: así no se mezclan
 * pedidos de cliente con un panel de fotógrafo. Con compras, el cambio lo hace un admin.
 */

export type CustomerToPhotographerDecision =
  | { ok: true }
  | { ok: false; reason: "NOT_CUSTOMER" | "HAS_PURCHASES"; message: string };

export function decideCustomerToPhotographer(input: {
  role: string;
  purchaseCount: number;
}): CustomerToPhotographerDecision {
  if (input.role !== "CUSTOMER") {
    return {
      ok: false,
      reason: "NOT_CUSTOMER",
      message: "Sólo una cuenta de cliente puede pasar a fotógrafo.",
    };
  }
  if (input.purchaseCount > 0) {
    return {
      ok: false,
      reason: "HAS_PURCHASES",
      message:
        "Tu cuenta ya tiene compras, así que el cambio lo hacemos desde soporte. Escribinos y lo resolvemos.",
    };
  }
  return { ok: true };
}

/** Radio de cobertura con el que nace un fotógrafo registrado por /api/auth/register-photographer. */
export const DEFAULT_PHOTOGRAPHER_COVERAGE_RADIUS_KM = 50;
