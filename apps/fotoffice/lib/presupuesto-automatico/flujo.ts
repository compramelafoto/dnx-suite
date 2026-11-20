import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { estadoInstagramDe, estadoWhatsappDe, enviarAvisoAlChat, enviarAvisoPorWhatsapp } from "@/lib/bandeja/aviso-sistema";
import { waIdDe } from "@/lib/bandeja/telefono";
import { numeroDe } from "@/lib/numeracion/asignar";
import { correoValido } from "@/lib/plantillas/contexto";
import type { CostosVersion } from "@/lib/presupuestos/costos";
import { enviarPresupuestoDelSistema, ddmmaaaa } from "@/lib/presupuestos/envio";
import { asegurarPlantillasPresupuesto } from "@/lib/presupuestos/plantillas";
import { armarBorradorParaAprobar, type DepsPropuestaAutomatica } from "@/lib/presupuestos/propuesta-automatica";
import { leerPropuestaModelo, plantillaDePropuesta } from "@/lib/presupuestos/propuestas-modelo";
import { itemsGuardados, type TotalesGuardados } from "@/lib/presupuestos/versiones";
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { alternativaPrincipal, alternativasGuardadas, itemsDeAlternativa, type CostosConAlternativas } from "@/lib/presupuestos/alternativas";
import { TIPO_CONSULTA } from "@/lib/service-leads/numero";
import { editarMensaje, type TecladoTelegram } from "@/lib/telegram/api";
import { avisarPorTelegram, type ResultadoAvisoTelegram } from "@/lib/telegram/conexion";
import { leerTokenTelegram } from "@/lib/integrations/telegram/credentials";
import { apruebaPorTelegram } from "./ajustes";
import {
  algunoSalio,
  decidirCanales,
  textoDeCanales,
  textoWhatsappDelPresupuesto,
  type ResultadoCanales,
  type ResultadoCorreo,
  type ResultadoInstagram,
  type ResultadoWhatsapp,
} from "./canales";
import { leerAjustesPorHoras, leerPorHorasDeConsulta } from "./por-horas";
import { porHorasAplica } from "./por-horas-puro";
import { armarResumen, lineasDePrecio, type DatosResumen, type EstadoDelAviso, type PresupuestoDelResumen } from "./resumen";

/**
 * El presupuesto automático con aprobación por Telegram (spec 2026-10-25 §2).
 *
 * `alLlegarConsulta`: consulta nueva de una categoría con "Aprobar por Telegram" → borrador con la
 * propuesta modelo → fila `FotofficePresupuestoAprobacion` (una por consulta: el único frena un
 * segundo aviso) → aviso por Telegram con el resumen y los botones.
 *
 * `aprobarYEnviar`: el botón (o FOTOFFICE). Reclama la fila con un `updateMany` de AVISADO o
 * AVISO_FALLIDO a ENVIANDO: si dos toques llegan juntos, sólo uno gana y el otro contesta "ya está
 * enviado". Después envía por correo y/o WhatsApp (`decidirCanales`), deja los canales en la fila y
 * cambia el mensaje de Telegram. Si no se llegó a congelar nada, la fila vuelve a AVISADO (se puede
 * reintentar sin riesgo de un segundo envío).
 *
 * Nunca lanza y nunca loguea datos personales: sólo códigos.
 *
 * Instagram (spec 2026-11-18 §5.7): la consulta que arma el bot en un mensaje directo entra con
 * origen INSTAGRAM, que el flujo trata como WHATSAPP (`entroPorElBot`). La fila guarda el teléfono
 * que dio el cliente (`waId`, para los seguimientos) y el chat de Instagram (`igChatId`), por donde
 * sale la cotización si la ventana de 24 h sigue abierta.
 */

export type OrigenConsulta = "WEB" | "WHATSAPP" | "INSTAGRAM";

/** ¿La consulta la armó el bot (WhatsApp o Instagram)? Ahí rige el presupuesto por horas. */
export const entroPorElBot = (o: OrigenConsulta | string | null | undefined): boolean => o === "WHATSAPP" || o === "INSTAGRAM";

/** El origen guardado en la fila, leído de vuelta (lo desconocido es WEB). */
export const origenDeFila = (o: string | null | undefined): OrigenConsulta => (o === "WHATSAPP" || o === "INSTAGRAM" ? o : "WEB");
export const ESTADOS_APROBABLES = ["AVISADO", "AVISO_FALLIDO"] as const;

export type DepsFlujo = DepsPropuestaAutomatica & {
  armar?: typeof armarBorradorParaAprobar;
  avisar?: (workspaceId: string, html: string, teclado: TecladoTelegram | null) => Promise<ResultadoAvisoTelegram>;
  editar?: (workspaceId: string, chatId: string, messageId: string, html: string, teclado: TecladoTelegram | null) => Promise<void>;
  enviarPresupuesto?: typeof enviarPresupuestoDelSistema;
  estadoWhatsapp?: typeof estadoWhatsappDe;
  enviarWhatsapp?: typeof enviarAvisoPorWhatsapp;
  /** ¿Instagram conectado y la ventana de ese chat abierta? */
  estadoInstagram?: typeof estadoInstagramDe;
  /** El aviso por el chat de Instagram (la cotización aprobada). */
  enviarInstagram?: typeof enviarAvisoAlChat;
  /** Dirección de FOTOFFICE para los botones (undefined: la del entorno). */
  origenApp?: string;
};

function registrar(donde: string, e: unknown): void {
  const codigo = (e as { code?: unknown } | null)?.code;
  if (codigo === "P2021") console.warn(`[presupuesto-automatico] ${donde}: falta aplicar el SQL`);
  else console.error(`[presupuesto-automatico] ${donde} falló`, { codigo: typeof codigo === "string" ? codigo : null });
}

const ahoraDe = (deps: DepsFlujo) => (deps.ahora ?? (() => new Date()))();

async function editarPorOmision(workspaceId: string, chatId: string, messageId: string, html: string, teclado: TecladoTelegram | null): Promise<void> {
  const token = await leerTokenTelegram(workspaceId);
  if (token) await editarMensaje(token, chatId, messageId, html, teclado);
}

// --- Al llegar la consulta ------------------------------------------------------------------------

export type ResultadoAlLlegar = "AVISADO" | "AVISO_FALLIDO" | "SIN_PROPUESTA" | "APAGADO" | "YA_AVISADO" | "ERROR";

/** ¿La consulta va por la aprobación por Telegram? (para que el alta no mande la propuesta sola). */
export async function consultaVaPorTelegram(workspaceId: string, leadId: string): Promise<boolean> {
  try {
    const ficha = await prisma.fotofficeConsulta.findFirst({ where: { workspaceId, leadId }, select: { categoryId: true } });
    return ficha ? await apruebaPorTelegram(workspaceId, ficha.categoryId) : false;
  } catch {
    return false;
  }
}

/** Por qué no hay presupuesto, según el resultado del armado (o el código guardado en la fila). */
function motivoDe(codigo: string | null | undefined): NonNullable<DatosResumen["motivoSinPresupuesto"]> {
  if (!codigo || codigo === "SIN_PROPUESTA" || codigo === "NO_APLICA") return "SIN_PROPUESTA";
  if (codigo === "SIN_HORAS") return "SIN_HORAS";
  if (codigo === "SIN_PERFIL") return "SIN_PERFIL";
  return "NO_SE_PUDO_ARMAR";
}

export async function alLlegarConsulta(
  workspaceId: string,
  leadId: string,
  origen: OrigenConsulta,
  extra: { waId?: string | null; igChatId?: string | null } = {},
  deps: DepsFlujo = {},
): Promise<ResultadoAlLlegar> {
  try {
    const ficha = await prisma.fotofficeConsulta.findFirst({ where: { workspaceId, leadId }, select: { categoryId: true } });
    // Por el bot (WhatsApp o Instagram) con el presupuesto por horas encendido, toda consulta pasa
    // por la aprobación (la que tiene propuesta modelo la usa aunque su interruptor esté apagado). Spec 2026-10-28 §9.
    const porWhatsapp = entroPorElBot(origen) && ficha?.categoryId ? porHorasAplica(await leerAjustesPorHoras(workspaceId), ficha.categoryId) : false;
    if (!ficha || !(porWhatsapp || (await apruebaPorTelegram(workspaceId, ficha.categoryId)))) return "APAGADO";

    // La fila primero: el único (workspace + consulta) frena un segundo aviso de la misma consulta.
    let filaId: string;
    try {
      const f = await prisma.fotofficePresupuestoAprobacion.create({
        data: { workspaceId, leadId, categoryId: ficha.categoryId, origin: origen, waId: extra.waId ?? null, igChatId: extra.igChatId ?? null, status: "AVISO_FALLIDO" },
        select: { id: true },
      });
      filaId = f.id;
    } catch (e) {
      if ((e as { code?: unknown } | null)?.code === "P2002") return "YA_AVISADO";
      throw e;
    }

    const armado = await (deps.armar ?? armarBorradorParaAprobar)(workspaceId, leadId, deps);
    const presupuestoId = armado.presupuestoId;
    if (presupuestoId) {
      await prisma.fotofficePresupuestoAprobacion.update({ where: { id: filaId }, data: { presupuestoId }, select: { id: true } });
    }
    const datos = await datosDelResumen(workspaceId, filaId, deps);
    if (!datos) return "ERROR";
    if (!presupuestoId) datos.motivoSinPresupuesto = motivoDe(armado.resultado);

    const { html, teclado } = armarResumen(datos);
    const aviso = await (deps.avisar ?? avisarPorTelegram)(workspaceId, html, teclado);
    const status = !presupuestoId ? "SIN_PROPUESTA" : aviso.ok ? "AVISADO" : "AVISO_FALLIDO";
    await prisma.fotofficePresupuestoAprobacion.update({
      where: { id: filaId },
      data: {
        status,
        errorCode: aviso.ok ? (presupuestoId ? null : armado.resultado) : `TELEGRAM_${aviso.codigo}`,
        ...(aviso.ok ? { telegramChatId: aviso.chatId, telegramMessageId: aviso.messageId } : {}),
      },
      select: { id: true },
    });
    if (!aviso.ok) console.warn("[presupuesto-automatico] no se pudo avisar por Telegram", { codigo: aviso.codigo });
    if (!presupuestoId) return "SIN_PROPUESTA";
    return aviso.ok ? "AVISADO" : "AVISO_FALLIDO";
  } catch (e) {
    registrar("alLlegarConsulta", e);
    return "ERROR";
  }
}

// --- El resumen -----------------------------------------------------------------------------------

/** Lo que hace falta para el aviso, leído de la base. null si la fila no existe. */
export async function datosDelResumen(workspaceId: string, aprobacionId: string, deps: DepsFlujo = {}): Promise<DatosResumen | null> {
  const a = await prisma.fotofficePresupuestoAprobacion.findFirst({
    where: { id: aprobacionId, workspaceId },
    select: { id: true, leadId: true, presupuestoId: true, categoryId: true, origin: true, status: true, errorCode: true },
  });
  if (!a) return null;
  const [lead, consulta, categoria, numeros] = await Promise.all([
    prisma.serviceSalesLead.findFirst({
      where: { id: a.leadId, workspaceId },
      select: { name: true, email: true, phone: true, message: true, eventDate: true, eventLocation: true },
    }),
    prisma.fotofficeConsulta.findFirst({ where: { workspaceId, leadId: a.leadId }, select: { eventStartsAt: true, venue: true, city: true, guests: true } }),
    a.categoryId ? prisma.fotofficeConsultaCategoria.findFirst({ where: { id: a.categoryId, workspaceId }, select: { name: true } }) : Promise.resolve(null),
    numeroDe(workspaceId, TIPO_CONSULTA, [a.leadId]).catch(() => new Map<string, string>()),
  ]);
  const origenApp = (deps.origenApp ?? appUrl()).replace(/\/+$/, "");
  const fecha = consulta?.eventStartsAt ?? lead?.eventDate ?? null;
  return {
    aprobacionId: a.id,
    origen: origenDeFila(a.origin),
    numeroConsulta: numeros.get(a.leadId) ?? null,
    cliente: lead?.name ?? "Sin nombre",
    email: lead?.email ?? null,
    telefono: lead?.phone ?? null,
    categoria: categoria?.name ?? null,
    fechaEvento: ddmmaaaa(fecha),
    lugar: [consulta?.venue ?? lead?.eventLocation ?? null, consulta?.city ?? null].filter((x): x is string => !!x && x.trim() !== "").join(", ") || null,
    invitados: consulta?.guests ?? null,
    mensaje: lead?.message ?? null,
    presupuesto: a.presupuestoId ? await presupuestoDelResumen(workspaceId, a.presupuestoId) : null,
    motivoSinPresupuesto: a.presupuestoId ? null : motivoDe(a.errorCode),
    porHoras: await leerPorHorasDeConsulta(workspaceId, a.leadId).catch(() => null),
    urlPresupuesto: origenApp && a.presupuestoId ? `${origenApp}/presupuestos/${encodeURIComponent(a.presupuestoId)}` : null,
    urlConsulta: origenApp ? `${origenApp}/consultas/${encodeURIComponent(a.leadId)}` : null,
  };
}

/** Ítems, total, costo, horas y margen de la versión a enviar (el borrador o, si no hay, la vigente). */
export async function presupuestoDelResumen(workspaceId: string, presupuestoId: string): Promise<PresupuestoDelResumen | null> {
  const p = await prisma.fotofficePresupuesto.findFirst({ where: { id: presupuestoId, workspaceId }, select: { currentVersionId: true } });
  if (!p) return null;
  const v =
    (await prisma.fotofficePresupuestoVersion.findFirst({
      where: { workspaceId, presupuestoId, sentAt: null },
      select: { items: true, totals: true, costSnapshot: true },
    })) ??
    (p.currentVersionId
      ? await prisma.fotofficePresupuestoVersion.findFirst({
          where: { id: p.currentVersionId, workspaceId, presupuestoId },
          select: { items: true, totals: true, costSnapshot: true },
        })
      : null);
  if (!v) return null;
  return resumenDeVersion(v);
}

/**
 * PURO. De una versión guardada a lo que muestra el aviso. Con opciones (Básico, Premium…), además
 * cada opción con su precio, su costo y su margen (`alternativas`); lo de arriba es la principal.
 */
export function resumenDeVersion(v: { items: unknown; totals: unknown; costSnapshot: unknown }): PresupuestoDelResumen {
  const items = itemsGuardados(v.items);
  const alternativas = alternativasGuardadas(v.totals);
  if (alternativas.length === 0) return resumenDeItems(items, v.totals, v.costSnapshot);
  const costos = (v.costSnapshot as CostosConAlternativas | null) ?? null;
  const renglones = (v.totals as TotalesGuardados | null)?.renglones ?? {};
  const principal = alternativaPrincipal(alternativas)!;
  const porOpcion = alternativas.map((a) => ({
    nombre: a.nombre,
    masElegida: a.masElegida,
    ...resumenDeItems(itemsDeAlternativa(items, a.id), { ...a.totales, renglones }, costos?.alternativas?.[a.id] ?? null),
  }));
  const dePrincipal = porOpcion[alternativas.indexOf(principal)]!;
  return { ...dePrincipal, alternativas: porOpcion };
}

function resumenDeItems(items: ItemPresupuesto[], totals: unknown, costSnapshot: unknown): PresupuestoDelResumen {
  const totales = (totals as TotalesGuardados | null) ?? null;
  const costos = (costSnapshot as CostosVersion | null) ?? null;
  const suman = items.filter((i) => !i.opcional).length;
  let horas = 0;
  let hayHoras = false;
  for (const i of items) {
    if (!i.opcional && i.calculo && Number.isFinite(i.calculo.horasTotales)) {
      horas += i.calculo.horasTotales;
      hayHoras = true;
    }
  }
  const sinCosto = costos?.itemsSinCosto ?? suman;
  const costoConocido = costos !== null && sinCosto < suman;
  return {
    items: items.map((i) => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      neto: totales?.renglones?.[i.id]?.neto ?? i.precioUnitario * i.cantidad,
      opcional: i.opcional,
      horas: i.calculo?.horasTotales ?? null,
    })),
    total: totales?.total ?? 0,
    costo: costoConocido ? costos.costoTotal : null,
    margen: costoConocido ? costos.margen : null,
    margenProporcion: costoConocido ? costos.margenProporcion : null,
    horas: hayHoras ? horas : null,
    itemsSinCosto: costos ? sinCosto : 0,
  };
}

// --- Aprobar y enviar -----------------------------------------------------------------------------

export type ViaAprobacion = { tipo: "TELEGRAM" } | { tipo: "PANEL"; userId: number };

export type ResultadoAprobar =
  | { ok: true; canales: ResultadoCanales; texto: string }
  | { ok: false; codigo: "NO_EXISTE" | "YA_ENVIADO" | "EN_CURSO" | "SIN_PRESUPUESTO" | "SIN_CANAL" | "NO_SALIO" | "ARCHIVADO" | "ERROR"; texto: string };

export const TEXTOS_APROBAR = {
  NO_EXISTE: "No encontramos esa cotización.",
  YA_ENVIADO: "Esta cotización ya se envió. No se manda de nuevo.",
  EN_CURSO: "Ya se está enviando.",
  SIN_PRESUPUESTO: "Esta consulta no tiene cotización armada: abrila y respondé a mano.",
  SIN_CANAL: "No dejó correo y no se le puede escribir por WhatsApp: cargale un correo en la consulta y volvé a aprobar.",
  NO_SALIO: "No se pudo enviar. Revisalo en FOTOFFICE y volvé a aprobar.",
  ARCHIVADO: "Esta cotización se archivó (la descartaron o tenía más de 14 días): no se manda.",
  ERROR: "Algo falló. Probá de nuevo en un rato.",
} as const;

const falla = (codigo: Exclude<ResultadoAprobar, { ok: true }>["codigo"], texto: string = TEXTOS_APROBAR[codigo]): ResultadoAprobar => ({ ok: false, codigo, texto });

/** Sin borrador, y al cliente ya le llegó algo después del envío desde FOTOFFICE. */
export const TEXTO_YA_LE_LLEGO =
  "Esta cotización ya se envió desde FOTOFFICE y el cliente ya recibió un mensaje o un correo después. No se manda de nuevo.";
/** Sin borrador y sin nada que le haya llegado: el bot manda la versión vigente (la corregida). */
export const PREFIJO_VERSION_CORREGIDA = "Se mandó la versión corregida.";

/** Sin canal: por qué no sale por ninguno, y qué hacer. */
function textoSinCanal(decision: ReturnType<typeof decidirCanales>): string {
  const canales: ResultadoCanales = {
    correo: "SIN_CORREO",
    whatsapp: decision.motivoSinWhatsapp ?? "FALLO",
    ...(decision.motivoSinInstagram ? { instagram: decision.motivoSinInstagram } : {}),
  };
  return `No se pudo enviar. ${textoDeCanales(canales).replace(/^No salió por ningún canal\. /, "")} Cargale un correo en la consulta (o esperá a que vuelva a escribir) y volvé a aprobar.`;
}

/** Los mensajes de WhatsApp o Instagram que no le llegaron al cliente (o que no salieron de verdad). */
const SALIENTE_SIN_LLEGAR = ["FALLO", "SIMULADO"];

/**
 * ¿Le llegó algo al cliente desde `desde` (el envío de la versión vigente)? Un correo registrado
 * a la consulta, o un mensaje saliente en su chat de WhatsApp (o Instagram) que no falló: escrito
 * por una persona (desde la Bandeja o el celular) o del bot con el enlace de una cotización. El
 * "Enviar por WhatsApp" del panel sólo abre un enlace (`OPENED_WHATSAPP`): eso no cuenta.
 */
export async function alClienteLeLlegoAlgo(
  workspaceId: string,
  leadId: string,
  chats: { waId: string | null; igChatId: string | null },
  desde: Date,
): Promise<boolean> {
  const correo = await prisma.fotofficeMessage.findFirst({
    where: { workspaceId, channel: "EMAIL", entityType: "CONSULTA", entityId: leadId, status: "SENT", createdAt: { gte: desde } },
    select: { id: true },
  });
  if (correo) return true;
  const ids: string[] = [];
  if (chats.waId) {
    const chat = await prisma.fotofficeWaChat.findFirst({ where: { workspaceId, canal: "WHATSAPP", waId: chats.waId }, select: { id: true } });
    if (chat) ids.push(chat.id);
  }
  if (chats.igChatId) ids.push(chats.igChatId);
  if (ids.length === 0) return false;
  const saliente = await prisma.fotofficeWaMensaje.findFirst({
    where: {
      workspaceId,
      chatId: { in: ids },
      direccion: "SALIENTE",
      estadoEnvio: { notIn: SALIENTE_SIN_LLEGAR },
      createdAt: { gte: desde },
      OR: [{ autor: { in: ["USUARIO", "CELULAR"] } }, { texto: { contains: "/presupuesto/" } }],
    },
    select: { id: true },
  });
  return saliente !== null;
}

/** La plantilla con la que sale el correo: la de la propuesta modelo o la primera de Presupuesto. */
async function plantillaDelEnvio(workspaceId: string, categoriaId: string | null): Promise<string | null> {
  if (categoriaId) {
    const propuesta = await leerPropuestaModelo(workspaceId, categoriaId);
    const propia = propuesta?.plantillaId ? await plantillaDePropuesta(workspaceId, propuesta.plantillaId) : null;
    if (propia) return propia.id;
  }
  const buscar = () =>
    prisma.fotofficeMessageTemplate.findFirst({
      where: { workspaceId, channel: "EMAIL", entityType: "PRESUPUESTO", systemKey: null, archivedAt: null },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
  let p = await buscar();
  if (!p) {
    await asegurarPlantillasPresupuesto(workspaceId).catch(() => undefined);
    p = await buscar();
  }
  return p?.id ?? null;
}

export async function aprobarYEnviar(
  workspaceId: string,
  aprobacionId: string,
  via: ViaAprobacion,
  deps: DepsFlujo & { alReclamar?: () => Promise<void> } = {},
): Promise<ResultadoAprobar> {
  const ahora = ahoraDe(deps);
  let reclamada = false;
  try {
    const r = await prisma.fotofficePresupuestoAprobacion.updateMany({
      where: { id: aprobacionId, workspaceId, status: { in: [...ESTADOS_APROBABLES] }, presupuestoId: { not: null } },
      data: {
        status: "ENVIANDO",
        approvedAt: ahora,
        approvedVia: via.tipo,
        approvedByUserId: via.tipo === "PANEL" ? via.userId : null,
        errorCode: null,
      },
    });
    if (r.count !== 1) {
      const actual = await prisma.fotofficePresupuestoAprobacion.findFirst({ where: { id: aprobacionId, workspaceId }, select: { status: true } });
      if (!actual) return falla("NO_EXISTE");
      if (actual.status === "ENVIADO") return falla("YA_ENVIADO");
      if (actual.status === "ENVIANDO") return falla("EN_CURSO");
      if (actual.status === "SIN_PROPUESTA") return falla("SIN_PRESUPUESTO");
      if (actual.status === "ARCHIVADO") return falla("ARCHIVADO");
      return falla("ERROR");
    }
    reclamada = true;
    if (deps.alReclamar) await deps.alReclamar().catch(() => undefined);

    const a = await prisma.fotofficePresupuestoAprobacion.findFirst({
      where: { id: aprobacionId, workspaceId },
      select: { leadId: true, presupuestoId: true, categoryId: true, waId: true, igChatId: true, telegramChatId: true, telegramMessageId: true },
    });
    if (!a?.presupuestoId) return await volverAAvisado(workspaceId, aprobacionId, "SIN_PRESUPUESTO");

    const [lead, presupuesto, categoria, branding] = await Promise.all([
      prisma.serviceSalesLead.findFirst({ where: { id: a.leadId, workspaceId }, select: { name: true, email: true, phone: true } }),
      prisma.fotofficePresupuesto.findFirst({ where: { id: a.presupuestoId, workspaceId }, select: { status: true, currentVersionId: true } }),
      a.categoryId ? prisma.fotofficeConsultaCategoria.findFirst({ where: { id: a.categoryId, workspaceId }, select: { name: true } }) : Promise.resolve(null),
      prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { commercialName: true } }).catch(() => null),
    ]);
    if (!presupuesto) return await volverAAvisado(workspaceId, aprobacionId, "SIN_PRESUPUESTO");
    const borrador = await prisma.fotofficePresupuestoVersion.findFirst({ where: { workspaceId, presupuestoId: a.presupuestoId, sentAt: null }, select: { id: true } });
    const waId = a.waId ?? waIdDe(lead?.phone ?? null);
    // Sin borrador: la corrigieron y la "enviaron" desde FOTOFFICE. Con WhatsApp el panel sólo abre
    // un enlace que alguien tiene que mandar: si después de eso no le llegó nada al cliente, sale
    // la versión vigente por acá (como un reenvío). Si le llegó algo, no se manda de nuevo.
    let reenvio = false;
    if (!borrador) {
      const vigente = presupuesto.currentVersionId
        ? await prisma.fotofficePresupuestoVersion.findFirst({
            where: { id: presupuesto.currentVersionId, workspaceId, presupuestoId: a.presupuestoId },
            select: { sentAt: true },
          })
        : null;
      if (!vigente?.sentAt || (await alClienteLeLlegoAlgo(workspaceId, a.leadId, { waId, igChatId: a.igChatId }, vigente.sentAt))) {
        await terminar(workspaceId, aprobacionId, { status: "ENVIADO", errorCode: "ENVIADO_A_MANO", sentAt: ahora });
        return falla("YA_ENVIADO", TEXTO_YA_LE_LLEGO);
      }
      reenvio = true;
    }

    const wa = await (deps.estadoWhatsapp ?? estadoWhatsappDe)(workspaceId, waId, ahora);
    const instagram = a.igChatId ? { chatId: a.igChatId, ...(await (deps.estadoInstagram ?? estadoInstagramDe)(workspaceId, a.igChatId, ahora)) } : undefined;
    const decision = decidirCanales({
      correoValido: correoValido(lead?.email ?? null),
      waId,
      whatsappConectado: wa.conectado,
      ventanaAbierta: wa.ventanaAbierta,
      ...(instagram ? { instagram } : {}),
    });
    if (!decision.correo && !decision.whatsapp && !decision.instagram) {
      return await volverAAvisado(workspaceId, aprobacionId, "SIN_CANAL", "SIN_CANAL", textoSinCanal(decision));
    }

    const plantillaId = await plantillaDelEnvio(workspaceId, a.categoryId);
    if (!plantillaId) return await volverAAvisado(workspaceId, aprobacionId, "NO_SALIO", "SIN_PLANTILLA");

    const enviar = deps.enviarPresupuesto ?? enviarPresupuestoDelSistema;
    const envio = await enviar(workspaceId, a.presupuestoId, plantillaId, deps, {
      ...(decision.correo ? {} : { sinCorreo: true }),
      ...(reenvio ? { reenviar: true } : {}),
    });
    // Otro envío de la misma cotización recién salió (doble toque o el panel): no se manda dos veces.
    if (envio.ok && envio.repetido) return await volverAAvisado(workspaceId, aprobacionId, "NO_SALIO", "REPETIDO");
    let correo: ResultadoCorreo = decision.correo ? "FALLO" : "SIN_CORREO";
    let enlace: string | null = null;
    if (envio.ok) {
      enlace = envio.enlace;
      if (decision.correo) correo = "ENVIADO";
    } else if (envio.enviado) {
      enlace = envio.enlace ?? null;
    } else {
      // No se congeló nada: se puede volver a aprobar sin riesgo de un segundo envío.
      console.warn("[presupuesto-automatico] el presupuesto no se pudo enviar", { codigo: "NO_ENVIADO" });
      return await volverAAvisado(workspaceId, aprobacionId, "NO_SALIO", "NO_ENVIADO", reenvio ? `No se pudo enviar: ${envio.error}` : undefined);
    }

    const textoAlCliente = enlace
      ? textoWhatsappDelPresupuesto({ nombre: lead?.name ?? null, categoria: categoria?.name ?? null, enlace, estudio: branding?.commercialName ?? null })
      : null;
    let whatsapp: ResultadoWhatsapp = decision.motivoSinWhatsapp ?? "FALLO";
    if (decision.whatsapp && waId && textoAlCliente) {
      const s = await (deps.enviarWhatsapp ?? enviarAvisoPorWhatsapp)(workspaceId, waId, textoAlCliente, { ahora });
      whatsapp = s === "ENVIADO" ? "ENVIADO" : s === "VENTANA_CERRADA" ? "VENTANA_CERRADA" : s === "SIN_CONEXION" ? "SIN_CONEXION" : "FALLO";
    }
    let instagramSalida: ResultadoInstagram | undefined;
    if (a.igChatId) {
      instagramSalida = decision.motivoSinInstagram ?? "FALLO";
      if (decision.instagram && textoAlCliente) {
        const s = await (deps.enviarInstagram ?? enviarAvisoAlChat)(workspaceId, a.igChatId, textoAlCliente, { ahora });
        // Sin conexión de Instagram también es FALLO: el chat existe, pero no hay por dónde mandarlo.
        instagramSalida = s === "ENVIADO" ? "ENVIADO" : s === "VENTANA_CERRADA" ? "VENTANA_CERRADA" : "FALLO";
      }
    }
    const canales: ResultadoCanales = instagramSalida ? { correo, whatsapp, instagram: instagramSalida } : { correo, whatsapp };
    if (reenvio && !algunoSalio(canales)) {
      // El reenvío no congela nada: si no salió por ningún canal, se puede volver a aprobar.
      return await volverAAvisado(workspaceId, aprobacionId, "NO_SALIO", "NINGUN_CANAL", `No se pudo enviar. ${textoDeCanales(canales).replace(/^No salió por ningún canal\. /, "")}`);
    }
    await terminar(workspaceId, aprobacionId, {
      status: "ENVIADO",
      channels: canales as unknown as Prisma.InputJsonValue,
      errorCode: algunoSalio(canales) ? null : "NINGUN_CANAL",
      sentAt: ahora,
    });
    await actualizarAviso(workspaceId, aprobacionId, a, { tipo: "ENVIADO", canales, via: via.tipo }, deps);
    return { ok: true, canales, texto: reenvio ? `${PREFIJO_VERSION_CORREGIDA} ${textoDeCanales(canales)}` : textoDeCanales(canales) };
  } catch (e) {
    registrar("aprobarYEnviar", e);
    // Si se reclamó y algo lanzó, queda FALLO para revisar a mano (pudo haber salido): nunca se reintenta solo.
    if (reclamada) await terminar(workspaceId, aprobacionId, { status: "FALLO", errorCode: "ERROR_INTERNO" }).catch(() => undefined);
    return falla("ERROR");
  }
}

async function terminar(workspaceId: string, id: string, data: Prisma.FotofficePresupuestoAprobacionUpdateManyMutationInput): Promise<void> {
  await prisma.fotofficePresupuestoAprobacion.updateMany({ where: { id, workspaceId }, data });
}

/** Nada salió: la fila vuelve a "avisado" para poder aprobar de nuevo. */
async function volverAAvisado(
  workspaceId: string,
  id: string,
  codigo: "SIN_PRESUPUESTO" | "SIN_CANAL" | "NO_SALIO",
  errorCode: string = codigo,
  texto?: string,
): Promise<ResultadoAprobar> {
  await terminar(workspaceId, id, { status: "AVISADO", errorCode, approvedAt: null, approvedVia: null, approvedByUserId: null });
  return falla(codigo, texto);
}

/** Cambia el mensaje de Telegram (si hay) para que muestre cómo terminó. Nunca lanza. */
async function actualizarAviso(
  workspaceId: string,
  aprobacionId: string,
  a: { telegramChatId: string | null; telegramMessageId: string | null },
  estado: EstadoDelAviso,
  deps: DepsFlujo,
): Promise<void> {
  if (!a.telegramChatId || !a.telegramMessageId) return;
  try {
    const datos = await datosDelResumen(workspaceId, aprobacionId, deps);
    if (!datos) return;
    const { html, teclado } = armarResumen(datos, estado);
    await (deps.editar ?? editarPorOmision)(workspaceId, a.telegramChatId, a.telegramMessageId, html, teclado);
  } catch {
    // El aviso es un extra: lo que importa ya quedó en la fila.
  }
}

// --- Para la pantalla y el bot --------------------------------------------------------------------

export type PendienteDeAprobar = {
  id: string;
  leadId: string;
  presupuestoId: string | null;
  cliente: string;
  categoria: string | null;
  origen: OrigenConsulta;
  status: string;
  errorCode: string | null;
  creada: Date;
  /**
   * Precio, costo y margen del presupuesto a aprobar: una línea por opción (o una sola). Sólo para
   * los que esperan aprobación; la pantalla es de `configurar` (ve costos). [] si no hay.
   */
  precios: string[];
};

/** Las que esperan aprobación (o no se pudieron avisar). Vacío si falta la tabla. */
export async function pendientesDeAprobar(workspaceId: string): Promise<PendienteDeAprobar[]> {
  try {
    const filas = await prisma.fotofficePresupuestoAprobacion.findMany({
      where: { workspaceId, status: { in: [...ESTADOS_APROBABLES, "SIN_PROPUESTA", "FALLO", "ENVIANDO"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, leadId: true, presupuestoId: true, categoryId: true, origin: true, status: true, errorCode: true, createdAt: true },
    });
    if (filas.length === 0) return [];
    const [leads, categorias] = await Promise.all([
      prisma.serviceSalesLead.findMany({ where: { workspaceId, id: { in: filas.map((f) => f.leadId) } }, select: { id: true, name: true } }),
      prisma.fotofficeConsultaCategoria.findMany({
        where: { workspaceId, id: { in: filas.map((f) => f.categoryId).filter((x): x is string => !!x) } },
        select: { id: true, name: true },
      }),
    ]);
    const nombre = new Map(leads.map((l) => [l.id, l.name]));
    const cat = new Map(categorias.map((c) => [c.id, c.name]));
    const aprobables = new Set<string>(ESTADOS_APROBABLES);
    const precios = new Map<string, string[]>();
    await Promise.all(
      filas
        .filter((f) => f.presupuestoId && aprobables.has(f.status))
        .map(async (f) => {
          const r = await presupuestoDelResumen(workspaceId, f.presupuestoId!).catch(() => null);
          if (r) precios.set(f.id, lineasDePrecio(r));
        }),
    );
    return filas.map((f) => ({
      id: f.id,
      leadId: f.leadId,
      presupuestoId: f.presupuestoId,
      cliente: nombre.get(f.leadId) ?? "Sin nombre",
      categoria: f.categoryId ? cat.get(f.categoryId) ?? null : null,
      origen: origenDeFila(f.origin),
      status: f.status,
      errorCode: f.errorCode,
      creada: f.createdAt,
      precios: precios.get(f.id) ?? [],
    }));
  } catch (e) {
    registrar("pendientesDeAprobar", e);
    return [];
  }
}

/** ¿Hay un presupuesto en preparación para ese número de WhatsApp? (el bot no vuelve a cotizar). */
/** Una consulta sin respuesta más vieja que esto ya no frena otra del mismo número. */
export const DIAS_EN_PREPARACION = 7;
/** Motivos con los que una consulta del mismo número no frena otra. */
const NO_FRENAN = ["SIN_HORAS", "FALLO"] as const;

/** La condición de "hay una cotización en preparación" para ese número (exportada para probarla). */
export function condicionEnPreparacion(workspaceId: string, waId: string, ahora: Date) {
  return { ...condicionPendiente(workspaceId, ahora), waId } satisfies Prisma.FotofficePresupuestoAprobacionWhereInput;
}

/** Lo mismo sin el número: lo comparten WhatsApp (por teléfono) e Instagram (por chat). */
function condicionPendiente(workspaceId: string, ahora: Date) {
  return {
    workspaceId,
    status: { in: [...ESTADOS_APROBABLES, "SIN_PROPUESTA", "ENVIANDO"] },
    createdAt: { gte: new Date(ahora.getTime() - DIAS_EN_PREPARACION * 86_400_000) },
    // OJO: `NOT { errorCode: { in } }` en Postgres descarta las filas con errorCode NULL (que son
    // justamente las normales): el bot no veía la cotización pendiente y armaba otra por cada
    // mensaje del cliente. El NULL va explícito.
    OR: [{ errorCode: null }, { errorCode: { notIn: [...NO_FRENAN] } }],
  } satisfies Prisma.FotofficePresupuestoAprobacionWhereInput;
}

/**
 * Lo mismo para un chat de Instagram: se mira por el chat (`igChatId`), no por el teléfono (el
 * cliente pudo no darlo, y el IGSID no es un teléfono).
 */
export function condicionEnPreparacionInstagram(workspaceId: string, igChatId: string, ahora: Date) {
  return { ...condicionPendiente(workspaceId, ahora), igChatId } satisfies Prisma.FotofficePresupuestoAprobacionWhereInput;
}

export async function enPreparacionParaInstagram(workspaceId: string, igChatId: string, ahora: Date = new Date()): Promise<boolean> {
  try {
    const f = await prisma.fotofficePresupuestoAprobacion.findFirst({ where: condicionEnPreparacionInstagram(workspaceId, igChatId, ahora), select: { id: true } });
    return f !== null;
  } catch {
    return false;
  }
}

export async function enPreparacionParaWhatsapp(workspaceId: string, waId: string, ahora: Date = new Date()): Promise<boolean> {
  try {
    const f = await prisma.fotofficePresupuestoAprobacion.findFirst({
      // No frenan otra consulta del mismo número: la que no tenía horas (el cliente puede decirlas
      // después), la que falló y la que quedó sin aprobar más de DIAS_EN_PREPARACION días.
      where: condicionEnPreparacion(workspaceId, waId, ahora),
      select: { id: true },
    });
    return f !== null;
  } catch {
    return false;
  }
}
