import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-queue";
import { latestFxRate } from "./fx-store";
import { recordCommission } from "./wallet-store";
import type { IntlCommissionDeps } from "./intl-finalize";

function usd(cents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD" }).format(cents / 100);
}

export const defaultIntlCommissionDeps: IntlCommissionDeps = {
  loadOrder: async (orderId) => {
    const o = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        currency: true,
        pricingSnapshot: true,
        album: { select: { userId: true, user: { select: { email: true } } } },
      },
    });
    if (!o) return null;
    return {
      id: o.id,
      currency: o.currency,
      pricingSnapshot: o.pricingSnapshot,
      ownerUserId: o.album?.userId ?? null,
      ownerEmail: o.album?.user?.email ?? null,
    };
  },
  latestFxRate,
  recordCommission,
  sendLowBalanceEmail: async (to, balanceUsdCents) => {
    const appUrl = process.env.APP_URL || "https://compramelafoto.com";
    const link = `${appUrl}/fotografo/configuracion?tab=saldo`;
    const body =
      `Tu saldo de CompraMeLaFoto es de ${usd(balanceUsdCents)}.\n\n` +
      `Cuando llegue a cero, tus álbumes dejan de aceptar compras nuevas hasta que recargues.\n\n` +
      `Podés recargar desde acá: ${link}`;
    await queueEmail({
      to,
      subject: "Tu saldo de CompraMeLaFoto está por terminarse",
      body,
      htmlBody: body
        .split("\n\n")
        .map((p) => `<p>${p.replace(link, `<a href="${link}">${link}</a>`)}</p>`)
        .join(""),
      idempotencyKey: `intl-low-balance:${to}:${new Date().toISOString().slice(0, 10)}`,
    });
  },
};
