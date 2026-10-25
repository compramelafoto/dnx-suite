import "server-only";
import { prisma } from "@repo/db";
import { normalizeWhatsappNumber } from "@/lib/contact/whatsapp";
import { CANALES, MAX_ASUNTO, type Canal } from "@/lib/plantillas/constantes";
import { correoValido, destinoDe } from "@/lib/plantillas/contexto";
import { listarPlantillas, plantillaParaUsar } from "@/lib/plantillas/definiciones";
import { abrirWhatsapp, completarTextos, enviarCorreo, MENSAJES_ENVIO, type CtxEnvio, type DepsEnvio } from "@/lib/plantillas/envio";
import { tieneMarcadorSinCompletar } from "@/lib/plantillas/motor";
import { MENSAJES_PEDIDO, ORDERS_MODULE_KEY, puedeGestionarPedidos, type CtxPedidos } from "./acceso";
import { MENSAJES_ENLACE, type DepsEnlace } from "./enlace";
import { asegurarPlantillasPedido } from "./plantillas";
import { conEnlaceDelRecibo, contextoDeMensajePedido } from "./recibos";

/**
 * "Enviar por correo" y "WhatsApp" desde la ficha del pedido (y desde el recibo recién
 * registrado), con "Gestionar" en Pedidos.
 *
 * Es el envío manual de `lib/plantillas` con plantillas de tipo PEDIDO (o GENERAL): el texto llega
 * CON variables (`[nombre]`, `[pedido_enlace]`, `[recibo_enlace]`…) y se completa en el servidor
 * con los datos del contacto del pedido. Con `cobroId`, además, las del recibo; si el texto no trae
 * el enlace del recibo, se agrega antes de la firma. El enlace del pedido se crea sólo si el texto
 * lo usa.
 *
 * El mensaje va al contacto del pedido (su correo o su teléfono) y queda registrado en el pedido
 * (`entityType` PEDIDO), así sale en el historial de la ficha. WhatsApp devuelve el enlace `wa.me`
 * para abrir. Nunca loguea datos personales.
 */

export type DatosMensajePedido = {
  canal: unknown;
  templateId?: unknown;
  asunto?: unknown;
  cuerpo?: unknown;
  /** El cobro cuyo recibo se manda (opcional). */
  cobroId?: unknown;
};

export type ResultadoMensajePedido = { ok: true; whatsappUrl: string | null } | { ok: false; error: string; registrado?: boolean };

export const MENSAJES_MENSAJE_PEDIDO = {
  canal: "Elegí correo o WhatsApp.",
  sinTexto: "Elegí una plantilla o escribí el mensaje.",
  cobro: "No encontramos ese cobro.",
  anulado: "Ese cobro está anulado: su recibo no se envía.",
} as const;

type Falla = { ok: false; error: string };
const no = (error: string): Falla => ({ ok: false, error });

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function ctxDeEnvio(ctx: CtxPedidos): CtxEnvio {
  return { workspaceId: ctx.workspaceId, userId: ctx.userId, userLabel: ctx.userLabel, role: ctx.role, acceso: ctx.acceso };
}

export async function enviarMensajePedido(
  ctx: CtxPedidos,
  pedidoId: unknown,
  datos: DatosMensajePedido,
  deps: DepsEnvio & DepsEnlace = {},
): Promise<ResultadoMensajePedido> {
  if (!puedeGestionarPedidos(ctx)) return no(MENSAJES_PEDIDO.sinPermiso);
  if (!idValido(pedidoId) || !datos || typeof datos !== "object") return no(MENSAJES_PEDIDO.datosInvalidos);
  if (typeof datos.canal !== "string" || !(CANALES as readonly string[]).includes(datos.canal)) return no(MENSAJES_MENSAJE_PEDIDO.canal);
  const canal = datos.canal as Canal;
  const cobroId = datos.cobroId === undefined || datos.cobroId === null || datos.cobroId === "" ? null : datos.cobroId;
  if (cobroId !== null && !idValido(cobroId)) return no(MENSAJES_MENSAJE_PEDIDO.cobro);
  const { workspaceId } = ctx;
  const ahora = (deps.ahora ?? (() => new Date()))();

  // El texto: el que llegó o el de la plantilla (PEDIDO o GENERAL, del canal).
  let templateId: string | null = null;
  let plantilla: { subject: string | null; body: string } | null = null;
  if (datos.templateId !== undefined && datos.templateId !== null && datos.templateId !== "") {
    const p = await plantillaParaUsar(workspaceId, datos.templateId, canal, "PEDIDO");
    if (!p) return no(MENSAJES_ENVIO.plantillaNoEncontrada);
    templateId = p.id;
    plantilla = { subject: p.subject, body: p.body };
  }
  let asunto: string | null;
  let cuerpo: string;
  if (typeof datos.cuerpo === "string" && datos.cuerpo.trim()) {
    cuerpo = datos.cuerpo;
    asunto = canal === "EMAIL" ? (typeof datos.asunto === "string" ? datos.asunto : "") : null;
  } else if (plantilla) {
    cuerpo = plantilla.body;
    asunto = canal === "EMAIL" ? (plantilla.subject ?? "") : null;
  } else {
    return no(MENSAJES_MENSAJE_PEDIDO.sinTexto);
  }

  // El recibo de un cobro anulado no se manda (ni se registra un WhatsApp con él).
  if (cobroId !== null) {
    const c = await prisma.fotofficeCobro.findFirst({ where: { id: cobroId, workspaceId, pedidoId }, select: { voidedAt: true } });
    if (!c) return no(MENSAJES_MENSAJE_PEDIDO.cobro);
    if (c.voidedAt) return no(MENSAJES_MENSAJE_PEDIDO.anulado);
  }

  const leido = await contextoDeMensajePedido(
    workspaceId,
    pedidoId,
    { cobroId, usuario: { nombre: ctx.userLabel ?? null, email: null }, ahora, textos: [asunto, cuerpo] },
    deps,
  );
  if (!leido.ok) return no(leido.codigo === "SIN_ENLACE" ? MENSAJES_ENLACE.sinSitio : cobroId ? MENSAJES_MENSAJE_PEDIDO.cobro : MENSAJES_PEDIDO.noExiste);
  const textos = completarTextos(leido.contexto, "PEDIDO", canal === "EMAIL" ? asunto : null, cuerpo);
  if (!textos.ok) return textos;
  const final = leido.enlaceRecibo ? conEnlaceDelRecibo(textos.cuerpo, leido.enlaceRecibo) : textos.cuerpo;
  if (canal === "EMAIL" && (!textos.asunto || textos.asunto.length > MAX_ASUNTO)) return no(MENSAJES_ENVIO.asunto);
  if (tieneMarcadorSinCompletar(textos.asunto) || tieneMarcadorSinCompletar(final)) return no(MENSAJES_ENVIO.marcadorSinCompletar);

  const registrarEn = { entityType: "PEDIDO" as const, entityId: leido.pedidoId };
  const opciones = { modulo: ORDERS_MODULE_KEY, tipoPlantilla: "PEDIDO" as const };
  if (canal === "EMAIL") {
    const r = await enviarCorreo(
      ctxDeEnvio(ctx),
      { entityType: "CLIENTE", entityId: leido.clientId, templateId, asunto: textos.asunto, cuerpo: final, registrarEn },
      { enviar: deps.enviar, ahora: () => ahora },
      opciones,
    );
    return r.ok ? { ok: true, whatsappUrl: null } : r;
  }
  const r = await abrirWhatsapp(ctxDeEnvio(ctx), { entityType: "CLIENTE", entityId: leido.clientId, templateId, cuerpo: final, registrarEn }, opciones);
  return r.ok ? { ok: true, whatsappUrl: r.url } : r;
}

// --- Lo que necesita la pantalla -----------------------------------------------------------------

export type PlantillaDePedido = { id: string; nombre: string; canal: Canal; asunto: string | null; cuerpo: string };

export type OpcionesEnvioPedido = {
  plantillas: PlantillaDePedido[];
  /** Si el contacto del pedido tiene adónde recibir cada canal. */
  destino: { correo: boolean; whatsapp: boolean };
};

/**
 * Plantillas de PEDIDO y GENERAL de cada canal (con su texto con variables) y si el contacto tiene
 * correo o WhatsApp. Siembra una vez las plantillas de Pedidos ("Tu pedido" en DNX). Con
 * "Gestionar"; si no, null.
 */
export async function opcionesDeEnvioPedido(ctx: CtxPedidos, pedidoId: string): Promise<OpcionesEnvioPedido | null> {
  if (!puedeGestionarPedidos(ctx) || !idValido(pedidoId)) return null;
  const { workspaceId } = ctx;
  const p = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { clientId: true } });
  if (!p) return null;
  const branding = await prisma.fotofficeWorkspaceBranding.findFirst({ where: { workspaceId }, select: { publicSlug: true } });
  await asegurarPlantillasPedido(workspaceId, branding?.publicSlug ?? "");
  const [email, whatsapp, destino] = await Promise.all([
    listarPlantillas(workspaceId, { canal: "EMAIL", tipo: "PEDIDO" }),
    listarPlantillas(workspaceId, { canal: "WHATSAPP", tipo: "PEDIDO" }),
    destinoDe(workspaceId, "CLIENTE", p.clientId),
  ]);
  return {
    plantillas: [...email, ...whatsapp].map((f) => ({ id: f.id, nombre: f.name, canal: f.channel, asunto: f.subject, cuerpo: f.body })),
    destino: { correo: correoValido(destino?.email), whatsapp: normalizeWhatsappNumber(destino?.telefono) !== null },
  };
}
