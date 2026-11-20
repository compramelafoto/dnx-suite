import "server-only";
import { prisma } from "@repo/db";
import type { Canal } from "@/lib/bandeja/constantes";
import { waIdDe } from "@/lib/bandeja/telefono";
import { altaDelSistema, altaDeConsulta } from "@/lib/consultas/alta";
import { origenInstagram } from "@/lib/consultas/origen-instagram";
import { leerAcuse } from "./ajustes";
import { asegurarCategoriaEvento } from "./categoria-evento";
import { guardarPorHorasDeConsulta, leerAjustesPorHoras } from "./por-horas";
import { horasValidas, porHorasAplica } from "./por-horas-puro";
import { alLlegarConsulta, condicionEnPreparacionInstagram, enviarPaqueteEstandar, enPreparacionParaInstagram, enPreparacionParaWhatsapp, type DepsFlujo } from "./flujo";
import { coincidenciasDelTipo, fechaDelBot } from "./whatsapp-puro";

/**
 * La consulta que entra por el bot de WhatsApp (herramienta `preparar_presupuesto`, spec
 * 2026-10-25 §2): con lo que juntó el bot se da de alta la consulta (como el sistema), se ata el
 * chat al contacto y corre el mismo recorrido que la consulta web (borrador + Telegram). El bot
 * recibe el texto del acuse para decírselo al cliente. Un segundo pedido del mismo número mientras
 * hay uno en preparación no crea nada. Nunca lanza.
 *
 * Desde un chat de Instagram (spec 2026-11-18 §5.4): el `waId` del chat es el IGSID, nunca un
 * teléfono. El teléfono es el WhatsApp que dio el cliente (`datos.whatsapp`, Argentina; sin
 * característica no sirve). La consulta entra con el origen «Instagram» y el mensaje
 * "Por Instagram (@usuario): …", y la aprobación queda atada al chat (`igChatId`). Sin un
 * WhatsApp que sirva se carga igual (sin teléfono, con correo si lo dio) y el bot pasa a persona.
 */

export type ChatDelBot = {
  id: string;
  waId: string;
  clientId: string | null;
  nombre: string | null;
  /** Por omisión, WHATSAPP. */
  canal?: Canal;
  usuarioInstagram?: string | null;
};

export type DatosDelBot = {
  tipo: string;
  nombre: string;
  /** "aaaa-mm-dd" */
  fecha?: string | null;
  lugar?: string | null;
  invitados?: number | null;
  /** Horas de cobertura (presupuesto por horas). */
  horas?: number | null;
  email?: string | null;
  detalle?: string | null;
  /** Sólo en Instagram: el WhatsApp que dio el cliente, como lo escribió. */
  whatsapp?: string | null;
};

export type ResultadoDelBot = { ok: boolean; message: string };

export async function prepararDesdeWhatsapp(
  workspaceId: string,
  chat: ChatDelBot,
  datos: DatosDelBot,
  deps: DepsFlujo = {},
  /**
   * XV y bodas (spec 2026-11-20): el paquete estándar que eligió el cliente. La categoría ya la
   * sabe la herramienta y la cotización sale sola, sin Telegram (`enviarPaqueteEstandar`).
   */
  opciones: { paquete?: { categoriaId: string; categoria: string; nombre: string } } = {},
): Promise<ResultadoDelBot> {
  try {
    const esInstagram = chat.canal === "INSTAGRAM";
    // En Instagram el teléfono es el que dio el cliente (inválido o ausente: sin teléfono).
    const telefono = esInstagram ? waIdDe(datos.whatsapp ?? null) : chat.waId;
    if (esInstagram ? await enPreparacionParaInstagram(workspaceId, chat.id) : await enPreparacionParaWhatsapp(workspaceId, chat.waId)) {
      if (esInstagram && telefono && (await completarTelefono(workspaceId, chat, telefono))) {
        return { ok: true, message: "Listo, anoté su WhatsApp. Ya hay una cotización en preparación: decile que en un rato se la mandamos; no le des precios." };
      }
      return { ok: true, message: "Ya hay una cotización en preparación para este cliente. Decile que en un rato se la mandamos; no le des precios." };
    }
    let categoria: { id: string; name: string };
    if (opciones.paquete) {
      categoria = { id: opciones.paquete.categoriaId, name: opciones.paquete.categoria };
    } else {
      const c = await categoriaDelBot(workspaceId, datos);
      if (!c.ok) return { ok: false, message: c.message };
      categoria = c.categoria;
    }

    const fecha = fechaDelBot(datos.fecha);
    const quien = chat.usuarioInstagram ? ` (@${chat.usuarioInstagram})` : "";
    // Si la ficha del chat ya tenía otro teléfono no se pisa: el que dio queda anotado en la consulta.
    const otroTelefono = esInstagram && chat.clientId && telefono ? await anotarEnLaFicha(workspaceId, chat.clientId, telefono) : null;
    const nota = otroTelefono ? ` (WhatsApp que dio: +${otroTelefono})` : "";
    const alta = await altaDeConsulta(
      altaDelSistema(workspaceId),
      {
        contacto: chat.clientId
          ? { clientId: chat.clientId }
          : { nombre: datos.nombre, telefono: telefono ? `+${telefono}` : null, email: datos.email ?? null },
        categoriaId: categoria.id,
        eventDate: fecha,
        eventLocation: datos.lugar ?? null,
        message: esInstagram
          ? `${datos.detalle ? `Por Instagram${quien}: ${datos.detalle}` : `Consulta por Instagram${quien}.`}${nota}`
          : datos.detalle
            ? `Por WhatsApp: ${datos.detalle}`
            : "Consulta por WhatsApp.",
        evento: { startsAt: fecha, horaConocida: false, venue: datos.lugar ?? null, guests: datos.invitados ?? null },
        ...(esInstagram ? { origenId: await origenInstagram(prisma, workspaceId) } : {}),
      },
      { origenDelAlta: "MANUAL" },
    );
    if (!alta.ok) {
      console.warn("[presupuesto-automatico] el bot no pudo dar de alta la consulta", { codigo: "ALTA_FALLIDA" });
      return { ok: false, message: "No pude registrar la consulta. Usá pasar_a_persona con un resumen de lo que pide." };
    }
    if (!chat.clientId && alta.clientId) {
      await prisma.fotofficeWaChat.updateMany({ where: { id: chat.id, workspaceId, clientId: null }, data: { clientId: alta.clientId } }).catch(() => undefined);
    }
    const horas = horasValidas(datos.horas);
    if (horas !== null) await guardarPorHorasDeConsulta(workspaceId, alta.leadId, { horas });
    if (opciones.paquete) {
      const r = await enviarPaqueteEstandar(
        workspaceId,
        alta.leadId,
        esInstagram ? "INSTAGRAM" : "WHATSAPP",
        esInstagram ? { waId: telefono, igChatId: chat.id } : { waId: chat.waId },
        opciones.paquete.nombre,
        deps,
      );
      return r.ok
        ? { ok: true, message: `Listo: la cotización${opciones.paquete.nombre ? ` del paquete ${opciones.paquete.nombre}` : ""} ya le salió al cliente (${r.texto}); desde ese enlace puede reservar la fecha. Decile que ahí la tiene, sin hablar de botones. No digas otros precios.` }
        : { ok: false, message: "La consulta quedó registrada, pero la cotización no se pudo enviar sola. Decile que en un rato se la mandamos y usá pasar_a_persona con el motivo \"cotización del paquete sin enviar\"." };
    }
    const llegada = esInstagram
      ? await alLlegarConsulta(workspaceId, alta.leadId, "INSTAGRAM", { waId: telefono, igChatId: chat.id }, deps)
      : await alLlegarConsulta(workspaceId, alta.leadId, "WHATSAPP", { waId: chat.waId }, deps);
    // Ningún recorrido toma la consulta: no se le promete un presupuesto que nadie va a armar.
    if (llegada === "APAGADO" || llegada === "ERROR") {
      return { ok: false, message: "La consulta quedó registrada, pero la cotización la arma una persona. Usá pasar_a_persona con un resumen de lo que pide." };
    }
    if (esInstagram && !telefono) {
      return {
        ok: true,
        message: datos.whatsapp?.trim()
          ? "La consulta quedó registrada, pero el WhatsApp que pasó no sirve: le falta la característica (por ejemplo 341). Pedíselo con la característica y volvé a usar preparar_presupuesto con ese whatsapp. Si no quiere darlo, decile que la cotización se la mandamos por acá y usá pasar_a_persona con un resumen corto de lo que pide. No le des precios."
          : "La consulta quedó registrada sin WhatsApp. Decile al cliente que la cotización se la mandamos por acá (y por correo si lo dio) y usá pasar_a_persona con un resumen corto de lo que pide. No le des precios.",
      };
    }
    const acuse = await leerAcuse(workspaceId);
    return {
      ok: true,
      message: acuse.encendido
        ? `Listo, el estudio ya está armando la cotización. Decile al cliente esto, con tus palabras si hace falta: "${acuse.texto}". No le des precios ni plazos.`
        : "Listo, el estudio ya está armando la cotización. Agradecele y decile que en breve le escribimos. No le des precios ni plazos.",
    };
  } catch {
    console.error("[presupuesto-automatico] falló preparar_presupuesto", { codigo: "INTERNO" });
    return { ok: false, message: "No pude registrar la consulta. Usá pasar_a_persona con un resumen de lo que pide." };
  }
}

/** La categoría de la consulta según el tipo que dijo el bot (con el presupuesto por horas, "Evento" si ninguna coincide). */
async function categoriaDelBot(workspaceId: string, datos: DatosDelBot): Promise<{ ok: true; categoria: { id: string; name: string } } | { ok: false; message: string }> {
  // Presupuesto por horas (spec 2026-10-28): cualquier categoría activa; si ninguna coincide, "Evento".
  const ajustesPorHoras = await leerAjustesPorHoras(workspaceId);
  const porHoras = ajustesPorHoras.encendido;
  const encendidas = porHoras
    ? null
    : await prisma.fotofficePresupuestoAutoCategoria.findMany({ where: { workspaceId, telegramEnabled: true }, select: { categoryId: true }, take: 100 });
  const categorias =
    encendidas === null || encendidas.length
      ? await prisma.fotofficeConsultaCategoria.findMany({
          where: { workspaceId, archivedAt: null, ...(encendidas ? { id: { in: encendidas.map((e) => e.categoryId) } } : {}) },
          select: { id: true, name: true },
          take: 200,
        })
      : [];
  if (categorias.length === 0 && !porHoras) {
    return { ok: false as const, message: "El estudio todavía no arma cotizaciones automáticas. Usá pasar_a_persona con un resumen de lo que pide." };
  }
  const coincidencias = coincidenciasDelTipo(categorias, datos.tipo);
  if (porHoras && coincidencias.length > 1) {
    return {
      ok: false,
      message: `"${datos.tipo}" puede ser: ${coincidencias.map((c) => c.name).join(", ")}. Preguntale al cliente cuál es y volvé a usar la herramienta con ese nombre.`,
    };
  }
  const categoria =
    (coincidencias.length === 1 ? coincidencias[0] : null) ?? (porHoras ? { id: await asegurarCategoriaEvento(workspaceId), name: "Evento" } : null);
  // Categorías que no son coberturas (glitter, 360°, video clip…): las atiende una persona.
  if (categoria && porHoras && !porHorasAplica(ajustesPorHoras, categoria.id)) {
    const conInterruptor = await prisma.fotofficePresupuestoAutoCategoria.findFirst({ where: { workspaceId, categoryId: categoria.id, telegramEnabled: true }, select: { id: true } });
    if (!conInterruptor) {
      return { ok: false as const, message: `"${categoria.name}" no se cotiza sola: la arma una persona del estudio. Usá pasar_a_persona con un resumen de lo que pide.` };
    }
  }
  if (!categoria) {
    return {
      ok: false,
      message: `No sé a qué tipo corresponde "${datos.tipo}". Los tipos con cotización automática son: ${categorias.map((c) => c.name).join(", ")}. Si es uno de esos, volvé a usar la herramienta con ese nombre; si no, usá pasar_a_persona.`,
    };
  }
  return { ok: true, categoria };
}

/**
 * La ficha del chat sin teléfono recibe el WhatsApp que dio el cliente. Si ya tenía otro, no se pisa
 * y se devuelve el que dio (para anotarlo en la consulta); si no, null. Nunca lanza.
 */
async function anotarEnLaFicha(workspaceId: string, clientId: string, telefono: string): Promise<string | null> {
  try {
    const c = await prisma.client.findFirst({ where: { id: clientId, workspaceId }, select: { phone: true } });
    if (!c) return null;
    if (!c.phone?.trim()) {
      await prisma.client.updateMany({ where: { id: clientId, workspaceId }, data: { phone: `+${telefono}` } });
      return null;
    }
    return waIdDe(c.phone) === telefono ? null : telefono;
  } catch {
    return null;
  }
}

/**
 * Ya hay una cotización en preparación para ese chat de Instagram, cargada sin teléfono, y ahora el
 * cliente dio un WhatsApp que sirve: se completa en la aprobación (seguimientos), en la consulta y
 * en la ficha, sin pisar lo que ya hubiera. true si completó algo. Nunca lanza.
 */
async function completarTelefono(workspaceId: string, chat: ChatDelBot, telefono: string): Promise<boolean> {
  try {
    const fila = await prisma.fotofficePresupuestoAprobacion.findFirst({
      where: { ...condicionEnPreparacionInstagram(workspaceId, chat.id, new Date()), waId: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, leadId: true },
    });
    if (!fila) return false;
    await prisma.fotofficePresupuestoAprobacion.updateMany({ where: { id: fila.id, workspaceId, waId: null }, data: { waId: telefono } });
    const otroEnLaFicha = chat.clientId ? await anotarEnLaFicha(workspaceId, chat.clientId, telefono) : null;
    const lead = await prisma.serviceSalesLead.findFirst({ where: { id: fila.leadId, workspaceId }, select: { phone: true, message: true } });
    if (lead) {
      const sinTelefono = !lead.phone?.trim();
      // Si la consulta (o la ficha) ya tenía otro teléfono, no se pisa: el que dio queda anotado.
      const nota = ` (WhatsApp que dio: +${telefono})`;
      const anotar = (otroEnLaFicha !== null || (!sinTelefono && waIdDe(lead.phone) !== telefono)) && !(lead.message ?? "").includes(nota);
      if (sinTelefono || anotar) {
        await prisma.serviceSalesLead.updateMany({
          where: { id: fila.leadId, workspaceId },
          data: { ...(sinTelefono ? { phone: `+${telefono}` } : {}), ...(anotar ? { message: `${lead.message ?? ""}${nota}`.trim() } : {}) },
        });
      }
    }
    return true;
  } catch {
    return false;
  }
}

