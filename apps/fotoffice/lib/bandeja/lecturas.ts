import "server-only";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { clientDisplayName } from "@/lib/clients/display";
import { soloDigitos } from "@/lib/clients/match";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { puedeOperarBandeja, puedeVerBandeja, type CtxBandeja } from "./acceso";
import type { Autor, Direccion, EstadoDelChat, TipoMensaje } from "./constantes";
import { atiendeElBot, estadoVisible, puedeResponderLibre } from "./reglas";
import { textoDeVistaPrevia } from "./vista-previa";

/**
 * Lecturas de la Bandeja de WhatsApp (servidor): la lista de chats, el detalle de uno y el total de
 * no leídos. Todas reciben el contexto armado desde la sesión y devuelven `null` sin permiso de
 * "Ver" en el módulo. Todo se busca con el `workspaceId` del contexto. Nunca loguean textos ni
 * teléfonos y nunca devuelven la columna `media` ni el `clientToken` de los mensajes.
 */

export const FILTROS_BANDEJA = ["todos", "bot", "mios", "sin-asignar", "resueltos"] as const;
export type FiltroBandeja = (typeof FILTROS_BANDEJA)[number];

export const ETIQUETA_FILTRO: Record<FiltroBandeja, string> = {
  todos: "Todos",
  bot: "Atiende el bot",
  mios: "Míos",
  "sin-asignar": "Sin asignar",
  resueltos: "Resueltos",
};

export const MAXIMO_CHATS = 200;
export const MAXIMO_MENSAJES = 200;
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const CLAVE_CONSULTAS = SERVICE_LEADS_MODULE_KEY;
const CLAVE_PRESUPUESTOS = "quotes";

export type ChatDeLista = {
  id: string;
  /** Nombre del cliente vinculado, o el del perfil de WhatsApp, o el número. */
  titulo: string;
  waId: string;
  estado: EstadoDelChat;
  /** Lo atiende el bot ahora (incluye la pausa vencida de un chat sin asignar). */
  atiendeElBot: boolean;
  asignadoNombre: string | null;
  clienteNombre: string | null;
  ultimoMensaje: string | null;
  ultimoMensajeEn: Date;
  noLeidos: number;
};

async function nombresDeUsuarios(ids: number[]): Promise<Map<number, string>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const filas = (await prisma.user.findMany({ where: { id: { in: unicos } }, select: { id: true, name: true, email: true } })) as {
    id: number;
    name: string | null;
    email: string | null;
  }[];
  return new Map(filas.map((u) => [u.id, etiquetaDeUsuario(u)]));
}

const COLUMNAS_CLIENTE = { id: true, kind: true, firstName: true, lastName: true, businessName: true } as const;
type FilaCliente = { id: string; kind: string; firstName: string | null; lastName: string | null; businessName: string | null };

async function clientesPorId(workspaceId: string, ids: string[]): Promise<Map<string, FilaCliente>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const filas = (await prisma.client.findMany({ where: { workspaceId, id: { in: unicos } }, select: COLUMNAS_CLIENTE })) as FilaCliente[];
  return new Map(filas.map((c) => [c.id, c]));
}

/** El `where` de cada filtro. "Atiende el bot" sigue la misma regla que `atiendeElBot`. */
function dondeDelFiltro(filtro: FiltroBandeja, userId: number, ahora: Date): Record<string, unknown> {
  switch (filtro) {
    case "bot":
      return { OR: [{ estado: "BOT" }, { estado: "HUMANO", asignadoUserId: null, botPausadoHasta: { lte: ahora } }] };
    case "mios":
      return { asignadoUserId: userId, estado: { not: "RESUELTO" } };
    case "sin-asignar":
      return { asignadoUserId: null, estado: { not: "RESUELTO" } };
    case "resueltos":
      return { estado: "RESUELTO" };
    default:
      // "Todos" es todo menos lo resuelto; lo resuelto se ve en su filtro.
      return { estado: { not: "RESUELTO" } };
  }
}

/**
 * Lista de chats del workspace, los más recientes primero (máximo 200). `q` busca por nombre del
 * perfil, número o nombre del cliente vinculado. Sin permiso de "Ver": `null`.
 */
export async function listarChats(
  ctx: CtxBandeja,
  opciones: { filtro?: FiltroBandeja; q?: string; ahora?: Date } = {},
): Promise<ChatDeLista[] | null> {
  if (!puedeVerBandeja(ctx) || ctx.userId === null) return null;
  const ahora = opciones.ahora ?? new Date();
  const filtro = (FILTROS_BANDEJA as readonly string[]).includes(opciones.filtro ?? "") ? (opciones.filtro as FiltroBandeja) : "todos";
  const condiciones: Record<string, unknown>[] = [{ workspaceId: ctx.workspaceId }, dondeDelFiltro(filtro, ctx.userId, ahora)];

  // Sin permiso de Clientes la búsqueda no entra a la ficha: sólo perfil de WhatsApp y número.
  const veClientes = puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY);
  const q = (opciones.q ?? "").trim().slice(0, 80);
  if (q) {
    const digitos = soloDigitos(q);
    const porNombre = !veClientes ? [] : ((await prisma.client.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { businessName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 50,
    })) as { id: string }[]);
    const o: Record<string, unknown>[] = [{ nombre: { contains: q, mode: "insensitive" } }];
    if (digitos.length >= 3) o.push({ waId: { contains: digitos } });
    if (porNombre.length > 0) o.push({ clientId: { in: porNombre.map((c) => c.id) } });
    condiciones.push({ OR: o });
  }

  const chats = (await prisma.fotofficeWaChat.findMany({
    where: { AND: condiciones },
    orderBy: { ultimoMensajeEn: "desc" },
    take: MAXIMO_CHATS,
  })) as {
    id: string; waId: string; nombre: string | null; clientId: string | null; estado: string; asignadoUserId: number | null;
    botPausadoHasta: Date | null; ultimoMensajeEn: Date; ultimoEntranteEn: Date | null; noLeidos: number;
    ultimoMensajeTexto: string | null; ultimoMensajeTipo: string | null;
  }[];

  const [usuarios, clientes] = await Promise.all([
    nombresDeUsuarios(chats.flatMap((c) => (c.asignadoUserId !== null ? [c.asignadoUserId] : []))),
    clientesPorId(ctx.workspaceId, chats.flatMap((c) => (c.clientId ? [c.clientId] : []))),
  ]);

  return chats.map((c) => {
    const cliente = veClientes && c.clientId ? clientes.get(c.clientId) : undefined;
    const clienteNombre = cliente ? clientDisplayName(cliente) : null;
    const estado = c.estado as EstadoDelChat;
    return {
      id: c.id,
      titulo: clienteNombre ?? (c.nombre?.trim() || c.waId),
      waId: c.waId,
      estado,
      atiendeElBot: atiendeElBot({ estado, asignadoUserId: c.asignadoUserId, botPausadoHasta: c.botPausadoHasta, ultimoEntranteEn: c.ultimoEntranteEn }, ahora),
      asignadoNombre: c.asignadoUserId !== null ? (usuarios.get(c.asignadoUserId) ?? "Alguien del equipo") : null,
      clienteNombre,
      ultimoMensaje: textoDeVistaPrevia(c),
      ultimoMensajeEn: c.ultimoMensajeEn,
      noLeidos: c.noLeidos,
    };
  });
}

export type MensajeDeChat = {
  id: string;
  direccion: Direccion;
  autor: Autor;
  autorLabel: string | null;
  tipo: TipoMensaje;
  texto: string | null;
  /** Estado a mostrar: un PENDIENTE de más de 2 minutos figura como INCIERTO. */
  estadoEnvio: string;
  errorCodigo: string | null;
  createdAt: Date;
};

export type ClienteDelChat = {
  id: string;
  nombre: string;
  /** Ficha del cliente; sólo con permiso de "Ver" en Clientes. */
  href: string;
  /** Cantidades, sólo si se puede ver el módulo correspondiente. */
  consultas: number | null;
  presupuestos: number | null;
};

export type DetalleDeChat = {
  id: string;
  titulo: string;
  waId: string;
  nombrePerfil: string | null;
  estado: EstadoDelChat;
  atiendeElBot: boolean;
  asignadoUserId: number | null;
  asignadoNombre: string | null;
  noLeidos: number;
  ultimoEntranteEn: Date | null;
  /** Se puede mandar texto libre (ventana de 24 h). */
  dentroDeVentana: boolean;
  mensajes: MensajeDeChat[];
  cliente: ClienteDelChat | null;
  /** Hay un cliente vinculado pero esta persona no tiene permiso para ver Clientes. */
  clienteOculto: boolean;
};

/** Un chat con sus últimos 200 mensajes (de más viejo a más nuevo). `null` si no hay permiso o no existe. */
export async function detalleChat(ctx: CtxBandeja, chatId: string, ahora: Date = new Date()): Promise<DetalleDeChat | null> {
  if (!puedeVerBandeja(ctx)) return null;
  if (typeof chatId !== "string" || !ID_VALIDO.test(chatId)) return null;
  const c = (await prisma.fotofficeWaChat.findFirst({ where: { id: chatId, workspaceId: ctx.workspaceId } })) as {
    id: string; waId: string; nombre: string | null; clientId: string | null; estado: string; asignadoUserId: number | null;
    botPausadoHasta: Date | null; ultimoEntranteEn: Date | null; noLeidos: number;
  } | null;
  if (!c) return null;

  const [recientes, usuarios, clientes] = await Promise.all([
    prisma.fotofficeWaMensaje.findMany({
      where: { chatId: c.id, workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      take: MAXIMO_MENSAJES,
      select: { id: true, direccion: true, autor: true, autorLabel: true, tipo: true, texto: true, estadoEnvio: true, errorCodigo: true, createdAt: true },
    }) as Promise<(Omit<MensajeDeChat, "estadoEnvio"> & { estadoEnvio: string })[]>,
    nombresDeUsuarios(c.asignadoUserId !== null ? [c.asignadoUserId] : []),
    clientesPorId(ctx.workspaceId, c.clientId ? [c.clientId] : []),
  ]);
  const mensajes = recientes.reverse().map((m) => ({ ...m, estadoEnvio: estadoVisible(m, ahora) }));

  const veClientes = puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY);
  const fila = c.clientId ? clientes.get(c.clientId) : undefined;
  let cliente: ClienteDelChat | null = null;
  if (fila && veClientes) {
    const [consultas, presupuestos] = await Promise.all([
      puedeEnContexto(ctx, "ver", CLAVE_CONSULTAS) ? prisma.fotofficeConsulta.count({ where: { workspaceId: ctx.workspaceId, clientId: fila.id } }) : null,
      puedeEnContexto(ctx, "ver", CLAVE_PRESUPUESTOS) ? prisma.fotofficePresupuesto.count({ where: { workspaceId: ctx.workspaceId, clientId: fila.id } }) : null,
    ]);
    cliente = { id: fila.id, nombre: clientDisplayName(fila), href: `/clientes/${fila.id}`, consultas, presupuestos };
  }

  const estado = c.estado as EstadoDelChat;
  return {
    id: c.id,
    titulo: cliente?.nombre ?? (c.nombre?.trim() || c.waId),
    waId: c.waId,
    nombrePerfil: c.nombre,
    estado,
    atiendeElBot: atiendeElBot({ estado, asignadoUserId: c.asignadoUserId, botPausadoHasta: c.botPausadoHasta, ultimoEntranteEn: c.ultimoEntranteEn }, ahora),
    asignadoUserId: c.asignadoUserId,
    asignadoNombre: c.asignadoUserId !== null ? (usuarios.get(c.asignadoUserId) ?? "Alguien del equipo") : null,
    noLeidos: c.noLeidos,
    ultimoEntranteEn: c.ultimoEntranteEn,
    dentroDeVentana: puedeResponderLibre({ ultimoEntranteEn: c.ultimoEntranteEn }, ahora),
    mensajes,
    cliente,
    clienteOculto: Boolean(c.clientId) && !cliente,
  };
}

/**
 * Suma de mensajes sin leer de un workspace (una sola consulta agregada). ÚNICA implementación:
 * la usan `totalNoLeidos` y el menú, que ya comprobó el permiso. Si la lectura falla (tabla sin
 * migrar) devuelve 0: el menú nunca rompe una pantalla.
 */
export async function noLeidosDelWorkspace(workspaceId: string): Promise<number> {
  try {
    const r = await prisma.fotofficeWaChat.aggregate({ where: { workspaceId, noLeidos: { gt: 0 } }, _sum: { noLeidos: true } });
    return r._sum.noLeidos ?? 0;
  } catch {
    return 0;
  }
}

/** Mensajes sin leer del workspace. `null` sin permiso de "Ver". */
export async function totalNoLeidos(ctx: CtxBandeja): Promise<number | null> {
  if (!puedeVerBandeja(ctx)) return null;
  return noLeidosDelWorkspace(ctx.workspaceId);
}

export type ClienteBuscado = { id: string; nombre: string; telefono: string | null };

/**
 * Búsqueda simple de clientes del workspace por nombre o teléfono, para vincular un chat. Pide
 * "Gestionar" en la Bandeja y "Ver" en Clientes. Devuelve como mucho 8.
 */
export async function buscarClientes(ctx: CtxBandeja, q: unknown): Promise<ClienteBuscado[] | null> {
  if (!puedeOperarBandeja(ctx) || !puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY)) return null;
  const texto = typeof q === "string" ? q.trim().slice(0, 80) : "";
  if (texto.length < 2) return [];
  const digitos = soloDigitos(texto);
  const o: Record<string, unknown>[] = [
    { firstName: { contains: texto, mode: "insensitive" } },
    { lastName: { contains: texto, mode: "insensitive" } },
    { businessName: { contains: texto, mode: "insensitive" } },
  ];
  if (digitos.length >= 3) o.push({ phone: { contains: digitos } });
  const filas = (await prisma.client.findMany({
    where: { workspaceId: ctx.workspaceId, OR: o },
    orderBy: { lastName: "asc" },
    take: 8,
    select: { ...COLUMNAS_CLIENTE, phone: true },
  })) as (FilaCliente & { phone: string | null })[];
  return filas.map((f) => ({ id: f.id, nombre: clientDisplayName(f), telefono: f.phone }));
}
