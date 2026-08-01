import type { PricePhaseOverlap, PricePhaseRecord, ResolvedPricePhase } from "./types";

/**
 * Intervalo cerrado-abierto conceptual: [startsAt, endsAt].
 * Vigente si startsAt <= now <= endsAt.
 */
export function isPhaseActiveAt(phase: PricePhaseRecord, now: Date): boolean {
  if (!phase.isActive) return false;
  const t = now.getTime();
  return phase.startsAt.getTime() <= t && t <= phase.endsAt.getTime();
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}

/** Detecta solapes entre fases activas (misma edición). */
export function findActivePhaseOverlaps(
  phases: readonly PricePhaseRecord[],
): PricePhaseOverlap[] {
  const active = phases.filter((p) => p.isActive);
  const overlaps: PricePhaseOverlap[] = [];
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i]!;
      const b = active[j]!;
      if (rangesOverlap(a.startsAt, a.endsAt, b.startsAt, b.endsAt)) {
        overlaps.push({
          aId: a.id,
          bId: b.id,
          aName: a.name,
          bName: b.name,
        });
      }
    }
  }
  return overlaps;
}

/**
 * Resuelve la única fase vigente.
 * Si hay solape (datos inválidos), gana menor priority y luego startsAt más reciente.
 */
export function resolveCurrentPricePhase(
  phases: readonly PricePhaseRecord[],
  now: Date = new Date(),
): ResolvedPricePhase | null {
  const current = phases
    .filter((p) => isPhaseActiveAt(p, now))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.startsAt.getTime() - a.startsAt.getTime();
    });

  const phase = current[0];
  if (!phase) return null;

  const nextPhase =
    phases
      .filter((p) => p.isActive && p.startsAt.getTime() > now.getTime())
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ?? null;

  return { phase, nextPhase };
}

/**
 * Fase activa con el monto más alto (referencia promocional “Antes”).
 * Incluye fases pasadas, vigente y futuras mientras `isActive`.
 */
export function resolveHighestActivePricePhase(
  phases: readonly PricePhaseRecord[],
): PricePhaseRecord | null {
  const active = phases.filter((p) => p.isActive);
  if (active.length === 0) return null;
  return active.reduce((best, p) => (p.amount > best.amount ? p : best));
}

export function validatePricePhaseInput(input: {
  name: string;
  amount: number;
  currency: string;
  startsAt: Date;
  endsAt: Date;
  capacity?: number | null;
  priority?: number;
}): { ok: true } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = "El nombre es obligatorio.";
  if (!Number.isInteger(input.amount) || input.amount < 0) {
    errors.amount = "El monto debe ser un entero >= 0 en centavos.";
  }
  if (input.currency !== "ARS") {
    errors.currency = "Moneda no admitida (MVP: ARS).";
  }
  if (!(input.startsAt instanceof Date) || Number.isNaN(input.startsAt.getTime())) {
    errors.startsAt = "Inicio inválido.";
  }
  if (!(input.endsAt instanceof Date) || Number.isNaN(input.endsAt.getTime())) {
    errors.endsAt = "Fin inválido.";
  }
  if (
    input.startsAt instanceof Date &&
    input.endsAt instanceof Date &&
    input.endsAt.getTime() < input.startsAt.getTime()
  ) {
    errors.endsAt = "El fin debe ser posterior o igual al inicio.";
  }
  if (
    input.capacity != null &&
    (!Number.isInteger(input.capacity) || input.capacity < 0)
  ) {
    errors.capacity = "El cupo debe ser un entero >= 0 o vacío.";
  }
  if (
    input.priority != null &&
    (!Number.isInteger(input.priority) || input.priority < 0)
  ) {
    errors.priority = "La prioridad debe ser un entero >= 0.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true };
}

/** Montos comerciales iniciales (pesos → se almacenan en centavos). */
export const DEFAULT_ARGENTINA_2026_PHASE_AMOUNTS_PESOS = [25_000, 30_000, 35_000] as const;

export function pesosToMinorUnits(pesos: number): number {
  return pesos * 100;
}
