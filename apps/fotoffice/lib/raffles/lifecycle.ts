import type { RafflePrizeStatus, RaffleStatus } from "./constants";

/**
 * Las transiciones del sorteo y de cada premio.
 *
 * Módulo PURO: recibe estados y fechas, devuelve permiso o motivo. Sin base.
 *
 * La regla que ordena todo: una vez SORTEADO el resultado es inmutable. No hay transición que
 * lo deshaga. Si algo salió mal se anula el premio con motivo y se hace otro sorteo. Un
 * resultado que retrocede deja de contar lo que realmente pasó.
 */

export type Transition = { ok: true } | { ok: false; error: string };

const OK: Transition = { ok: true };
const no = (error: string): Transition => ({ ok: false, error });

export function canAnnounce(input: {
  status: RaffleStatus;
  prizeCount: number;
  entriesCloseAt: Date;
  drawsAt: Date;
  now: Date;
}): Transition {
  if (input.status !== "BORRADOR") return no("Sólo se anuncia un sorteo en borrador.");
  if (input.prizeCount === 0) return no("No se puede anunciar un sorteo sin premios.");
  if (input.entriesCloseAt.getTime() >= input.drawsAt.getTime()) {
    return no("El padrón tiene que cerrar antes del acto.");
  }
  // Anunciar algo cuyo padrón ya cerró dejaría al socio sin ninguna oportunidad de ponerse al
  // día: el anuncio es también el aviso de deuda.
  if (input.entriesCloseAt.getTime() <= input.now.getTime()) {
    return no("El cierre del padrón ya pasó. Corregí las fechas antes de anunciar.");
  }
  return OK;
}

export function canSeal(input: {
  status: RaffleStatus;
  entriesCloseAt: Date;
  now: Date;
  entrantCount: number;
  prizeCount: number;
}): Transition {
  if (input.status !== "ANUNCIADO") return no("Sólo se sella el padrón de un sorteo anunciado.");
  if (input.now.getTime() < input.entriesCloseAt.getTime()) {
    return no("Todavía no cerró el padrón.");
  }
  if (input.entrantCount === 0) {
    return no("Ningún socio quedó al día al cerrar el padrón. El sorteo no se puede sellar.");
  }
  if (input.entrantCount < input.prizeCount) {
    return no(
      `Hay ${input.prizeCount} premios y ${input.entrantCount} participantes. Sacá premios o cancelá el sorteo.`,
    );
  }
  return OK;
}

export function canDraw(input: { status: RaffleStatus; drawsAt: Date; now: Date }): Transition {
  if (input.status !== "PADRON_SELLADO") {
    return input.status === "SORTEADO" || input.status === "CERRADO"
      ? no("Este sorteo ya se resolvió. El resultado no se rehace.")
      : no("Primero hay que sellar el padrón.");
  }
  if (input.now.getTime() < input.drawsAt.getTime()) return no("Todavía no es la hora del acto.");
  return OK;
}

export function canCancel(status: RaffleStatus): Transition {
  if (status === "BORRADOR" || status === "ANUNCIADO") return OK;
  if (status === "PADRON_SELLADO") {
    return no("El padrón ya se selló y su huella se publicó. No se cancela desde acá.");
  }
  return no("Un sorteo resuelto no se cancela.");
}

/** Premios y fechas se tocan solamente antes de anunciar. */
export function canEditPrizes(status: RaffleStatus): boolean {
  return status === "BORRADOR";
}

const CAMINOS: Record<RafflePrizeStatus, RafflePrizeStatus[]> = {
  GANADO: ["NOTIFICADO", "RETIRADO", "NO_RETIRADO", "ANULADO"],
  NOTIFICADO: ["RETIRADO", "NO_RETIRADO", "ANULADO"],
  RETIRADO: [],
  NO_RETIRADO: [],
  ANULADO: [],
};

export function nextPrizeStatus(
  from: RafflePrizeStatus,
  to: RafflePrizeStatus,
  note: string | null,
): Transition {
  if (!CAMINOS[from].includes(to)) {
    return no(`Un premio ${from.toLowerCase()} no puede pasar a ${to.toLowerCase()}.`);
  }
  if (to === "ANULADO" && (note ?? "").trim() === "") {
    return no("Anular un premio exige escribir el motivo.");
  }
  return OK;
}

/** El sorteo se cierra cuando ningún premio queda por resolver. */
export function isRaffleClosed(prizeStatuses: readonly RafflePrizeStatus[]): boolean {
  if (prizeStatuses.length === 0) return false;
  return prizeStatuses.every((s) => s === "RETIRADO" || s === "NO_RETIRADO" || s === "ANULADO");
}
