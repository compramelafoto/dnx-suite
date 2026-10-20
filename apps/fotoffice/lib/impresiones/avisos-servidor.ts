import "server-only";
import { prisma } from "@repo/db";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { DIAS_HABILES_PROMETIDOS } from "./constantes";
import { esc } from "./correo-lab";

const fechaAr = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

/**
 * El correo al cliente cuando su pago de copias impresas se acreditó: cuántas copias, cuándo retirarlas y el
 * enlace de seguimiento. Corre después de la respuesta (`after()`); nunca lanza ni loguea datos personales.
 */
export async function avisarPedidoConfirmado(workspaceId: string, pedidoId: string): Promise<void> {
  try {
    const p = await prisma.fotofficePrintOrder.findFirst({ where: { id: pedidoId, workspaceId }, include: { items: { select: { quantity: true } } } });
    if (!p) return;
    const ws = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true, commercialName: true } });
    const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
    const enlace = base && ws?.publicSlug ? `${base}/w/${encodeURIComponent(ws.publicSlug)}/impresion/${p.trackingToken}` : null;
    const copias = p.items.reduce((s, i) => s + i.quantity, 0);
    const queCopias = `${copias} ${copias === 1 ? "copia" : "copias"}`;
    const fecha = p.promisedAt ? fechaAr(p.promisedAt) : null;
    const plazo = `${DIAS_HABILES_PROMETIDOS * 24} horas hábiles`;
    const cuando = fecha ? `Van a estar listas para retirar el ${fecha} (${plazo}).` : `Van a estar listas para retirar en ${plazo}.`;
    const cuandoHtml = fecha
      ? `Van a estar listas para retirar el <strong>${fecha}</strong> (${plazo}).`
      : `Van a estar listas para retirar en ${plazo}.`;
    const firma = ws?.commercialName ?? "";
    const r = await sendTransactionalEmail({
      to: p.email,
      sender: await loadWorkspaceSender(workspaceId),
      subject: `Recibimos tu pedido de copias (${p.number})`,
      text: [`¡Hola, ${p.nombre}!`, "", `Recibimos tu pedido de ${queCopias}. ${cuando}`, ...(enlace ? ["", `Seguí tu pedido acá: ${enlace}`] : []), "", firma].join("\n"),
      html: [
        `<p>¡Hola, ${esc(p.nombre)}!</p>`,
        `<p>Recibimos tu pedido de <strong>${queCopias}</strong>. ${cuandoHtml}</p>`,
        ...(enlace ? [`<p><a href="${esc(enlace)}">Seguí tu pedido acá</a>.</p>`] : []),
        firma ? `<p>${esc(firma)}</p>` : "",
      ].join(""),
    });
    if (r.status !== "SENT") console.warn("[impresiones] no salió el correo de confirmación", { estado: r.status });
  } catch {
    console.warn("[impresiones] falló el correo de confirmación");
  }
}
