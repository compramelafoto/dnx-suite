/**
 * A qué cuenta y con qué categoría entra un cobro que vino de otro módulo. Módulo PURO.
 *
 * Existe para que la decisión sea probable sin base: es el punto donde un error se ve como
 * plata en la cuenta equivocada, y el arqueo del efectivo da mal todos los días hasta que
 * alguien se da cuenta.
 *
 * Nunca inventa una cuenta. Si no hay ninguna, no deposita — y eso NO es un error: el cobro
 * tiene que seguir funcionando con el módulo de Caja apagado o a medio configurar.
 */

export type AccountOption = {
  id: string;
  name: string;
  kind: string;
  isDefault: boolean;
  isVault: boolean;
};
export type CategoryOption = { id: string; name: string; kind: string };

export type DepositTarget =
  | { ok: true; accountId: string; categoryId: string | null }
  | { ok: false; reason: string };

/** Lo que no se cuenta a mano va a la cuenta digital. */
const MEDIOS_DIGITALES = new Set(["MERCADO_PAGO", "TRANSFERENCIA", "TARJETA"]);

export function resolveDepositTarget(input: {
  cashEnabled: boolean;
  paymentMethod: string;
  accounts: readonly AccountOption[];
  categories: readonly CategoryOption[];
  categoryName: string;
}): DepositTarget {
  if (!input.cashEnabled) {
    return { ok: false, reason: "El módulo de Caja no está habilitado." };
  }
  if (input.accounts.length === 0) {
    return { ok: false, reason: "El workspace no tiene ninguna cuenta de caja." };
  }

  // La caja fuerte queda afuera de este reparto siempre, sin excepción: nadie la arquea a
  // diario, así que un cobro automático que cae ahí infla su saldo contra plata que en
  // realidad está en el mostrador, y ningún arqueo lo va a notar — es silencioso justo por
  // ser automático. Si el administrador desactiva o reordena la caja diaria, el cobro tiene
  // que quedar sin depositar antes que depositarse mal.
  const candidatas = input.accounts.filter((a) => !a.isVault);
  if (candidatas.length === 0) {
    return { ok: false, reason: "El workspace no tiene ninguna cuenta de caja que no sea la caja fuerte." };
  }

  const quiereDigital = MEDIOS_DIGITALES.has(input.paymentMethod);
  const porTipo = candidatas.find((a) => (quiereDigital ? a.kind === "DIGITAL" : a.kind === "EFECTIVO"));
  const cuenta = porTipo ?? candidatas.find((a) => a.isDefault) ?? candidatas[0];

  const categoria =
    input.categories.find((c) => c.kind === "INGRESO" && c.name === input.categoryName) ?? null;

  return { ok: true, accountId: cuenta.id, categoryId: categoria?.id ?? null };
}
