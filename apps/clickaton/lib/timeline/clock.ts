/** Reloj inyectable — fuente de verdad temporal (nunca confiar en el cliente). */

export type EditionClock = {
  now(): Date;
};

export function systemClock(): EditionClock {
  return { now: () => new Date() };
}

export function fixedClock(at: Date): EditionClock {
  return { now: () => new Date(at.getTime()) };
}

export function mutableClock(initial = new Date()): EditionClock & { set(at: Date): void } {
  let current = new Date(initial.getTime());
  return {
    now: () => new Date(current.getTime()),
    set: (at: Date) => {
      current = new Date(at.getTime());
    },
  };
}

/** Bases 2026: America/Argentina/Buenos_Aires (UTC−3; Cordoba es alias equivalente). */
export const DEFAULT_EDITION_TIMEZONE = "America/Argentina/Buenos_Aires";
