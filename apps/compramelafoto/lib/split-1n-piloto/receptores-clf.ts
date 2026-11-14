import { combinarReceptores, resolvePilotoConfig, type PilotoConfig } from "./config";

/**
 * Usuarios de CLF que cobran en la cuenta de Mercado Pago de otro usuario. Mercado Pago da un
 * solo `receiver_id` por cuenta y la base no deja asignarlo a dos usuarios, así que el segundo
 * no puede aceptar el cobro dividido por su lado. Clave: quien no puede aceptar; valor: el
 * usuario dueño del consentimiento.
 *
 * - 570 FOTOLAB MIDI (organizador) usa la cuenta de 166 Suan Chamorro (fotógrafa), misma
 *   persona y misma cuenta de MP (pedido de Daniel, 14/11/2026).
 */
export const CUENTAS_COMPARTIDAS: ReadonlyMap<number, number> = new Map([[570, 166]]);

/** Suma los usuarios de `CUENTAS_COMPARTIDAS`; nunca pisa un receptor que ya tenga cada uno. */
export function sumarCuentasCompartidas(
  config: PilotoConfig,
  compartidas: ReadonlyMap<number, number> = CUENTAS_COMPARTIDAS,
): PilotoConfig {
  const receiverByUserId = new Map(config.receiverByUserId);
  for (const [userId, duenioId] of compartidas) {
    const receiverId = receiverByUserId.get(duenioId);
    if (receiverId && !receiverByUserId.has(userId)) receiverByUserId.set(userId, receiverId);
  }
  return { ...config, receiverByUserId };
}

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
    return sumarCuentasCompartidas(combinarReceptores(config, await leer(config.ownerUserId)));
  } catch (err: unknown) {
    console.error("[split-1n-piloto] receptores_clf_no_leidos", {
      error: err instanceof Error ? err.message : String(err),
    });
    return config;
  }
}
