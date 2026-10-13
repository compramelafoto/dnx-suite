/** Claves de BotUsageDaily: una fila por (plataforma, día argentino, clave). */
export const PREFIJO_INVITADO = "g:";
export function claveUsuario(userId: number): string {
  return `u:${userId}`;
}
export function claveInvitado(guestKey: string): string {
  return `${PREFIJO_INVITADO}${guestKey}`;
}
export function claveIp(ipHash: string): string {
  return `ip:${ipHash}`;
}
