import { getOrderDownloadCenterAccessToken } from "@/lib/digital-download/load-download-center";
import { resolveClientDigitalDownloadLinks } from "@/lib/digital-download/download-center-rollout";

/** Enlace a las descargas de un pedido pagado (centro de descargas), o null si no hay. */
export async function urlDescargaPedido(pedidoId: number, creado: Date): Promise<string | null> {
  try {
    const token = await getOrderDownloadCenterAccessToken(pedidoId);
    if (!token) return null;
    const links = resolveClientDigitalDownloadLinks({
      orderId: pedidoId,
      orderCreatedAt: creado,
      accessToken: token,
      baseUrl: process.env.APP_URL || "https://www.compramelafoto.com",
      context: "split_1n_carrito_evento",
    });
    return links.downloadCenterUrl ?? links.legacyDownloadUrl;
  } catch (err: unknown) {
    console.error("[carrito-evento] descarga_no_resuelta", { pedidoId, err });
    return null;
  }
}
