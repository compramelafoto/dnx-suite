import "server-only";
import { prisma } from "@repo/db";
import { altaDelSistema, altaDeConsulta } from "@/lib/consultas/alta";
import { leerAcuse } from "./ajustes";
import { asegurarCategoriaEvento } from "./categoria-evento";
import { guardarPorHorasDeConsulta, leerAjustesPorHoras } from "./por-horas";
import { horasValidas, porHorasAplica } from "./por-horas-puro";
import { alLlegarConsulta, enPreparacionParaWhatsapp, type DepsFlujo } from "./flujo";
import { coincidenciasDelTipo, fechaDelBot } from "./whatsapp-puro";

/**
 * La consulta que entra por el bot de WhatsApp (herramienta `preparar_presupuesto`, spec
 * 2026-10-25 §2): con lo que juntó el bot se da de alta la consulta (como el sistema), se ata el
 * chat al contacto y corre el mismo recorrido que la consulta web (borrador + Telegram). El bot
 * recibe el texto del acuse para decírselo al cliente. Un segundo pedido del mismo número mientras
 * hay uno en preparación no crea nada. Nunca lanza.
 */

export type ChatDelBot = { id: string; waId: string; clientId: string | null; nombre: string | null };

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
};

export type ResultadoDelBot = { ok: boolean; message: string };

export async function prepararDesdeWhatsapp(
  workspaceId: string,
  chat: ChatDelBot,
  datos: DatosDelBot,
  deps: DepsFlujo = {},
): Promise<ResultadoDelBot> {
  try {
    if (await enPreparacionParaWhatsapp(workspaceId, chat.waId)) {
      return { ok: true, message: "Ya hay un presupuesto en preparación para este cliente. Decile que en un rato se lo mandamos; no le des precios." };
    }
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
      return { ok: false, message: "El estudio todavía no arma presupuestos automáticos. Usá pasar_a_persona con un resumen de lo que pide." };
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
        return { ok: false, message: `"${categoria.name}" no se presupuesta sola: lo arma una persona del estudio. Usá pasar_a_persona con un resumen de lo que pide.` };
      }
    }
    if (!categoria) {
      return {
        ok: false,
        message: `No sé a qué tipo corresponde "${datos.tipo}". Los tipos con presupuesto automático son: ${categorias.map((c) => c.name).join(", ")}. Si es uno de esos, volvé a usar la herramienta con ese nombre; si no, usá pasar_a_persona.`,
      };
    }

    const fecha = fechaDelBot(datos.fecha);
    const alta = await altaDeConsulta(
      altaDelSistema(workspaceId),
      {
        contacto: chat.clientId ? { clientId: chat.clientId } : { nombre: datos.nombre, telefono: `+${chat.waId}`, email: datos.email ?? null },
        categoriaId: categoria.id,
        eventDate: fecha,
        eventLocation: datos.lugar ?? null,
        message: datos.detalle ? `Por WhatsApp: ${datos.detalle}` : "Consulta por WhatsApp.",
        evento: { startsAt: fecha, horaConocida: false, venue: datos.lugar ?? null, guests: datos.invitados ?? null },
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
    const llegada = await alLlegarConsulta(workspaceId, alta.leadId, "WHATSAPP", { waId: chat.waId }, deps);
    // Ningún recorrido toma la consulta: no se le promete un presupuesto que nadie va a armar.
    if (llegada === "APAGADO" || llegada === "ERROR") {
      return { ok: false, message: "La consulta quedó registrada, pero el presupuesto lo arma una persona. Usá pasar_a_persona con un resumen de lo que pide." };
    }
    const acuse = await leerAcuse(workspaceId);
    return {
      ok: true,
      message: acuse.encendido
        ? `Listo, el estudio ya está armando el presupuesto. Decile al cliente esto, con tus palabras si hace falta: "${acuse.texto}". No le des precios ni plazos.`
        : "Listo, el estudio ya está armando el presupuesto. Agradecele y decile que en breve le escribimos. No le des precios ni plazos.",
    };
  } catch {
    console.error("[presupuesto-automatico] falló preparar_presupuesto", { codigo: "INTERNO" });
    return { ok: false, message: "No pude registrar la consulta. Usá pasar_a_persona con un resumen de lo que pide." };
  }
}
