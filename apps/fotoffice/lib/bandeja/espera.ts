/**
 * Tiempo de espera de un chat (§6.3 del diseño 2026-11-24). Módulo PURO. Un chat abierto espera
 * respuesta si lo último real es del cliente (`ultimoEntranteEn` no es anterior a `ultimoMensajeEn`;
 * las notas y los SISTEMA no mueven `ultimoMensajeEn`). No cuenta si lo atiende el bot.
 */

export type NivelDeEspera = "normal" | "atencion" | "urgente";
export const MINUTOS_ATENCION = 15;
export const MINUTOS_URGENTE = 60;

export function esperaDe(
  chat: { estado: string; atiendeElBot: boolean; ultimoEntranteEn: Date | null; ultimoMensajeEn: Date },
  ahora: Date,
): { minutos: number; nivel: NivelDeEspera } | null {
  if (chat.estado === "RESUELTO" || chat.atiendeElBot || !chat.ultimoEntranteEn) return null;
  if (chat.ultimoEntranteEn.getTime() < chat.ultimoMensajeEn.getTime()) return null;
  const minutos = Math.max(0, Math.floor((ahora.getTime() - chat.ultimoEntranteEn.getTime()) / 60_000));
  const nivel: NivelDeEspera = minutos > MINUTOS_URGENTE ? "urgente" : minutos >= MINUTOS_ATENCION ? "atencion" : "normal";
  return { minutos, nivel };
}

export function textoDeEspera(minutos: number): string {
  if (minutos < 1) return "espera hace menos de 1 min";
  if (minutos < 60) return `espera hace ${minutos} min`;
  if (minutos < 60 * 24) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `espera hace ${h} h${m ? ` ${m} min` : ""}`;
  }
  const d = Math.floor(minutos / (60 * 24));
  return `espera hace ${d} ${d === 1 ? "día" : "días"}`;
}
