import "server-only";
import { prisma } from "@repo/db";
import { leerConexion } from "@/lib/bandeja/conexion";
import type { ResultadoEnvio } from "@/lib/bandeja/envio";
import { enviarPlantilla, type Plantilla } from "@/lib/bandeja/plantilla-meta";
import { waIdDe } from "@/lib/bandeja/telefono";
import { entroPorElBot } from "@/lib/presupuesto-automatico/flujo";
import { resolverClaveDeEnlace, tokenDeVersion, urlDelPresupuesto } from "./enlace";
import { sitioDelWorkspace } from "./sitio";
import type { ResultadoCorreoSeguimiento } from "./seguimiento";
import type { EstadoPresupuesto } from "./constantes";
import { estadoEfectivo } from "./estados";
import {
  cualSeguimiento, DIAS_MAXIMO, DIAS_PRIMERO, marcaDe, marcaDeCorreo, sinSenalesDeVida, vaPorCorreo, type NumeroSeguimiento, MARCA_SEGUIMIENTO, nombreDePila, PLANTILLA_SEGUIMIENTO, seguirEnLaVentana, textoSeguimientoEnVentana, tipoDeEvento, ultimoSeguimiento,
} from "./seguimiento-whatsapp";

/**
 * Seguimiento de las cotizaciones de eventos sin respuesta (lo corre el cron una vez por día).
 * El 1.º sale antes, dentro de la ventana de 24 h (`cotizacionParaSeguirEnVentana`, sin plantilla); si
 * no llegó a salir, acá a los 2 días con la plantilla. El 2.º y el 3.º (días 7 y 12) van por CORREO y
 * sólo si el cliente no dio señales de vida (no la abrió, no escribió, nadie del equipo le escribió
 * ni le cargó una cita). La plantilla `seguimiento_cotizacion` de Meta (se cobra): a los 2 días
 * la ventana de 24 h sólo puede estar abierta si el cliente escribió después de recibir la
 * cotización, y en ese caso ya no corresponde insistir. Si Meta la rechaza (por ejemplo, todavía no está
 * aprobada) no se anota y se vuelve a intentar al día siguiente. Cada envío deja un mensaje del
 * sistema en el chat, que es lo que cuenta cuántos salieron.
 *
 * Consultas que armó el bot (WhatsApp o Instagram, spec 2026-11-18 §5.4): si el cliente dio un
 * teléfono válido pero no hay chat de WhatsApp con ese número (lo normal cuando llegó por Instagram),
 * el chat se crea en el momento de mandar la plantilla, para que el envío y la marca queden ahí como
 * siempre. Las consultas de la web siguen igual: sin chat de WhatsApp no hay seguimiento.
 */

const DIA_MS = 86_400_000;

type ChatSeguimiento = { id: string; estado: string; ultimoEntranteEn: Date | null };

type Candidato = {
  aprobacionId: string;
  workspaceId: string;
  leadId: string;
  presupuestoId: string;
  /** El cliente ya la abrió (estado VISTO). */
  vista: boolean;
  /** La consulta la armó el bot (origen WHATSAPP o INSTAGRAM). */
  entroPorElBot: boolean;
  waId: string;
  enviadaEn: Date;
  nombre: string | null;
  categoria: string | null;
  abierta: boolean;
  /** Lo que va después de la dirección de FOTOFFICE: `w/<slug>/presupuesto/<token>`. */
  ruta: string | null;
  chat: ChatSeguimiento | null;
  yaEnviados: number;
};

export type DepsSeguimientoWa = {
  ahora?: Date;
  /** true: no manda ni anota nada; devuelve a quién le escribiría. */
  prueba?: boolean;
  candidatos?: (ahora: Date) => Promise<Candidato[]>;
  plantilla?: (workspaceId: string, waId: string, p: Plantilla, chatId: string) => Promise<ResultadoEnvio>;
  marcar?: (workspaceId: string, chatId: string, texto: string) => Promise<void>;
  /** Busca o crea el chat de WhatsApp de ese número (consultas del bot sin chat de WhatsApp). */
  chatNuevo?: (workspaceId: string, waId: string, leadId: string, nombre: string | null, ahora: Date) => Promise<ChatSeguimiento>;
  /** ¿Alguien del equipo le escribió o le cargó algo, o la abrió, desde que le salió? */
  actividadDesde?: (c: Candidato, chatId: string) => Promise<{ vio: boolean; delEquipo: boolean }>;
  /** El correo de seguimiento (días 7 y 12). `previos`: cuántos correos ya pudo tener. */
  correo?: (workspaceId: string, presupuestoId: string, previos: number) => Promise<ResultadoCorreoSeguimiento>;
};

/** Teléfono guardado en la fila → waId como lo arma el webhook de Meta; `null` si no es un teléfono válido. */
export function waIdParaSeguimiento(guardado: string): string | null {
  const digitos = guardado.replace(/\D/g, "");
  return digitos ? waIdDe(`+${digitos}`) : null;
}

const esChoqueDeUnico = (e: unknown) => (e as { code?: unknown } | null)?.code === "P2002";

/**
 * Chat de WhatsApp para el seguimiento: el que ya hay con ese número o uno nuevo (estado BOT, sin
 * mensajes del cliente todavía, atado a la ficha de la consulta). Si otro proceso lo crea al mismo
 * tiempo, el único `workspaceId_canal_waId` choca y se usa el que quedó.
 */
export async function chatWhatsappParaSeguimiento(workspaceId: string, waId: string, leadId: string, nombre: string | null, ahora: Date): Promise<ChatSeguimiento> {
  const where = { workspaceId_canal_waId: { workspaceId, canal: "WHATSAPP", waId } };
  const select = { id: true, estado: true, ultimoEntranteEn: true } as const;
  const existente = await prisma.fotofficeWaChat.findUnique({ where, select });
  if (existente) return existente;
  const consulta = await prisma.fotofficeConsulta.findUnique({ where: { leadId }, select: { clientId: true } }).catch(() => null);
  try {
    return await prisma.fotofficeWaChat.create({
      data: { workspaceId, canal: "WHATSAPP", waId, nombre, clientId: consulta?.clientId ?? null, estado: "BOT", ultimoMensajeEn: ahora, ultimoEntranteEn: null },
      select,
    });
  } catch (e) {
    if (!esChoqueDeUnico(e)) throw e;
    const otro = await prisma.fotofficeWaChat.findUnique({ where, select });
    if (!otro) throw e;
    return otro;
  }
}

async function candidatosDeLaBase(ahora: Date): Promise<Candidato[]> {
  const aprobaciones = await prisma.fotofficePresupuestoAprobacion.findMany({
    where: { status: "ENVIADO", waId: { not: null }, presupuestoId: { not: null }, sentAt: { gte: new Date(ahora.getTime() - (DIAS_MAXIMO + 1) * DIA_MS), lte: new Date(ahora.getTime() - DIAS_PRIMERO * DIA_MS) } },
    select: { id: true, workspaceId: true, waId: true, presupuestoId: true, leadId: true, categoryId: true, origin: true, sentAt: true },
    take: 200,
  });
  const clave = resolverClaveDeEnlace();
  const salida: Candidato[] = [];
  for (const a of aprobaciones) {
    if (!a.waId || !a.presupuestoId || !a.sentAt) continue;
    const [presupuesto, lead, categoria, branding, chat] = await Promise.all([
      prisma.fotofficePresupuesto.findUnique({ where: { id: a.presupuestoId }, select: { status: true, validUntil: true, currentVersionId: true, acceptedVersionId: true } }),
      prisma.serviceSalesLead.findUnique({ where: { id: a.leadId }, select: { name: true } }).catch(() => null),
      a.categoryId ? prisma.fotofficeConsultaCategoria.findUnique({ where: { id: a.categoryId }, select: { name: true } }).catch(() => null) : null,
      prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: a.workspaceId }, select: { publicSlug: true } }),
      prisma.fotofficeWaChat.findFirst({ where: { workspaceId: a.workspaceId, canal: "WHATSAPP", waId: a.waId }, select: { id: true, estado: true, ultimoEntranteEn: true } }),
    ]);
    if (!presupuesto) continue;
    const estado = estadoEfectivo(presupuesto.status as EstadoPresupuesto, presupuesto.validUntil, ahora);
    const yaEnviados = chat
      ? ultimoSeguimiento(
          (await prisma.fotofficeWaMensaje.findMany({ where: { chatId: chat.id, direccion: "SISTEMA", texto: { startsWith: MARCA_SEGUIMIENTO }, createdAt: { gte: a.sentAt } }, select: { texto: true }, take: 10 })).map((m) => m.texto),
        )
      : 0;
    const ruta = clave && presupuesto.currentVersionId && branding?.publicSlug
      ? `w/${encodeURIComponent(branding.publicSlug)}/presupuesto/${encodeURIComponent(tokenDeVersion(presupuesto.currentVersionId, clave))}`
      : null;
    salida.push({
      aprobacionId: a.id, workspaceId: a.workspaceId, leadId: a.leadId, presupuestoId: a.presupuestoId, vista: estado === "VISTO", entroPorElBot: entroPorElBot(a.origin), waId: a.waId, enviadaEn: a.sentAt, nombre: lead?.name ?? null, categoria: categoria?.name ?? null,
      abierta: (estado === "ENVIADO" || estado === "VISTO") && !presupuesto.acceptedVersionId, ruta, chat, yaEnviados,
    });
  }
  return salida;
}

const POR_OMISION: Required<Omit<DepsSeguimientoWa, "ahora" | "prueba">> = {
  candidatos: candidatosDeLaBase,
  plantilla: async (workspaceId, waId, p, chatId) => {
    const conexion = await leerConexion(workspaceId);
    const r = await enviarPlantilla(conexion, waId, p);
    const ahora = new Date();
    await prisma.fotofficeWaMensaje
      .create({
        data: {
          workspaceId, chatId, direccion: "SALIENTE", autor: "BOT", autorLabel: "Seguimiento de cotización", tipo: "PLANTILLA",
          texto: `Plantilla «${p.nombre}» (${p.cuerpo.join(" · ")})`, estadoEnvio: r.ok ? (r.simulado ? "SIMULADO" : "ENVIADO") : "FALLO",
          waMessageId: r.ok && !r.simulado ? r.waMessageId : null, errorCodigo: r.ok ? null : r.codigo, createdAt: ahora,
        },
      })
      .catch((e) => console.warn("[fotoffice][seguimiento] no se pudo guardar la plantilla en el chat", { codigo: e instanceof Error ? e.name : "desconocido" }));
    return r;
  },
  chatNuevo: chatWhatsappParaSeguimiento,
  actividadDesde: async (c, chatId) => {
    const desde = c.enviadaEn;
    const [vistas, mensajes, citas, desdeElChat] = await Promise.all([
      prisma.fotofficePresupuestoVista.count({ where: { workspaceId: c.workspaceId, version: { presupuestoId: c.presupuestoId }, viewedAt: { gte: desde } } }),
      prisma.fotofficeMessage.count({ where: { workspaceId: c.workspaceId, entityType: "CONSULTA", entityId: c.leadId, automatic: false, createdAt: { gte: desde } } }),
      prisma.fotofficeCita.count({ where: { workspaceId: c.workspaceId, consultaLeadId: c.leadId, createdAt: { gte: desde } } }),
      prisma.fotofficeWaMensaje.count({ where: { chatId, autor: { in: ["USUARIO", "CELULAR"] }, createdAt: { gte: desde } } }),
    ]);
    return { vio: c.vista || vistas > 0, delEquipo: mensajes + citas + desdeElChat > 0 };
  },
  correo: async (workspaceId, presupuestoId, previos) => {
    const { enviarCorreoDeSeguimiento } = await import("./seguimiento");
    return enviarCorreoDeSeguimiento(workspaceId, presupuestoId, previos);
  },
  marcar: async (workspaceId, chatId, texto) => {
    const { escribirSistema } = await import("@/lib/bandeja/acciones");
    await prisma.$transaction((tx) => escribirSistema(tx, workspaceId, chatId, texto, new Date()));
  },
};

export async function seguirCotizacionesPorWhatsapp(deps: DepsSeguimientoWa = {}) {
  const d = { ...POR_OMISION, ...deps };
  const ahora = deps.ahora ?? new Date();
  const prueba: { aprobacionId: string; numero: NumeroSeguimiento }[] = [];
  let revisadas = 0;
  let enviadas = 0;
  let fallidas = 0;
  for (const c of await d.candidatos(ahora)) {
    revisadas++;
    try {
      if (!c.ruta) continue;
      // Sin chat de WhatsApp: la web sigue como siempre (no hay seguimiento); la consulta del bot
      // con un teléfono válido lo va a tener nuevo (sin mensajes del cliente, lo atiende el bot).
      const waIdNuevo = !c.chat && c.entroPorElBot ? waIdParaSeguimiento(c.waId) : null;
      if (!c.chat && !waIdNuevo) continue;
      const decidir = (chat: { estado: string; ultimoEntranteEn: Date | null }) =>
        cualSeguimiento({
          enviadaEn: c.enviadaEn, ahora, yaEnviados: c.yaEnviados, abierta: c.abierta,
          respondioDespues: chat.ultimoEntranteEn !== null && chat.ultimoEntranteEn.getTime() > c.enviadaEn.getTime(),
          atiendePersona: chat.estado === "HUMANO",
        });
      let numero = decidir(c.chat ?? { estado: "BOT", ultimoEntranteEn: null });
      if (!numero) continue;
      if (deps.prueba) {
        prueba.push({ aprobacionId: c.aprobacionId, numero });
        continue;
      }
      let chat = c.chat;
      let destino = c.waId;
      if (!chat && waIdNuevo) {
        chat = await d.chatNuevo(c.workspaceId, waIdNuevo, c.leadId, c.nombre, ahora);
        destino = waIdNuevo;
        // Si el chat ya existía (otro proceso lo creó recién), se vuelve a decidir con su estado real.
        numero = decidir(chat);
        if (!numero) continue;
      }
      if (!chat) continue;
      if (vaPorCorreo(numero)) {
        // Días 7 y 12: por correo y sólo si no dio señales de vida (nunca otra plantilla de WhatsApp).
        const act = await d.actividadDesde(c, chat.id);
        if (!sinSenalesDeVida({ vio: act.vio, delEquipo: act.delEquipo, respondio: false, atiendePersona: false })) continue;
        const r = await d.correo(c.workspaceId, c.presupuestoId, numero - 2);
        if (r === "SALTEADO") continue;
        if (r === "FALLO") {
          fallidas++;
          continue;
        }
        await d.marcar(c.workspaceId, chat.id, marcaDeCorreo(numero));
        enviadas++;
        continue;
      }
      const ok = (await d.plantilla(c.workspaceId, destino, { ...PLANTILLA_SEGUIMIENTO, cuerpo: [nombreDePila(c.nombre) || "¡hola", tipoDeEvento(c.categoria)], boton: c.ruta }, chat.id)).ok;
      if (!ok) {
        fallidas++;
        continue;
      }
      await d.marcar(c.workspaceId, chat.id, marcaDe(numero));
      enviadas++;
    } catch (e) {
      fallidas++;
      console.warn("[fotoffice][seguimiento] falló un seguimiento por WhatsApp", { codigo: e instanceof Error ? e.name : "desconocido" });
    }
  }
  return deps.prueba ? { revisadas, enviadas, fallidas, prueba } : { revisadas, enviadas, fallidas };
}

/**
 * Seguimiento dentro de la ventana de 24 h (lo llama el cron del recordatorio de pago, cada 15 minutos,
 * cuando ya es la hora: ver `tocaRecordar`). Busca la última cotización que le salió a este chat de
 * WhatsApp después del último mensaje del cliente; si sigue abierta, sin seguimientos y salió hace al
 * menos 12 h, devuelve el texto (con el enlace) y la marca del seguimiento 1, que también cuenta para
 * que la plantilla de los 2 días no se repita. null si no corresponde.
 */
export async function cotizacionParaSeguirEnVentana(
  workspaceId: string,
  chatId: string,
  ultimoEntranteEn: Date,
  ahora: Date,
): Promise<{ texto: string; marca: string } | null> {
  const chat = await prisma.fotofficeWaChat.findUnique({ where: { id: chatId }, select: { waId: true, canal: true } });
  if (!chat || chat.canal !== "WHATSAPP" || !chat.waId) return null;
  const a = await prisma.fotofficePresupuestoAprobacion.findFirst({
    where: { workspaceId, status: "ENVIADO", waId: chat.waId, presupuestoId: { not: null }, sentAt: { gt: ultimoEntranteEn } },
    orderBy: { sentAt: "desc" },
    select: { presupuestoId: true, leadId: true, categoryId: true, sentAt: true },
  });
  if (!a?.presupuestoId || !a.sentAt) return null;
  const [presupuesto, lead, categoria, marcas] = await Promise.all([
    prisma.fotofficePresupuesto.findUnique({ where: { id: a.presupuestoId }, select: { status: true, validUntil: true, currentVersionId: true, acceptedVersionId: true } }),
    prisma.serviceSalesLead.findUnique({ where: { id: a.leadId }, select: { name: true } }).catch(() => null),
    a.categoryId ? prisma.fotofficeConsultaCategoria.findUnique({ where: { id: a.categoryId }, select: { name: true } }).catch(() => null) : null,
    prisma.fotofficeWaMensaje.findMany({ where: { chatId, direccion: "SISTEMA", texto: { startsWith: MARCA_SEGUIMIENTO }, createdAt: { gte: a.sentAt } }, select: { texto: true }, take: 10 }),
  ]);
  if (!presupuesto?.currentVersionId) return null;
  const estado = estadoEfectivo(presupuesto.status as EstadoPresupuesto, presupuesto.validUntil, ahora);
  const abierta = (estado === "ENVIADO" || estado === "VISTO") && !presupuesto.acceptedVersionId;
  if (!seguirEnLaVentana({ ultimoEntranteEn, enviadaEn: a.sentAt, ahora, yaEnviados: ultimoSeguimiento(marcas.map((m) => m.texto)), abierta })) return null;
  const clave = resolverClaveDeEnlace();
  const sitio = await sitioDelWorkspace(workspaceId);
  const origen = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
  const enlace = clave && sitio ? urlDelPresupuesto({ ...sitio, appOrigin: origen, token: tokenDeVersion(presupuesto.currentVersionId, clave) }) : null;
  if (!enlace) return null;
  return { texto: textoSeguimientoEnVentana(lead?.name ?? null, categoria?.name ?? null, enlace), marca: marcaDe(1) };
}
