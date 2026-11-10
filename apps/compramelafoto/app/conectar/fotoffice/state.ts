/** El `state` que manda FOTOFFICE: un valor aleatorio opaco (base64url u hex). CLF sólo lo devuelve tal cual. */
export function stateValido(state: string | null | undefined): state is string {
  return typeof state === "string" && /^[A-Za-z0-9._~-]{8,256}$/.test(state);
}
