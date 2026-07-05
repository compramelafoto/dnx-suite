/**
 * Rollout preventa canjeable V1 (catálogo pack / entitlement / canje).
 * Spec: docs/PREVENTA-CANJEABLE-SPEC-TECNICA.md — PREVENTA_PACKS_V1
 */

function rawFlag(): string {
  return process.env.PREVENTA_PACKS_V1?.trim().toLowerCase() ?? "";
}

/** Activo por defecto; desactivar con PREVENTA_PACKS_V1=false|0|no */
export function isPreventaPacksV1Enabled(): boolean {
  const v = rawFlag();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

/** Para logs o telemetría; no expone el secreto. */
export function preventaPacksV1Configured(): boolean {
  return rawFlag().length > 0;
}
