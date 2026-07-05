/**
 * Selección automática de HDRI según hora del día — Ciudad Fotográfica.
 * Reemplaza el cielo procedural; la IBL proviene exclusivamente del HDRI activo.
 */

import { clampTimeOfDayMinutes } from "../natural-light";
import { codHdriUrl } from "./paths";

export type HdriTimeSlot =
  | "morning"
  | "noon"
  | "golden-hour"
  | "blue-hour"
  | "night";

export interface HdriTimeSlotConfig {
  slot: HdriTimeSlot;
  label: string;
  /** Minutos desde medianoche [inicio, fin) — fin exclusivo salvo night que envuelve. */
  startMin: number;
  endMin: number;
}

/** Franjas horarias simplificadas (hora local simulada). */
export const HDRI_TIME_SLOTS: readonly HdriTimeSlotConfig[] = [
  { slot: "night", label: "Noche", startMin: 0, endMin: 5 * 60 + 30 },
  { slot: "morning", label: "Mañana", startMin: 5 * 60 + 30, endMin: 10 * 60 + 30 },
  { slot: "noon", label: "Mediodía", startMin: 10 * 60 + 30, endMin: 15 * 60 + 30 },
  { slot: "golden-hour", label: "Hora dorada", startMin: 15 * 60 + 30, endMin: 19 * 60 + 30 },
  { slot: "blue-hour", label: "Hora azul", startMin: 19 * 60 + 30, endMin: 21 * 60 },
  { slot: "night", label: "Noche", startMin: 21 * 60, endMin: 24 * 60 },
] as const;

export function resolveHdriSlotFromMinutes(minutes: number): HdriTimeSlot {
  const m = clampTimeOfDayMinutes(minutes);
  for (const cfg of HDRI_TIME_SLOTS) {
    if (m >= cfg.startMin && m < cfg.endMin) return cfg.slot;
  }
  return "noon";
}

export function resolveHdriUrlFromMinutes(minutes: number): string {
  return codHdriUrl(resolveHdriSlotFromMinutes(minutes));
}

export function getHdriSlotLabel(slot: HdriTimeSlot): string {
  const cfg = HDRI_TIME_SLOTS.find((s) => s.slot === slot);
  return cfg?.label ?? slot;
}
