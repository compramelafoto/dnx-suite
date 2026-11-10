/**
 * Piloto de Split 1:N en el cobro de álbumes de CLF.
 *
 * Un álbum de la lista cobra con Orders API + Card Payment Brick y Mercado Pago reparte en el
 * momento entre fotógrafo, referidor y plataforma. Todo lo demás sigue con Checkout Pro.
 *
 * La configuración vive en variables de entorno a propósito: el piloto se enciende y se apaga
 * sin desplegar, y nunca lanza. Una entrada mal escrita se ignora y el álbum cae al cobro de
 * siempre, que es el lado seguro.
 */
export const PILOTO_FLAG = "DNX_CLF_SPLIT_1N_PILOTO_ENABLED" as const;
/** Apertura: reemplaza la lista de álbumes por «todos» (siguen mandando los consentimientos). */
export const TODOS_LOS_ALBUMES_FLAG = "DNX_CLF_SPLIT_1N_TODOS_LOS_ALBUMES" as const;
/** Apertura: consentimiento desde el panel y receptores leídos de CLF (`DnxSplitConsent`). */
/** Plan B en /pagar: botón «Pagar con Mercado Pago» (Checkout Pro del mismo pedido). */
export const PLAN_B_FLAG = "DNX_CLF_SPLIT_1N_PLAN_B_ENABLED" as const;
export const CONSENTIMIENTO_FLAG = "DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED" as const;

export type PilotoConfig = {
  enabled: boolean;
  albumIds: Set<number>;
  /** Con `true`, todo álbum es candidato y la lista `albumIds` deja de importar. */
  todosLosAlbumes: boolean;
  /** Con `true`, la página de pago ofrece «Pagar con Mercado Pago» junto a la tarjeta. */
  planB: boolean;
  /** Con `true`, los receptores con consentimiento ACTIVE guardados en CLF se suman al mapa. */
  receptoresDesdeClf: boolean;
  /** userId de CLF → receiver_id de Mercado Pago, con el consentimiento ya aceptado. */
  receiverByUserId: Map<number, string>;
  ownerUserId: string | null;
  accessToken: string | null;
  publicKey: string | null;
};

function enteroPositivo(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

function leerAlbumes(raw: string | undefined): Set<number> {
  const ids = new Set<number>();
  for (const parte of (raw ?? "").split(",")) {
    const id = enteroPositivo(parte);
    if (id != null) ids.add(id);
  }
  return ids;
}

function leerReceptores(raw: string | undefined): Map<number, string> {
  const mapa = new Map<number, string>();
  for (const parte of (raw ?? "").split(",")) {
    const [userRaw, receiverRaw] = parte.split(":");
    const userId = enteroPositivo(userRaw ?? "");
    const receiverId = receiverRaw?.trim();
    if (userId != null && receiverId) mapa.set(userId, receiverId);
  }
  return mapa;
}

function interruptor(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === "true";
}

function texto(raw: string | undefined): string | null {
  const t = raw?.trim();
  return t ? t : null;
}

export function resolvePilotoConfig(env: NodeJS.ProcessEnv = process.env): PilotoConfig {
  return {
    enabled: interruptor(env[PILOTO_FLAG]),
    albumIds: leerAlbumes(env.DNX_CLF_SPLIT_1N_PILOTO_ALBUM_IDS),
    todosLosAlbumes: interruptor(env[TODOS_LOS_ALBUMES_FLAG]),
    receptoresDesdeClf: interruptor(env[CONSENTIMIENTO_FLAG]),
    planB: interruptor(env[PLAN_B_FLAG]),
    receiverByUserId: leerReceptores(env.DNX_CLF_SPLIT_1N_PILOTO_RECEIVERS),
    ownerUserId: texto(env.DNX_CLF_SPLIT_1N_PILOTO_OWNER_USER_ID),
    accessToken: texto(env.DNX_MP_PLATFORM_ACCESS_TOKEN),
    publicKey: texto(env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY) ?? texto(env.MP_PUBLIC_KEY),
  };
}

/** ¿El álbum es candidato al piloto? (Después mandan los consentimientos y el carrito.) */
export function albumEnPiloto(config: PilotoConfig, albumId: number): boolean {
  return config.todosLosAlbumes || config.albumIds.has(albumId);
}

/**
 * Suma los receptores guardados en CLF al mapa del entorno. El entorno gana: es la corrección
 * manual, y sirve para tapar un dato malo de la base sin desplegar.
 */
export function combinarReceptores(config: PilotoConfig, desdeClf: Map<number, string>): PilotoConfig {
  const receiverByUserId = new Map(desdeClf);
  for (const [userId, receiverId] of config.receiverByUserId) receiverByUserId.set(userId, receiverId);
  return { ...config, receiverByUserId };
}
