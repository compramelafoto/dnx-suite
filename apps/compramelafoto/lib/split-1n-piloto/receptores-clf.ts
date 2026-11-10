import { combinarReceptores, resolvePilotoConfig, type PilotoConfig } from "./config";

export type LeerReceptoresClf = (ownerUserId: string) => Promise<Map<number, string>>;

/**
 * Receptores con consentimiento ACTIVE guardados en CLF, por usuario. Sólo los de la cuenta
 * cobradora de la plataforma y de producción: un consentimiento de prueba nunca cobra.
 */
async function leerReceptoresClfDeLaBase(ownerUserId: string): Promise<Map<number, string>> {
  const { prisma } = await import("@/lib/prisma");
  const filas = await prisma.dnxSplitConsent.findMany({
    where: {
      provider: "MERCADOPAGO",
      environment: "PRODUCTION",
      status: "ACTIVE",
      primaryProviderAccountReference: ownerUserId,
      providerReceiverId: { not: null },
      recipient: { userId: { not: null } },
    },
    select: { providerReceiverId: true, recipient: { select: { userId: true } } },
  });
  const mapa = new Map<number, string>();
  for (const f of filas) {
    const userId = f.recipient?.userId;
    if (userId != null && f.providerReceiverId) mapa.set(userId, f.providerReceiverId);
  }
  return mapa;
}

/**
 * Configuración del piloto con los receptores de CLF sumados (si el interruptor de
 * consentimiento está encendido). Nunca lanza: si la base falla, queda el mapa del entorno y
 * quien no esté ahí cae al cobro de siempre.
 */
export async function cargarConfigPiloto(
  env: NodeJS.ProcessEnv = process.env,
  leer: LeerReceptoresClf = leerReceptoresClfDeLaBase,
): Promise<PilotoConfig> {
  const config = resolvePilotoConfig(env);
  if (!config.enabled || !config.receptoresDesdeClf || !config.ownerUserId) return config;
  try {
    return combinarReceptores(config, await leer(config.ownerUserId));
  } catch (err: unknown) {
    console.error("[split-1n-piloto] receptores_clf_no_leidos", {
      error: err instanceof Error ? err.message : String(err),
    });
    return config;
  }
}
