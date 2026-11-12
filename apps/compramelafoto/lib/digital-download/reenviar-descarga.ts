import { resolveDownloadLinkDays } from "@/lib/digital-download/download-link-policy";
import { createClientDownloadToken } from "@/lib/download-tokens";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/services/settingsService";
import { resendDigitalDownloadEmailForOrder } from "@/lib/zip-job-notifications";

const DAY = 24 * 60 * 60 * 1000;

/** Estados de limpieza en los que el álbum ya no tiene (o está perdiendo) los originales. */
const LIMPIEZA_SIN_ORIGINALES = ["PROCESSING", "COMPLETED", "COMPLETED_WITH_REFERENCES"];

/** Después de la limpieza del álbum no hay originales que descargar. */
export function albumConOriginales(a: { deletedAt: Date | null; cleanupStatus: string }): boolean {
  return a.deletedAt == null && !LIMPIEZA_SIN_ORIGINALES.includes(a.cleanupStatus);
}

/** ¿El pedido tiene algo que bajar? (fotos digitales o videos). */
export async function pedidoTieneDescargas(orderId: number): Promise<boolean> {
  const [fotos, videos] = await Promise.all([
    prisma.orderItem.count({ where: { orderId, productType: "DIGITAL" } }),
    prisma.videoOrderItem.count({ where: { orderId } }),
  ]);
  return fotos + videos > 0;
}

/**
 * Reenvía el mail de descarga de un pedido; si no hay link vigente, crea uno nuevo
 * con los días de la configuración. No valida dueño ni estado: eso lo hace quien llama.
 * Con `renovar: false` (quien pide no probó ser dueño) un enlace vencido no se renueva ni se reenvía.
 * Un pedido sin fotos digitales ni videos (p. ej. un pack de preventa sin canjear) no recibe link:
 * el mail llevaba a «No hay fotos para descargar» (pedidos 3921 y 4673, 12/11/2026).
 */
export async function reenviarDescargaDePedido(
  o: { id: number; albumId: number },
  idempotencyKey: string,
  opciones: { renovar?: boolean } = {},
): Promise<
  { ok: true; renovado: boolean } | { ok: false; error: string; causa?: unknown; sinRenovar?: true; sinFotos?: true }
> {
  try {
    if (!(await pedidoTieneDescargas(o.id))) return { ok: false, error: "pedido sin fotos digitales", sinFotos: true };
    const vigente = await prisma.orderDownloadToken.findFirst({
      where: { orderId: o.id, type: "CLIENT_DIGITAL", photoId: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!vigente && opciones.renovar === false) return { ok: false, error: "enlace vencido sin renovar", sinRenovar: true };
    if (!vigente) {
      const days = resolveDownloadLinkDays(await getAppConfig());
      await createClientDownloadToken({
        orderId: o.id,
        albumId: o.albumId,
        expiresAt: new Date(Date.now() + days * DAY),
      });
    }
    const r = await resendDigitalDownloadEmailForOrder(o.id, { idempotencyKey });
    if (!r.queued) return { ok: false, error: r.error ?? "sin detalle" };
    return { ok: true, renovado: !vigente };
  } catch (e) {
    return { ok: false, error: String(e), causa: e };
  }
}
