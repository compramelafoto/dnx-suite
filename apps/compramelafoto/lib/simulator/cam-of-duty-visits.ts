/** Reglas de la entrada a Cam Of Duty, sin base ni sesión (ver cam-of-duty-access.ts). */

/** Volver antes de esto no cuenta como otra entrada (recargar la página, por ejemplo). */
export const VISIT_GAP_MS = 30 * 60 * 1000;

export function isNewVisit(lastVisitAt: Date, now: Date): boolean {
  return now.getTime() - lastVisitAt.getTime() >= VISIT_GAP_MS;
}

/** A dónde mandar a quien no tiene sesión: el registro, que vuelve a `path` al terminar. */
export function camOfDutySignupUrl(path: string): string {
  return `/registro?redirect=${encodeURIComponent(path)}`;
}
