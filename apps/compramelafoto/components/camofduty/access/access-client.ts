"use client";

import { CAMOFDUTY_PATHS, type CamOfDutyGate } from "@/lib/simulator/cam-of-duty-visits";

/** A dónde volver cuando termina el acceso (sólo rutas internas de Cam Of Duty). */
export function safeReturn(raw: string | null): string {
  return raw && raw.startsWith("/camofduty") && !raw.startsWith("//") ? raw : "/camofduty/simulador";
}

/** Siguiente paso según lo que le falta a la cuenta. */
export function nextPathFor(gate: CamOfDutyGate, returnTo: string): string | null {
  const q = `?redirect=${encodeURIComponent(returnTo)}`;
  if (gate === "verify") return `${CAMOFDUTY_PATHS.verify}${q}`;
  if (gate === "complete") return `${CAMOFDUTY_PATHS.complete}${q}`;
  if (gate === "ok") return returnTo;
  return null;
}

export async function fetchGate(): Promise<CamOfDutyGate | null> {
  const res = await fetch("/api/camofduty/perfil", { credentials: "include", cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { gate: CamOfDutyGate };
  return data.gate;
}
