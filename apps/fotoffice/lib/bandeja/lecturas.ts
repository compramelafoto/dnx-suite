import "server-only";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { clientDisplayName } from "@/lib/clients/display";
import { soloDigitos } from "@/lib/clients/match";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { puedeOperarBandeja, puedeVerBandeja, type CtxBandeja } from "./acceso";
import { archivoDeMensaje, type ArchivoDeMensaje } from "./archivo-de-mensaje";
import { CANALES, type Autor, type Canal, type Direccion, type EstadoDelChat, type TipoMensaje } from "./constantes";
import { atiendeElBot, estadoVisible, puedeResponderLibre } from "./reglas";
import { fragmentoDe, textoDeVistaPrevia, truncarSeguro, type Fragmento } from "./vista-previa";
import { FILTROS_POR_OMISION, ESTADOS_FILTRO, type FiltrosBandeja } from "./filtros";

/**
 * Lecturas de la Bandeja de WhatsApp (servidor): la lista de chats, el detalle de uno y el total de
 * no leídos. Todas reciben el contexto armado desde la sesión y devuelven `null` sin permiso de
 * "Ver" en el módulo. Todo se busca con el `workspaceId` del contexto. Nunca loguean textos ni
 * teléfonos y nunca devuelven la columna `media` ni el `clientToken` de los mensajes.
 */

export const MAXIMO_CHATS = 200;
export const MAXIMO_MENSAJES = 200;
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const CLAVE_CONSULTAS = SERVICE_LEADS_MODULE_KEY;
const CLAVE_PRESUPUESTOS = "quotes";

/** Filtro de canal de la lista (parámetro de URL `canal`). */
export const FILTROS_CANAL = ["todos", ...CANALES] as const;
export type FiltroCanal = (typeof FILTROS_CANAL)[number];

export const ETIQUETA_CANAL: Record<FiltroCanal, string> = { todos: "Todos", WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram" };

/**
 * Título de un chat: el cliente vinculado; si no, en Instagram `@usuario`, el nombre o «Instagram»
 * (nunca el IGSID, que no le dice nada a nadie); en WhatsApp el nombre del perfil o el número.
 */
function tituloDelChat(c: { canal: string; waId: string; nombre: string | null; usuarioInstagram: string | null }, clienteNombre: string | null): string {
  if (clienteNombre) return clienteNombre;
  const nombre = c.nombre?.trim() || null;
  if (c.canal === "INSTAGRAM") return c.usuarioInstagram ? `@${c.usuarioInstagram}` : (nombre ?? "Instagram");
  return nombre ?? c.waId;
}

const canalDe = (v: string | null | undefined): Canal => (v === "INSTAGRAM" ? "INSTAGRAM" : "WHATSAPP");

export type ChatDeLista = {
  id: string;
  /** Nombre del cliente vinculado, o el del perfil (en Instagram, `@usuario`), o el número. */
  titulo: string;
  waId: string;
  canal: Canal;
  usuarioInstagram: string | null;
  estado: EstadoDelChat;
  /** Lo atiende el bot ahora (incluye la pausa vencida de un chat sin asignar). */
  atiendeElBot: boolean;
  asignadoUserId: number | null;
  asignadoNombre: string | null;
  clienteNombre: string | null;
  ultimoMensaje: string | null;
  /** Con búsqueda por palabra: dónde apareció (en lugar de la vista previa). */
  fragmento: Fragmento | null;
  /** Último mensaje del cliente (base del tiempo de espera). */
  ultimoEntranteEn: Date | null;
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

/** "Atiende el bot" en la base: la misma regla que `atiendeElBot`. */
const DONDE_BOT = (ahora: Date) => ({ botExcluido: false, OR: [{ estado: "BOT" }, { estado: "HUMANO", asignadoUserId: null, botPausadoHasta: { lte: ahora } }] });

/**
 * "Sin asignar": nadie asignado y el bot NO lo atiende (número excluido, o HUMANO con la pausa
 * vigente o sin pausa). Sin `NOT`: en SQL un `NOT` sobre columnas nulas deja afuera los NULL.
 */
const DONDE_SIN_ASIGNAR = (ahora: Date) => ({
  asignadoUserId: null,
  OR: [{ botExcluido: true }, { estado: "HUMANO", botPausadoHasta: null }, { estado: "HUMANO", botPausadoHasta: { gt: ahora } }],
});

/** Días hacia atrás que mira "Esperando respuesta" (un chat abandonado hace meses no es urgente). */
export const DIAS_ESPERANDO = 7;
const DIRECCIONES_BUSCABLES = ["ENTRANTE", "SALIENTE", "NOTA"];

type OpcionesLista = Partial<FiltrosBandeja> & { ahora?: Date };

/**
 * Lista de chats del workspace (máximo 200), con los filtros de ejes independientes (§5.1 del diseño
 * 2026-11-24): quién atiende, canal, estado y búsqueda. `q` busca por nombre del perfil, número,
 * @usuario, nombre del cliente vinculado y palabras de los mensajes (no los SISTEMA). Sin permiso
 * de "Ver": `null`.
 */
export async function listarChats(ctx: CtxBandeja, opciones: OpcionesLista = {}): Promise<ChatDeLista[] | null> {
  if (!puedeVerBandeja(ctx) || ctx.userId === null) return null;
  const ahora = opciones.ahora ?? new Date();
  const f: FiltrosBandeja = { ...FILTROS_POR_OMISION };
  const quien = opciones.quien;
  if (quien === "bot" || quien === "sin-asignar" || (typeof quien === "number" && Number.isInteger(quien) && quien > 0)) f.quien = quien;
  if ((CANALES as readonly unknown[]).includes(opciones.canal)) f.canal = opciones.canal as Canal;
  if ((ESTADOS_FILTRO as readonly unknown[]).includes(opciones.estado)) f.estado = opciones.estado!;

  const condiciones: Record<string, unknown>[] = [{ workspaceId: ctx.workspaceId }];
  condiciones.push(f.estado === "resueltos" ? { estado: "RESUELTO" } : { estado: { in: ["BOT", "HUMANO"] } });
  if (f.quien === "bot") condiciones.push(DONDE_BOT(ahora));
  else if (f.quien === "sin-asignar") condiciones.push(DONDE_SIN_ASIGNAR(ahora));
  // Entre los resueltos nadie queda asignado: "de Camila" son los que resolvió ella.
  else if (typeof f.quien === "number") condiciones.push(f.estado === "resueltos" ? { resueltoPorUserId: f.quien } : { asignadoUserId: f.quien });
  if (f.canal !== "todos") condiciones.push({ canal: f.canal });
  if (f.estado === "esperando") condiciones.push({ ultimoEntranteEn: { gte: new Date(ahora.getTime() - DIAS_ESPERANDO * 86_400_000) } });

  // Sin permiso de Clientes la búsqueda no entra a la ficha: sólo perfil de WhatsApp y número.
  const veClientes = puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY);
  const q = truncarSeguro((opciones.q ?? "").trim(), 80, false);
  /** Chat → texto del mensaje más reciente donde apareció la palabra. */
  const porPalabra = new Map<string, string>();
  if (q) {
    const digitos = soloDigitos(q);
    const [porNombre, mensajes] = await Promise.all([
      !veClientes ? [] : (prisma.client.findMany({
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
      }) as Promise<{ id: string }[]>),
      q.length < 2 ? [] : (prisma.fotofficeWaMensaje.findMany({
        where: { workspaceId: ctx.workspaceId, direccion: { in: DIRECCIONES_BUSCABLES }, texto: { contains: q, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: { chatId: true, texto: true },
      }) as Promise<{ chatId: string; texto: string | null }[]>),
    ]);
    for (const m of mensajes) if (!porPalabra.has(m.chatId) && m.texto) porPalabra.set(m.chatId, m.texto);
    const o: Record<string, unknown>[] = [{ nombre: { contains: q, mode: "insensitive" } }];
    // El número sólo se busca en WhatsApp: en Instagram `waId` es el IGSID, no un teléfono.
    if (digitos.length >= 3) o.push({ canal: "WHATSAPP", waId: { contains: digitos } });
    const usuario = q.replace(/^@/, "");
    if (usuario) o.push({ usuarioInstagram: { contains: usuario, mode: "insensitive" } });
    if (porNombre.length > 0) o.push({ clientId: { in: porNombre.map((c) => c.id) } });
    if (porPalabra.size > 0) o.push({ id: { in: [...porPalabra.keys()] } });
    condiciones.push({ OR: o });
  }

  const esperando = f.estado === "esperando";
  let chats = (await prisma.fotofficeWaChat.findMany({
    where: { AND: condiciones },
    // "Esperando": del que más espera al que menos; se filtra después (compara dos columnas).
    orderBy: esperando ? { ultimoEntranteEn: "asc" } : { ultimoMensajeEn: "desc" },
    take: esperando ? MAXIMO_CHATS * 5 : MAXIMO_CHATS,
  })) as {
    id: string; waId: string; canal: string; usuarioInstagram: string | null; nombre: string | null; clientId: string | null; estado: string; asignadoUserId: number | null;
    botPausadoHasta: Date | null; botExcluido: boolean; ultimoMensajeEn: Date; ultimoEntranteEn: Date | null; noLeidos: number;
    ultimoMensajeTexto: string | null; ultimoMensajeTipo: string | null;
  }[];
  if (esperando) chats = chats.filter((c) => c.ultimoEntranteEn !== null && c.ultimoEntranteEn.getTime() >= c.ultimoMensajeEn.getTime()).slice(0, MAXIMO_CHATS);

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
      titulo: tituloDelChat(c, clienteNombre),
      waId: c.waId,
      canal: canalDe(c.canal),
      usuarioInstagram: c.usuarioInstagram ?? null,
      estado,
      atiendeElBot: atiendeElBot({ estado, asignadoUserId: c.asignadoUserId, botPausadoHasta: c.botPausadoHasta, ultimoEntranteEn: c.ultimoEntranteEn, botExcluido: c.botExcluido }, ahora),
      asignadoUserId: c.asignadoUserId,
      asignadoNombre: c.asignadoUserId !== null ? (usuarios.get(c.asignadoUserId) ?? "Alguien del equipo") : null,
      clienteNombre,
      ultimoMensaje: textoDeVistaPrevia(c),
      fragmento: q ? fragmentoDe(porPalabra.get(c.id), q) : null,
      ultimoEntranteEn: c.ultimoEntranteEn,
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
  /** Foto, documento, video o audio que mandó el cliente (sin la clave de R2). */
  archivo: ArchivoDeMensaje | null;
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
  canal: Canal;
  usuarioInstagram: string | null;
  nombrePerfil: string | null;
  estado: EstadoDelChat;
  atiendeElBot: boolean;
  asignadoUserId: number | null;
  /** El bot nunca atiende este número. */
  botExcluido: boolean;
  asignadoNombre: string | null;
  noLeidos: number;
  ultimoEntranteEn: Date | null;
  ultimoMensajeEn: Date;
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
    id: string; waId: string; canal: string; usuarioInstagram: string | null; nombre: string | null; clientId: string | null; estado: string; asignadoUserId: number | null;
    botPausadoHasta: Date | null; botExcluido: boolean; ultimoEntranteEn: Date | null; ultimoMensajeEn: Date; noLeidos: number;
  } | null;
  if (!c) return null;

  const [recientes, usuarios, clientes] = await Promise.all([
    prisma.fotofficeWaMensaje.findMany({
      where: { chatId: c.id, workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      take: MAXIMO_MENSAJES,
      select: { id: true, direccion: true, autor: true, autorLabel: true, tipo: true, texto: true, estadoEnvio: true, errorCodigo: true, createdAt: true, media: true },
    }) as Promise<(Omit<MensajeDeChat, "estadoEnvio" | "archivo"> & { estadoEnvio: string; media: unknown })[]>,
    nombresDeUsuarios(c.asignadoUserId !== null ? [c.asignadoUserId] : []),
    clientesPorId(ctx.workspaceId, c.clientId ? [c.clientId] : []),
  ]);
  const mensajes = recientes.reverse().map(({ media, ...m }) => ({ ...m, estadoEnvio: estadoVisible(m, ahora), archivo: archivoDeMensaje(m.tipo, media, { direccion: m.direccion, createdAt: m.createdAt, ahora }) }));

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
    titulo: tituloDelChat(c, cliente?.nombre ?? null),
    waId: c.waId,
    canal: canalDe(c.canal),
    usuarioInstagram: c.usuarioInstagram ?? null,
    nombrePerfil: c.nombre,
    estado,
    atiendeElBot: atiendeElBot({ estado, asignadoUserId: c.asignadoUserId, botPausadoHasta: c.botPausadoHasta, ultimoEntranteEn: c.ultimoEntranteEn, botExcluido: c.botExcluido }, ahora),
    asignadoUserId: c.asignadoUserId,
    botExcluido: c.botExcluido,
    asignadoNombre: c.asignadoUserId !== null ? (usuarios.get(c.asignadoUserId) ?? "Alguien del equipo") : null,
    noLeidos: c.noLeidos,
    ultimoEntranteEn: c.ultimoEntranteEn,
    ultimoMensajeEn: c.ultimoMensajeEn,
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
  const texto = typeof q === "string" ? truncarSeguro(q.trim(), 80, false) : "";
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
