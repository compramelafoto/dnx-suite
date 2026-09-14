import "server-only";
import { prisma } from "@repo/db";
import {
  resolveCollector,
  type CollectorResult,
} from "@repo/payments/mercado-pago-connect";
import { SUBILAFOTO_PRODUCT_KEY, referenciaDelVendedor } from "./constantes";
import { leerConfigDePagos } from "./config";

/**
 * Con qué token cobra un vendedor.
 *
 * En el modelo de dos vías el cobrador es **el vendedor**, no la plataforma: la venta
 * entra en su cuenta de Mercado Pago y nosotros retenemos la comisión en la misma
 * operación. Por eso hace falta su token y no el nuestro.
 *
 * El flujo —leer la cuenta, descifrar la credencial, refrescar el token si está por
 * vencer— es el compartido. Sin el refresco los cobros se caen solos cuando el token
 * vence y nadie entiende por qué: la cuenta figura conectada y Mercado Pago rechaza.
 */
export async function cobradorDelVendedor(
  perfilId: string,
  opciones: { now?: Date } = {},
): Promise<CollectorResult> {
  return resolveCollector({
    organizationRef: referenciaDelVendedor(perfilId),
    prisma: prisma as never,
    config: leerConfigDePagos(),
    productKey: SUBILAFOTO_PRODUCT_KEY,
    now: opciones.now,
  });
}
