import {
  MIN_HOURS_BETWEEN_CLOSE_AND_DRAW,
  type RafflePrizeStatus,
  type RaffleStatus,
} from "./constants";

/**
 * Las transiciones del sorteo y de cada premio. Módulo PURO (mismo criterio que FOTOFFICE).
 *
 * Una vez SORTEADO el resultado es inmutable: si algo salió mal se anula el premio con motivo
 * y se hace otro sorteo. Un resultado que retrocede deja de contar lo que pasó.
 */

export type Transition = { ok: true } | { ok: false; error: string };

const OK: Transition = { ok: true };
const no = (error: string): Transition => ({ ok: false, error });

/** Las fechas de un sorteo tienen sentido. Se controla al crear, al editar y al anunciar. */
export function validateDates(input: {
  salesFrom: Date;
  salesTo: Date;
  entriesCloseAt: Date;
  drawsAt: Date;
}): Transition {
  if (input.salesFrom.getTime() >= input.salesTo.getTime()) {
    return no("El período de ventas tiene que empezar antes de terminar.");
  }
  // Si el padrón cerrara antes de que termine el período, quedarían ventas sin contar.
  if (input.entriesCloseAt.getTime() < input.salesTo.getTime()) {
    return no("El padrón no puede cerrar antes de que termine el período de ventas.");
  }
  const horas = (input.drawsAt.getTime() - input.entriesCloseAt.getTime()) / 3_600_000;
  if (horas < MIN_HOURS_BETWEEN_CLOSE_AND_DRAW) {
    return no(
      `Entre el cierre del padrón y el sorteo tiene que haber al menos ${MIN_HOURS_BETWEEN_CLOSE_AND_DRAW} horas: es lo que lo hace verificable.`,
    );
  }
  return OK;
}

export function canAnnounce(input: {
  status: RaffleStatus;
  prizeCount: number;
  salesFrom: Date;
  salesTo: Date;
  entriesCloseAt: Date;
  drawsAt: Date;
  now: Date;
}): Transition {
  if (input.status !== "BORRADOR") return no("Sólo se anuncia un sorteo en borrador.");
  if (input.prizeCount === 0) return no("No se puede anunciar un sorteo sin premios.");
  const fechas = validateDates(input);
  if (!fechas.ok) return fechas;
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
  if (input.status !== "ANUNCIADO") return no("Sólo se cierra el padrón de un sorteo anunciado.");
  if (input.now.getTime() < input.entriesCloseAt.getTime()) return no("Todavía no cerró el padrón.");
  if (input.entrantCount === 0) {
    return no("Ningún fotógrafo cumplió la condición de ventas. El sorteo no se puede cerrar.");
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
      : no("Primero hay que cerrar el padrón.");
  }
  if (input.now.getTime() < input.drawsAt.getTime()) return no("Todavía no es la hora del sorteo.");
  return OK;
}

export function canCancel(status: RaffleStatus): Transition {
  if (status === "BORRADOR" || status === "ANUNCIADO") return OK;
  if (status === "PADRON_SELLADO") {
    return no("El padrón ya se cerró y su huella se publicó. Ya no se cancela.");
  }
  return no("Un sorteo resuelto no se cancela.");
}

/** Premios y fechas se tocan solamente antes de anunciar. */
export function canEditDraft(status: RaffleStatus): boolean {
  return status === "BORRADOR";
}

const CAMINOS: Record<RafflePrizeStatus, RafflePrizeStatus[]> = {
  GANADO: ["NOTIFICADO", "ENTREGADO", "NO_RETIRADO", "ANULADO"],
  NOTIFICADO: ["ENTREGADO", "NO_RETIRADO", "ANULADO"],
  ENTREGADO: [],
  NO_RETIRADO: [],
  ANULADO: [],
};

export function nextPrizeStatus(
  from: RafflePrizeStatus,
  to: RafflePrizeStatus,
  note: string | null,
): Transition {
  if (!CAMINOS[from]?.includes(to)) {
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
  return prizeStatuses.every((s) => s === "ENTREGADO" || s === "NO_RETIRADO" || s === "ANULADO");
}
