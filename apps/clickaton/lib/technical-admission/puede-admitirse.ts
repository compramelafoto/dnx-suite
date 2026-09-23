/**
 * Si una obra puede quedar admitida.
 *
 * Existe por un círculo vicioso: admitir volvía a evaluar y, si el motor
 * seguía pidiendo revisión humana, se negaba con "resolvé la revisión manual
 * antes de admitir". Resolver la revisión manual admitiendo era exactamente
 * lo que quedaba prohibido, así que las que esperaban una decisión no tenían
 * salida por ese lado.
 *
 * La revisión humana abre esa puerta y sólo esa: una obra con motivos
 * bloqueantes —sin pago, sin archivo, de otra edición— sigue sin poder
 * admitirse.
 */

export type ResultadoDeAdmision =
  | { ok: true }
  | { ok: false; error: "MANUAL_REVIEW_REQUIRED" | "NOT_ELIGIBLE" };

export function puedeAdmitirse(input: {
  status: string;
  eligible: boolean;
  resolviendoRevisionManual?: boolean;
}): ResultadoDeAdmision {
  if (input.status === "PENDING_MANUAL_REVIEW") {
    return input.resolviendoRevisionManual ? { ok: true } : { ok: false, error: "MANUAL_REVIEW_REQUIRED" };
  }
  if (!input.eligible) return { ok: false, error: "NOT_ELIGIBLE" };
  return { ok: true };
}
