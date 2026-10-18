import "server-only";
import { prisma } from "@repo/db";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { avisoPedidoRecibido } from "./aviso-pedido";

/**
 * Le manda al cliente el correo de "Recibimos tu pedido" (qué pidió, total, seña, saldo, fecha de
 * entrega y dónde retirarlo). Corre después de responder (`after`): si el cliente no tiene correo
 * o el envío falla, no molesta a quien está atendiendo. Nunca loguea datos personales.
 */
export async function avisarPedidoRecibido(workspaceId: string, pedidoId: string): Promise<void> {
  try {
    const p = await prisma.fotofficePedido.findFirst({
      where: { id: pedidoId, workspaceId },
      select: {
        number: true,
        items: true,
        totalArs: true,
        eventDate: true,
        eventLabel: true,
        status: true,
        client: { select: { firstName: true, businessName: true, email: true } },
      },
    });
    const email = p?.client?.email?.trim();
    if (!p || !email || p.status === "CANCELADO") return;
    const [branding, cobrado] = await Promise.all([
      prisma.fotofficeWorkspaceBranding.findUnique({
        where: { workspaceId },
        select: { commercialName: true, atencionDireccion: true, atencionHorario: true, whatsapp: true, phone: true },
      }),
      prisma.fotofficeCobro.aggregate({ where: { workspaceId, pedidoId, voidedAt: null }, _sum: { amountArs: true } }),
    ]);
    const items = (Array.isArray(p.items) ? p.items : [])
      .filter((i): i is { nombre: string; cantidad: number; opcional?: boolean } => {
        const o = i as Record<string, unknown> | null;
        return !!o && typeof o.nombre === "string" && typeof o.cantidad === "number" && o.opcional !== true;
      })
      .map((i) => ({ nombre: i.nombre, cantidad: i.cantidad }));
    if (items.length === 0) return;
    const estudio = branding?.commercialName?.trim() || "el estudio";
    const correo = avisoPedidoRecibido({
      estudio,
      nombre: p.client?.firstName?.trim() || p.client?.businessName?.trim() || "",
      numero: p.number,
      items,
      totalMinor: Math.round(Number(p.totalArs) * 100),
      cobradoMinor: Math.round(Number(cobrado._sum.amountArs ?? 0) * 100),
      entrega: p.eventDate ? p.eventDate.toISOString().slice(0, 10) : null,
      etiquetaFecha: p.eventLabel,
      direccion: branding?.atencionDireccion ?? null,
      horario: branding?.atencionHorario ?? null,
      contacto: branding?.whatsapp ? `WhatsApp ${branding.whatsapp}` : branding?.phone ? `teléfono ${branding.phone}` : null,
    });
    const sender = await loadWorkspaceSender(workspaceId);
    const r = await sendTransactionalEmail({ to: email, ...correo, sender });
    if (r.status !== "SENT") console.error("[pedidos][aviso-recibido] no salió", { status: r.status });
  } catch (e) {
    console.error("[pedidos][aviso-recibido] falló", { error: e instanceof Error ? e.message : "desconocido" });
  }
}
