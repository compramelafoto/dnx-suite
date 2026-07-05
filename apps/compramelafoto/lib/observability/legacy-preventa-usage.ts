/**
 * Logs estructurados para medir uso real del puente legacy de precompra/preventa.
 * Prefijo fijo para filtrar en Vercel/Datadog/etc. Retirar cuando ya no haga falta la evidencia.
 */
const PREFIX = "[legacy_preventa_obs]";

export type LegacyPreventaUsagePayload = Record<string, unknown> & {
  source: string;
};

export function logLegacyPreventaUsage(payload: LegacyPreventaUsagePayload): void {
  try {
    const line = {
      ts: new Date().toISOString(),
      ...payload,
    };
    console.info(`${PREFIX} ${JSON.stringify(line)}`);
  } catch {
    // no-op: observabilidad no debe romper requests
  }
}
