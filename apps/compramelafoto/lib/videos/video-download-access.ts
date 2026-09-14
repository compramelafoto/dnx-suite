import { PURGED_ORIGINAL_KEY } from "@/lib/videos/video-cleanup";

/**
 * Quién puede bajar un video comprado.
 *
 * Está separado del endpoint a propósito: son las reglas que protegen el
 * archivo original, y conviene poder probarlas sin levantar una petición.
 */

export type DownloadCheck = {
  orderStatus: string;
  /** Pedido al que pertenece el token de descarga. */
  tokenOrderId: number | null;
  /** Pedido que se está consultando. */
  orderId: number;
  /** Videos que ese pedido efectivamente pagó. */
  boughtVideoIds: number[];
  /** Video que se pide bajar. */
  requestedVideoId: number;
  /** El archivo ya se borró por la regla de los 15 días. */
  videoPurged: boolean;
};

export type DownloadVerdict = { allowed: boolean; reason?: string };

export function canDownloadPurchasedVideo(check: DownloadCheck): DownloadVerdict {
  if (check.tokenOrderId == null || check.tokenOrderId !== check.orderId) {
    return { allowed: false, reason: "Este link no corresponde a este pedido" };
  }

  if (check.orderStatus !== "PAID") {
    return {
      allowed: false,
      reason:
        check.orderStatus === "REFUNDED"
          ? "Este pedido fue devuelto"
          : "Todavía no registramos el pago de este pedido",
    };
  }

  if (check.boughtVideoIds.length === 0) {
    return { allowed: false, reason: "Este pedido no incluye videos" };
  }

  // Con un link válido, alguien podría probar cualquier id de video: sólo se
  // entregan los que ese pedido pagó.
  if (!check.boughtVideoIds.includes(check.requestedVideoId)) {
    return { allowed: false, reason: "Ese video no forma parte de este pedido" };
  }

  if (check.videoPurged) {
    return {
      allowed: false,
      reason: "El video ya no está disponible: pasaron los 15 días de publicación",
    };
  }

  return { allowed: true };
}

/** Un video cuyo archivo ya se borró de R2. */
export function isVideoFilePurged(video: { originalKey: string }): boolean {
  const key = video.originalKey?.trim() ?? "";
  return key === "" || key === PURGED_ORIGINAL_KEY;
}
