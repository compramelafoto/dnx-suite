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

export type PilotoConfig = {
  enabled: boolean;
  albumIds: Set<number>;
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

function texto(raw: string | undefined): string | null {
  const t = raw?.trim();
  return t ? t : null;
}

export function resolvePilotoConfig(env: NodeJS.ProcessEnv = process.env): PilotoConfig {
  return {
    enabled: env[PILOTO_FLAG]?.trim().toLowerCase() === "true",
    albumIds: leerAlbumes(env.DNX_CLF_SPLIT_1N_PILOTO_ALBUM_IDS),
    receiverByUserId: leerReceptores(env.DNX_CLF_SPLIT_1N_PILOTO_RECEIVERS),
    ownerUserId: texto(env.DNX_CLF_SPLIT_1N_PILOTO_OWNER_USER_ID),
    accessToken: texto(env.DNX_MP_PLATFORM_ACCESS_TOKEN),
    publicKey: texto(env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY) ?? texto(env.MP_PUBLIC_KEY),
  };
}
