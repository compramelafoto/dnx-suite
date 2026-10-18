import "server-only";
import { prisma } from "@repo/db";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { leerAjustesCobro } from "@/lib/cobro-ajustes/ajustes";
import { carpetaTieneArchivos, emitirEnlace } from "@/lib/carpetas/carpeta";
import { avisoListoParaRetirar } from "./aviso-listo";
import { faseDeEtapa } from "./en-curso-puro";

/**
 * Manda al cliente el aviso de "Listo para retirar": qué está listo, el saldo, los datos para
 * transferir, dirección y horario de atención y, si hay archivos, el enlace para descargarlos.
 * Sale con el remitente del estudio (las respuestas llegan a su correo de contacto) y deja una
 * nota en el trabajo.
 */
export type ResultadoAviso = { ok: true; email: string } | { ok: false; error: string };

export async function avisarListoParaRetirar(workspaceId: string, proyectoId: string, autorUserId: number | null): Promise<ResultadoAviso> {
  const p = await prisma.fotofficeProyecto.findFirst({
    where: { id: proyectoId, workspaceId },
    select: {
      name: true,
      pedidoId: true,
      product: { select: { name: true } },
      client: { select: { firstName: true, lastName: true, businessName: true, email: true } },
    },
  });
  if (!p) return { ok: false, error: "Ese trabajo no existe." };
  const email = p.client?.email?.trim();
  if (!email) return { ok: false, error: "El cliente no tiene correo cargado: avisale por WhatsApp." };

  const [branding, ajustes, pedido, cobrado, conArchivos] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId },
      select: { commercialName: true, atencionDireccion: true, atencionHorario: true, whatsapp: true, phone: true, city: true },
    }),
    leerAjustesCobro(workspaceId),
    p.pedidoId ? prisma.fotofficePedido.findFirst({ where: { id: p.pedidoId, workspaceId }, select: { totalArs: true, status: true } }) : null,
    p.pedidoId
      ? prisma.fotofficeCobro.aggregate({ where: { workspaceId, pedidoId: p.pedidoId, voidedAt: null }, _sum: { amountArs: true } })
      : null,
    carpetaTieneArchivos(workspaceId, proyectoId),
  ]);
  const saldoMinor =
    pedido && pedido.status !== "CANCELADO" ? Math.max(0, Math.round((Number(pedido.totalArs) - Number(cobrado?._sum.amountArs ?? 0)) * 100)) : 0;
  const enlace = conArchivos ? await emitirEnlace(workspaceId, proyectoId, "CLIENTE") : null;
  const estudio = branding?.commercialName?.trim() || "el estudio";
  const contacto = branding?.whatsapp ? `WhatsApp ${branding.whatsapp}` : branding?.phone ? `teléfono ${branding.phone}` : null;

  const correo = avisoListoParaRetirar({
    estudio,
    nombre: p.client?.firstName?.trim() || p.client?.businessName?.trim() || "",
    trabajo: p.product?.name ?? p.name,
    saldoMinor,
    transferencia: ajustes.alias || ajustes.cbuCvu ? { alias: ajustes.alias, cbuCvu: ajustes.cbuCvu, titular: ajustes.titular, banco: ajustes.banco } : null,
    direccion: branding?.atencionDireccion ?? null,
    horario: branding?.atencionHorario ?? null,
    contacto,
    archivos: enlace && enlace.ok ? { url: enlace.url, vence: enlace.vence } : null,
  });
  const sender = await loadWorkspaceSender(workspaceId);
  const r = await sendTransactionalEmail({ to: email, ...correo, sender });
  if (r.status !== "SENT") {
    console.error("[proyectos][aviso-listo] no salió", { status: r.status });
    return { ok: false, error: "El correo no salió. Avisale por WhatsApp." };
  }
  await prisma.fotofficeProyectoNota.create({
    data: { workspaceId, proyectoId, authorUserId: autorUserId, body: `Aviso de «Listo para retirar» enviado por correo a ${email}.` },
  });
  return { ok: true, email };
}

/** Después de mover un trabajo: si quedó en "Listo para retirar", avisa solo (si el cliente tiene correo). */
export async function avisarSiQuedoListo(workspaceId: string, proyectoId: string, autorUserId: number | null): Promise<void> {
  try {
    const j = await prisma.fotofficeJourney.findFirst({
      where: { workspaceId, subjectType: "PROYECTO", subjectId: proyectoId, stageId: { not: null } },
      select: { circuitId: true, stageId: true },
    });
    if (!j?.stageId) return;
    const etapas = await prisma.fotofficeStage.findMany({
      where: { circuitId: j.circuitId, archivedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true, order: true },
    });
    const actual = etapas.find((e) => e.id === j.stageId);
    if (!actual) return;
    const fase = faseDeEtapa({ name: actual.name, color: actual.color, order: actual.order, esUltima: etapas.at(-1)?.id === actual.id });
    if (fase !== "LISTO") return;
    await avisarListoParaRetirar(workspaceId, proyectoId, autorUserId);
  } catch (e) {
    console.error("[proyectos][aviso-listo] falló el aviso automático", { error: e instanceof Error ? e.name : "?" });
  }
}
