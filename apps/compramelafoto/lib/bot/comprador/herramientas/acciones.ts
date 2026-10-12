import { defineTool, type BotTool, type ToolOutcome } from "@repo/dnx-bot";
import { z } from "zod";
import { guardarInteresEnAlbum } from "@/lib/albums/registrar-interes";
import { albumConOriginales, reenviarDescargaDePedido } from "@/lib/digital-download/reenviar-descarga";
import { normalizeEmail } from "@/lib/order-claims";
import { RESPUESTA_RECUPERAR_PACK, recuperarLinksDePack } from "@/lib/preventa-canjeable/recuperar-pack";
import { crearSolicitudDePrivacidad, PRIVACY_RELATIONSHIPS, PRIVACY_REQUEST_TYPES } from "@/lib/privacy/crear-solicitud-privacidad";
import { prisma } from "@/lib/prisma";
import { crearSolicitudDeRemocion } from "@/lib/public/crear-solicitud-remocion";
import { pedirCodigo, verificarCodigo } from "../codigo";
import type { CompradorActor } from "../identidad";
import { enmascararEmail } from "../mascara";
import { contarAccionesComprador, registrarAccionComprador } from "../store";
import { albumVisiblePara } from "./visibilidad";

/**
 * Error pensado para que lo lea la persona (vía el modelo). Cualquier otro error que lance una
 * herramienta de compradores llega al modelo como mensaje genérico (ver `herramientasComprador`).
 */
export class AvisoAlComprador extends Error {}

export const LIMITES_ACCIONES = {
  reenviosPorMailHora: 3,
  reenviosPorIpHora: 5,
  packPorMailHora: 3,
  packPorIpHora: 5,
  avisosPorIpDia: 5,
  solicitudesPorIpHora: 10,
} as const;

export const RESPUESTA_REENVIO =
  "Si hay compras pagadas con esos datos, te reenvié el enlace de descarga al mail con el que se hizo la compra. Puede tardar unos minutos; revisá también spam y promociones.";

const RESPUESTA_PACK = `${RESPUESTA_RECUPERAR_PACK} El enlace anterior deja de funcionar: usá el del mail nuevo.`;
const ALBUM_BORRADO =
  "El álbum de ese pedido ya se borró, así que no puedo generar un enlace nuevo. Si querés, abro un caso para que lo vea una persona.";

const UNA_HORA_MS = 60 * 60 * 1000;
const UN_DIA_MS = 24 * UNA_HORA_MS;
/** Los mismos 90 días que usa POST /api/a/[id]/register-interest. */
const AVISO_DURA_MS = 90 * UN_DIA_MS;

const TIPOS_EN_PALABRAS: Record<(typeof PRIVACY_REQUEST_TYPES)[number], string> = {
  ACCESO: "ver qué datos tuyos hay",
  RECTIFICACION: "corregir datos",
  SUPRESION: "borrar tus datos",
  OCULTAR_FOTO: "ocultar una foto",
  BAJA_MARKETING: "no recibir más publicidad",
  DESACTIVAR_BIOMETRIA: "borrar los datos de tu selfie",
};

const email = z.string().email().max(254);
const id = z.number().int().positive();

const haceUnaHora = () => new Date(Date.now() - UNA_HORA_MS);

/** ¿Pasó el tope por IP o (si hay mail) por mail en la última hora? */
async function superoTope(
  a: CompradorActor,
  toolName: string,
  mail: string | null,
  tope: { porIp: number; porMail: number },
): Promise<boolean> {
  const desde = haceUnaHora();
  const [porIp, porMail] = await Promise.all([
    contarAccionesComprador({ toolName, desde, ipHash: a.ipHash }),
    mail ? contarAccionesComprador({ toolName, desde, email: mail }) : Promise.resolve(0),
  ]);
  return porIp >= tope.porIp || porMail >= tope.porMail;
}

function pedirCodigoTool(a: CompradorActor): BotTool {
  return defineTool({
    name: "pedir_codigo",
    description:
      "Manda un código de 6 números al mail para que la persona demuestre que es suyo. Responde siempre lo mismo, haya compras o no con ese mail.",
    kind: "read",
    input: z.strictObject({ email }),
    run: async ({ email: mail }) => {
      const r = await pedirCodigo({ conversationId: a.conversationId, ipHash: a.ipHash, email: mail });
      // El resultado sólo queda en la base: devolverlo al modelo revelaría si el mail compró.
      await registrarAccionComprador({
        conversationId: a.conversationId, toolName: "pedir_codigo", email: mail, resultado: r.enviado ? "enviado" : "no_enviado",
      });
      return { ok: true, message: r.mensaje };
    },
  });
}

function verificarCodigoTool(a: CompradorActor): BotTool {
  return defineTool({
    name: "verificar_codigo",
    description: "Verifica el código de 6 números que le llegó por mail a la persona. Si es correcto, ya se pueden ver sus pedidos.",
    kind: "read",
    input: z.strictObject({ codigo: z.string().min(1).max(20) }),
    run: async ({ codigo }) => {
      const r = await verificarCodigo({ conversationId: a.conversationId, guestKey: a.guestKey, codigo });
      if (!r.ok) return { ok: false, message: r.mensaje };
      // Mutación del actor del turno: `mis_pedidos` ya funciona en la misma respuesta.
      a.emailVerificado = r.email;
      return { ok: true, message: `Listo, verifiqué tu mail (${enmascararEmail(r.email)}). Ya puedo ver tus pedidos.` };
    },
  });
}

type PedidoAReenviar = { id: number; albumId: number; buyerEmail: string | null; album: { deletedAt: Date | null; cleanupStatus: string } };

const SELECT_PEDIDO = {
  id: true, albumId: true, buyerEmail: true, album: { select: { deletedAt: true, cleanupStatus: true } },
} as const;

async function pedidosAReenviar(a: CompradorActor, pedido: number | undefined, mail: string | null): Promise<PedidoAReenviar[]> {
  const pagado = { status: "PAID" as const, isTest: false };
  const conMail = mail ? { buyerEmail: { equals: mail, mode: "insensitive" as const } } : {};
  if (pedido != null) {
    const o = await prisma.order.findFirst({ where: { id: pedido, ...pagado, ...conMail }, select: SELECT_PEDIDO });
    return o ? [o] : [];
  }
  if (mail) {
    return prisma.order.findMany({
      where: { ...pagado, ...conMail, items: { some: { productType: "DIGITAL" } } },
      select: SELECT_PEDIDO,
      orderBy: { createdAt: "desc" },
      take: 3,
    });
  }
  if (a.enlace?.tipo === "descarga") {
    const o = await prisma.order.findFirst({ where: { id: a.enlace.orderId, ...pagado }, select: SELECT_PEDIDO });
    return o ? [o] : [];
  }
  return [];
}

function reenviarDescarga(a: CompradorActor): BotTool {
  return defineTool({
    name: "reenviar_descarga",
    description:
      "Reenvía el mail con el enlace de descarga de compras pagadas, siempre al mail con el que se hizo la compra. Acepta el número de pedido, el mail de la compra o, sin datos, el pedido del enlace de descarga abierto.",
    kind: "read",
    input: z.strictObject({ email: email.optional(), pedido: id.optional() }),
    run: async ({ email: crudo, pedido }): Promise<ToolOutcome> => {
      const mail = crudo ? normalizeEmail(crudo) : null;
      if (pedido == null && !mail && a.enlace?.tipo !== "descarga") {
        return { ok: false, message: "Necesito el número de pedido o el mail con el que compraste." };
      }
      if (await superoTope(a, "reenviar_descarga", mail, { porIp: LIMITES_ACCIONES.reenviosPorIpHora, porMail: LIMITES_ACCIONES.reenviosPorMailHora })) {
        return { ok: true, message: "Ya te reenvié varias veces el enlace en la última hora. Esperá un rato y revisá spam; si sigue sin llegar, abro un caso." };
      }

      const pedidos = await pedidosAReenviar(a, pedido, mail);
      const verificado = a.emailVerificado ? normalizeEmail(a.emailVerificado) : null;
      const conPosesion = (o: PedidoAReenviar) =>
        o.id === pedido ||
        (a.enlace?.tipo === "descarga" && a.enlace.orderId === o.id) ||
        (verificado != null && o.buyerEmail != null && normalizeEmail(o.buyerEmail) === verificado);

      const hora = new Date().toISOString().slice(0, 13);
      let enviados = 0;
      let borradoConPosesion = false;
      for (const o of pedidos) {
        if (!albumConOriginales(o.album)) {
          if (conPosesion(o)) borradoConPosesion = true;
          continue;
        }
        const r = await reenviarDescargaDePedido(o, `dnx-bot-comprador-${o.id}-${hora}`);
        if (r.ok) enviados++;
        // El detalle del error queda en el log; al modelo nunca le llega (no debe cambiar la respuesta).
        else console.error("[bot comprador] reenvío de descarga falló", { orderId: o.id, error: r.error });
      }

      await registrarAccionComprador({
        conversationId: a.conversationId, toolName: "reenviar_descarga", email: mail, resultado: `enviados:${enviados}`,
      });
      if (borradoConPosesion) return { ok: true, message: ALBUM_BORRADO, data: { albumBorrado: true } };
      return { ok: true, message: RESPUESTA_REENVIO };
    },
  });
}

function reenviarLinkPack(a: CompradorActor): BotTool {
  return defineTool({
    name: "reenviar_link_pack",
    description:
      "Manda un enlace nuevo a los packs de preventa pagados, al mail de la compra. El enlace anterior deja de funcionar. Sin mail, usa el pedido del enlace de pack abierto.",
    kind: "read",
    input: z.strictObject({ email: email.optional() }),
    run: async ({ email: crudo }): Promise<ToolOutcome> => {
      let mail = crudo ? normalizeEmail(crudo) : null;
      let soloPedidoId: number | undefined;
      if (!mail && a.enlace?.tipo === "pack") {
        // El mail sale de la base y sólo se usa para el envío: nunca vuelve al chat.
        const o = await prisma.order.findUnique({ where: { id: a.enlace.orderId }, select: { buyerEmail: true } });
        if (o?.buyerEmail) {
          mail = normalizeEmail(o.buyerEmail);
          soloPedidoId = a.enlace.orderId;
        }
      }
      if (!mail) return { ok: false, message: "Necesito el mail con el que compraste el pack." };

      if (await superoTope(a, "reenviar_link_pack", mail, { porIp: LIMITES_ACCIONES.packPorIpHora, porMail: LIMITES_ACCIONES.packPorMailHora })) {
        return { ok: true, message: "Ya te mandé varias veces el enlace del pack en la última hora. Esperá un rato y revisá spam; si sigue sin llegar, abro un caso." };
      }

      let enviados = 0;
      try {
        const r = soloPedidoId != null ? await recuperarLinksDePack(mail, { soloPedidoId }) : await recuperarLinksDePack(mail);
        enviados = r.enviados;
      } catch (e) {
        // Sólo falla si hay packs: avisarlo revelaría que el mail compró.
        console.error("[bot comprador] recuperación de pack falló", { conversationId: a.conversationId, error: String((e as Error)?.message ?? e) });
      }
      await registrarAccionComprador({
        conversationId: a.conversationId, toolName: "reenviar_link_pack", email: mail, resultado: `enviados:${enviados}`,
      });
      return { ok: true, message: RESPUESTA_PACK };
    },
  });
}

function avisameCuandoHayaFotos(a: CompradorActor): BotTool {
  return defineTool({
    name: "avisame_cuando_haya_fotos",
    description: "Anota a la persona para avisarle por mail cuando el fotógrafo suba las fotos de un álbum.",
    kind: "read",
    input: z.strictObject({
      albumId: id,
      nombre: z.string().min(2).max(80),
      email,
      whatsapp: z.string().min(8).max(30).optional(),
    }),
    run: async ({ albumId, nombre, email: crudo, whatsapp }) => {
      // El tope va primero: agotado, no sirve para averiguar qué álbumes existen.
      const n = await contarAccionesComprador({ toolName: "avisame_cuando_haya_fotos", desde: new Date(Date.now() - UN_DIA_MS), ipHash: a.ipHash });
      if (n >= LIMITES_ACCIONES.avisosPorIpDia) return { ok: false, message: "Ya anotaste varios avisos hoy. Probá de nuevo mañana." };

      const album = await prisma.album.findFirst({
        where: { id: albumId, isTest: false, deletedAt: null },
        select: { id: true, title: true, isPublic: true, isHidden: true },
      });
      if (!album || !albumVisiblePara(a, album)) return { ok: false, message: "No encontré ese álbum." };

      const mail = normalizeEmail(crudo);
      // Sin apellido y sin WhatsApp vacío: si la persona ya estaba anotada, no se pisan sus datos.
      await guardarInteresEnAlbum({
        albumId,
        email: mail,
        name: nombre.trim(),
        ...(whatsapp ? { whatsapp: whatsapp.trim() } : {}),
        biometrico: null,
        expiresAt: new Date(Date.now() + AVISO_DURA_MS),
      });
      await registrarAccionComprador({ conversationId: a.conversationId, toolName: "avisame_cuando_haya_fotos", email: mail, resultado: "anotado", datos: { albumId } });
      return { ok: true, message: `Listo, te aviso a ${enmascararEmail(mail)} cuando haya fotos en «${album.title}».` };
    },
  });
}

/** Tope compartido de solicitudes con tarjeta (quitar foto y privacidad): cuenta propuestas de la IP en la hora. */
async function topeDeSolicitudes(a: CompradorActor): Promise<void> {
  const n = await contarAccionesComprador({
    toolName: ["solicitar_quitar_foto", "solicitud_de_privacidad"], desde: haceUnaHora(), ipHash: a.ipHash,
  });
  if (n >= LIMITES_ACCIONES.solicitudesPorIpHora) throw new AvisoAlComprador("Ya mandaste varias solicitudes en la última hora.");
}

function solicitarQuitarFoto(a: CompradorActor): BotTool {
  return defineTool({
    name: "solicitar_quitar_foto",
    description:
      "Propone pedirle al fotógrafo que quite una foto de un álbum (la persona de la foto o su representante). Lo decide el fotógrafo; requiere confirmación.",
    kind: "write",
    input: z.strictObject({
      albumId: id,
      photoId: id,
      nombre: z.string().min(2).max(120),
      email,
      telefono: z.string().min(8).max(30),
      motivo: z.string().min(10).max(1000),
    }),
    // Lanzar evita crear la tarjeta: el mensaje llega al modelo, no tiene datos internos.
    describe: async ({ albumId, photoId, email: crudo }) => {
      await topeDeSolicitudes(a);
      const foto = await prisma.photo.findUnique({
        where: { id: photoId },
        select: {
          albumId: true, isRemoved: true,
          album: { select: { id: true, title: true, isTest: true, deletedAt: true, isPublic: true, isHidden: true } },
        },
      });
      if (!foto || foto.albumId !== albumId || foto.isRemoved || foto.album.isTest || foto.album.deletedAt) {
        throw new AvisoAlComprador("No encontré esa foto en ese álbum.");
      }
      // Se acepta aunque el álbum esté oculto (la persona puede llegar a su foto por selfie),
      // pero el título sólo se muestra si la persona puede ver el álbum: los ids se pueden recorrer.
      const delAlbum = albumVisiblePara(a, foto.album) ? `del álbum «${foto.album.title}»` : "del álbum";
      return `Pedirle al fotógrafo que quite la foto #${photoId} ${delAlbum}. Lo decide el fotógrafo y no es inmediato. Te avisamos a ${enmascararEmail(crudo)}. Al confirmar declarás que sos la persona de la foto o su representante.`;
    },
    run: async ({ albumId, photoId, nombre, email: crudo, telefono, motivo }) => {
      const r = await crearSolicitudDeRemocion({
        albumId,
        photoId,
        requesterName: nombre.trim(),
        requesterEmail: normalizeEmail(crudo),
        requesterPhone: telefono.trim(),
        reason: motivo.trim(),
        declarationOk: true,
      });
      if (!r.ok) return { ok: false, message: r.error };
      if (r.duplicate) return { ok: true, message: "Ya había una solicitud tuya pendiente para esa foto." };
      return { ok: true, message: "Listo, le llegó al fotógrafo. Lo decide él; te avisamos por mail." };
    },
  });
}

function solicitudDePrivacidad(a: CompradorActor): BotTool {
  return defineTool({
    name: "solicitud_de_privacidad",
    description:
      "Propone mandar una solicitud de datos personales (ver, corregir o borrar datos, ocultar una foto, dejar de recibir publicidad o borrar los datos de la selfie). Requiere confirmación.",
    kind: "write",
    input: z.strictObject({
      tipo: z.enum(PRIVACY_REQUEST_TYPES),
      nombre: z.string().min(2).max(200),
      email,
      relacion: z.enum(PRIVACY_RELATIONSHIPS),
      descripcion: z.string().max(2000).optional(),
      albumId: id.optional(),
      photoId: id.optional(),
    }),
    describe: async ({ tipo, nombre, email: crudo }) => {
      await topeDeSolicitudes(a);
      return `Mandar una solicitud de ${TIPOS_EN_PALABRAS[tipo]} a nombre de ${nombre.trim()}. La respuesta llega a ${enmascararEmail(crudo)}. Al confirmar declarás ser el titular o su representante.`;
    },
    run: async ({ tipo, nombre, email: crudo, relacion, descripcion, albumId, photoId }) => {
      const r = await crearSolicitudDePrivacidad(
        {
          type: tipo,
          fullName: nombre.trim(),
          email: normalizeEmail(crudo),
          relationship: relacion,
          description: descripcion,
          albumId,
          photoId,
          isRepresentative: true,
        },
        { ip: `dnx-bot:${a.ipHash.slice(0, 12)}`, userAgent: "DNX Bot", sourcePage: a.pagePath ?? "" },
      );
      return { ok: true, message: `Listo, quedó la solicitud #${r.id}. Te llega la confirmación por mail.` };
    },
  });
}

/**
 * Acciones del comprador. Sin tarjeta (corren directo, con respuestas que no revelan si un mail compró):
 * pedir_codigo, verificar_codigo, reenviar_descarga, reenviar_link_pack, avisame_cuando_haya_fotos.
 * Con tarjeta («Confirmar» en el servidor): solicitar_quitar_foto, solicitud_de_privacidad.
 */
export function herramientasDeAccion(a: CompradorActor): BotTool[] {
  return [
    pedirCodigoTool(a),
    verificarCodigoTool(a),
    reenviarDescarga(a),
    reenviarLinkPack(a),
    avisameCuandoHayaFotos(a),
    solicitarQuitarFoto(a),
    solicitudDePrivacidad(a),
  ];
}
