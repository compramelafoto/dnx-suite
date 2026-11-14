import "server-only";
import { prisma } from "@repo/db";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { leerAjustesCobro } from "@/lib/cobro-ajustes/ajustes";
import { carpetaTieneArchivos, emitirEnlace } from "@/lib/carpetas/carpeta";
import { leerConexion } from "@/lib/bandeja/conexion";
import { enviarAvisoPorWhatsapp } from "@/lib/bandeja/aviso-sistema";
import { enviarPlantilla } from "@/lib/bandeja/plantilla-meta";
import { puedeResponderLibre } from "@/lib/bandeja/reglas";
import { waIdDe } from "@/lib/bandeja/telefono";
import { enlaceDelPedidoDelSistema } from "@/lib/pedidos/enlace";
import { avisoListoParaRetirar } from "./aviso-listo";
import { botonDelPedido, plantillaListo, resumenDelAviso, textoListoWhatsapp, type DatosListoWhatsapp } from "./aviso-listo-whatsapp";
import { faseDeEtapa } from "./en-curso-puro";

/**
 * Manda al cliente el aviso de "Listo para retirar" por correo y por WhatsApp (los dos, si tiene).
 * - Correo: qué está listo, el saldo, los datos para transferir, dirección y horario y, si hay
 *   archivos, el enlace para descargarlos. Sale con el remitente del estudio.
 * - WhatsApp: con la ventana de 24 h abierta, un texto corto con el enlace para pagar el saldo; si
 *   está cerrada, la plantilla `pedido_listo` o `pedido_listo_con_saldo` de Meta (se cobra).
 * Deja una nota en el trabajo con lo que salió.
 */
export type ResultadoAviso = { ok: true; email: string | null; whatsapp: boolean; resumen: string } | { ok: false; error: string };

export async function avisarListoParaRetirar(
  workspaceId: string,
  proyectoId: string,
  autorUserId: number | null,
  opciones: { soloCorreo?: boolean } = {},
): Promise<ResultadoAviso> {
  const p = await prisma.fotofficeProyecto.findFirst({
    where: { id: proyectoId, workspaceId },
    select: {
      name: true,
      pedidoId: true,
      clientId: true,
      product: { select: { name: true } },
      client: { select: { firstName: true, lastName: true, businessName: true, email: true, phone: true } },
    },
  });
  if (!p) return { ok: false, error: "Ese trabajo no existe." };
  const email = p.client?.email?.trim() || null;
  if (opciones.soloCorreo && !email) return { ok: false, error: "El cliente no tiene correo cargado." };
  const waId = opciones.soloCorreo ? null : await whatsappDelCliente(workspaceId, p.clientId, p.client?.phone ?? null);
  if (!email && !waId) return { ok: false, error: "El cliente no tiene correo ni WhatsApp cargado: avisale a mano." };

  const [branding, ajustes, pedido, cobrado, conArchivos] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId },
      select: { commercialName: true, atencionDireccion: true, atencionHorario: true, whatsapp: true, phone: true, city: true, publicSlug: true },
    }),
    leerAjustesCobro(workspaceId),
    p.pedidoId ? prisma.fotofficePedido.findFirst({ where: { id: p.pedidoId, workspaceId }, select: { totalArs: true, status: true, number: true } }) : null,
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

  const nombre = p.client?.firstName?.trim() || p.client?.businessName?.trim() || "";
  const trabajo = p.product?.name ?? p.name;

  let correoSalio = false;
  if (email) {
    const correo = avisoListoParaRetirar({
      estudio,
      nombre,
      trabajo,
      saldoMinor,
      transferencia: ajustes.alias || ajustes.cbuCvu ? { alias: ajustes.alias, cbuCvu: ajustes.cbuCvu, titular: ajustes.titular, banco: ajustes.banco } : null,
      direccion: branding?.atencionDireccion ?? null,
      horario: branding?.atencionHorario ?? null,
      contacto,
      archivos: enlace && enlace.ok ? { url: enlace.url, vence: enlace.vence } : null,
    });
    const sender = await loadWorkspaceSender(workspaceId);
    const r = await sendTransactionalEmail({ to: email, ...correo, sender });
    correoSalio = r.status === "SENT";
    if (!correoSalio) console.error("[proyectos][aviso-listo] no salió el correo", { status: r.status });
  }

  let whatsappSalio = false;
  if (waId) {
    // Con alias o CVU cargado, el saldo se ofrece por transferencia: sin link de Mercado Pago (y sin el botón de la plantilla).
    const transferencia = saldoMinor > 0 && (ajustes.alias || ajustes.cbuCvu) ? { alias: ajustes.alias, cbuCvu: ajustes.cbuCvu } : null;
    const urlPago = saldoMinor > 0 && p.pedidoId && !transferencia ? await enlaceDelPedidoDelSistema(workspaceId, p.pedidoId).catch(() => null) : null;
    whatsappSalio = await avisarPorWhatsapp(
      workspaceId,
      waId,
      { nombre, trabajo, numeroPedido: pedido?.number ?? null, saldoMinor, urlPago: urlPago?.ok ? urlPago.url : null, horario: branding?.atencionHorario ?? null, urlArchivos: enlace && enlace.ok ? enlace.url : null, transferencia },
      branding?.publicSlug ?? null,
    );
  }

  if (!correoSalio && !whatsappSalio) {
    return { ok: false, error: email ? "El aviso no salió ni por correo ni por WhatsApp: avisale a mano." : "El aviso por WhatsApp no salió: avisale a mano." };
  }
  const resumen = resumenDelAviso(correoSalio ? email : null, whatsappSalio);
  await prisma.fotofficeProyectoNota.create({
    data: { workspaceId, proyectoId, authorUserId: autorUserId, body: `Aviso de «Listo para retirar»: ${resumen.replace(/^Se le avisó/, "enviado")}` },
  });
  return { ok: true, email: correoSalio ? email : null, whatsapp: whatsappSalio, resumen };
}

/** El WhatsApp del cliente: el de su chat en la Bandeja (el más reciente) o, si no hay, el de su teléfono. */
async function whatsappDelCliente(workspaceId: string, clientId: string | null, telefono: string | null): Promise<string | null> {
  if (clientId) {
    const chat = await prisma.fotofficeWaChat.findFirst({ where: { workspaceId, clientId }, orderBy: { ultimoMensajeEn: "desc" }, select: { waId: true } });
    if (chat) return chat.waId;
  }
  return waIdDe(telefono);
}

/**
 * Dentro de la ventana de 24 h, texto libre (gratis). Fuera, la plantilla de Meta. true si salió de
 * verdad (en modo simulado no cuenta). Nunca lanza.
 */
async function avisarPorWhatsapp(workspaceId: string, waId: string, d: DatosListoWhatsapp, slug: string | null): Promise<boolean> {
  try {
    const conexion = await leerConexion(workspaceId);
    if (conexion.modo !== "REAL") return false;
    const ahora = new Date();
    const chat = await prisma.fotofficeWaChat.findFirst({ where: { workspaceId, waId }, select: { id: true, ultimoEntranteEn: true } });
    if (chat && puedeResponderLibre(chat, ahora)) {
      const r = await enviarAvisoPorWhatsapp(workspaceId, waId, textoListoWhatsapp(d), { ahora, autor: "Aviso de pedido listo" });
      if (r === "ENVIADO") return true;
      if (r !== "VENTANA_CERRADA") return false;
    }
    const plantilla = plantillaListo(d, d.urlPago ? botonDelPedido(d.urlPago, slug) : null);
    const r = await enviarPlantilla(conexion, waId, plantilla);
    if (chat) {
      await prisma.fotofficeWaMensaje
        .create({
          data: {
            workspaceId, chatId: chat.id, direccion: "SALIENTE", autor: "BOT", autorLabel: "Aviso de pedido listo", tipo: "PLANTILLA",
            texto: `Plantilla «${plantilla.nombre}» (${plantilla.cuerpo.join(" · ")})`, estadoEnvio: r.ok ? (r.simulado ? "SIMULADO" : "ENVIADO") : "FALLO",
            waMessageId: r.ok && !r.simulado ? r.waMessageId : null, errorCodigo: r.ok ? null : r.codigo, createdAt: ahora,
          },
        })
        .catch((e) => console.warn("[proyectos][aviso-listo] no se pudo guardar la plantilla en el chat", { codigo: e instanceof Error ? e.name : "?" }));
    }
    if (!r.ok) console.warn("[proyectos][aviso-listo] la plantilla no salió", { codigo: r.codigo });
    return r.ok && !r.simulado;
  } catch (e) {
    console.error("[proyectos][aviso-listo] falló el WhatsApp", { error: e instanceof Error ? e.name : "?" });
    return false;
  }
}

/** Después de mover un trabajo: si quedó en "Listo para retirar", avisa solo (por correo y/o WhatsApp). */
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

