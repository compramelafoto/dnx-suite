/** Consentimiento del autor para vender su obra en la tienda. Módulo PURO. */

export type ConsentBasis = "RULES" | "EXPLICIT";
export type ConsentStatus = "PENDING" | "GRANTED" | "DECLINED" | "NOTIFIED" | "WITHDRAWN";
export type AuthorAction = "accept" | "decline" | "withdraw";

/** Si las bases del concurso ya autorizan impresión y uso comercial, alcanza con avisar; si no, hay que pedir permiso. */
export function consentBasisFromRights(
  rights: { allowPrint: boolean; allowCommercial: boolean } | null,
): ConsentBasis {
  return rights && rights.allowPrint && rights.allowCommercial ? "RULES" : "EXPLICIT";
}

/**
 * ¿Se puede vender (publicar, cobrar) la obra? Una sola regla para publicar y para el checkout:
 * - RULES: avisado y sin retirar. "Avisado" quiere decir que el correo SALIÓ (`notifiedAt`); si
 *   el correo falló, el autor no se enteró y todavía no se puede vender.
 * - EXPLICIT: el autor aceptó.
 */
export function isSellable(
  consent: { basis: ConsentBasis | string; status: ConsentStatus | string; notifiedAt: Date | null } | null,
): boolean {
  if (!consent) return false;
  if (consent.basis === "RULES") return consent.status === "NOTIFIED" && consent.notifiedAt !== null;
  return consent.basis === "EXPLICIT" && consent.status === "GRANTED";
}

export function applyAuthorAction(
  consent: { basis: ConsentBasis; status: ConsentStatus },
  action: AuthorAction,
): { ok: true; status: ConsentStatus } | { ok: false } {
  const { basis, status } = consent;
  if (basis === "RULES") {
    if (status === "NOTIFIED" && action === "withdraw") return { ok: true, status: "WITHDRAWN" };
    return { ok: false };
  }
  if (status === "PENDING") {
    if (action === "accept") return { ok: true, status: "GRANTED" };
    if (action === "decline") return { ok: true, status: "DECLINED" };
    return { ok: false };
  }
  if (status === "GRANTED" && action === "withdraw") return { ok: true, status: "WITHDRAWN" };
  return { ok: false };
}
