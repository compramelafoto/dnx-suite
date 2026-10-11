import "server-only";
import { prisma } from "@repo/db";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { urlDeDescargaFoto, urlDeLecturaFoto, urlsDeLecturaPorLote } from "./almacen";
import {
  MAX_COMENTARIOS_POR_CLIENTE,
  type EstadoCliente,
  type EstadoFoto,
  type ModoDescarga,
  type ModoOrden,
  type ModoSeleccion,
} from "./constantes";
import { hashDeToken, tokenConForma } from "./enlace";
import { registrarEvento, registrarEventoSinFallar } from "./eventos";
import { ordenarFotosDeGaleria } from "./orden";
import {
  MAX_MENSAJE_CLIENTE,
  MAX_VISTAS_POR_LOTE,
  MENSAJES_PUBLICO as M,
  nombreDeDescarga,
  type ComentarioPublico,
  type VistaGaleria,
} from "./publico-tipos";
import { estadoDespues, estadosDesde, puedeAgregar, puedeEditarElCliente, validarComentario, validarEnvio } from "./seleccion";

/**
 * Lo que hace el cliente en su enlace (etapa 7), sin sesión: el token es la llave. TODA función vuelve a
 * resolver el token contra la base (cliente de ese workspace, no anulado, galería PUBLICADA) y trabaja sólo
 * con fotos de ESA galería. Las respuestas son datos planos armados campo por campo: nunca una fila entera,
 * nunca claves de R2, ni datos de otros clientes.
 *
 * Un enlace desconocido, de otra organización, anulado o de una galería que no está publicada da siempre el
 * mismo "no válido": no se dice cuál de esos casos es.
 */

const AR = "America/Argentina/Buenos_Aires";
const CINCO_MINUTOS = 5 * 60_000;

export function fechaArgentina(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: AR, dateStyle: "long", timeStyle: "short" }).format(d);
}

export type DatosGaleriaDeToken = {
  id: string;
  number: string;
  name: string;
  message: string | null;
  selectionMode: ModoSeleccion;
  minSelect: number | null;
  maxSelect: number | null;
  allowComments: boolean;
  downloadMode: ModoDescarga;
  orderMode: ModoOrden;
  coverFotoId: string | null;
  ownerUserId: number | null;
};

export type DatosClienteDeToken = {
  id: string;
  name: string;
  email: string | null;
  status: EstadoCliente;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  submittedAt: Date | null;
  submitMessage: string | null;
};

export type ResultadoTokenGaleria =
  | { ok: true; workspaceId: string; cliente: DatosClienteDeToken; galeria: DatosGaleriaDeToken }
  | { ok: false };

type Resuelto = Extract<ResultadoTokenGaleria, { ok: true }>;

export type Falla = { ok: false; error: string; codigo: "INVALIDO" | "SOLO_LECTURA" | "REGLA" | "TOPE" };
const falla = (error: string, codigo: Falla["codigo"] = "REGLA"): Falla => ({ ok: false, error, codigo });
const INVALIDO = (): Falla => falla(M.enlaceInvalido, "INVALIDO");
const SOLO_LECTURA = (): Falla => falla(M.soloLectura, "SOLO_LECTURA");

/**
 * Qué cliente y galería corresponden a un token dentro de un workspace. Sólo sirve si el cliente no está
 * anulado y la galería está PUBLICADA (una en borrador o archivada deja de abrirse).
 */
export async function resolverTokenGaleria(workspaceId: string, token: unknown): Promise<ResultadoTokenGaleria> {
  if (typeof workspaceId !== "string" || !workspaceId || !tokenConForma(token)) return { ok: false };
  const c = await prisma.fotofficeGaleriaCliente.findFirst({
    where: { workspaceId, tokenHash: hashDeToken(token) },
    select: { id: true, galeriaId: true, name: true, email: true, status: true, revokedAt: true, firstSeenAt: true, lastSeenAt: true, submittedAt: true, submitMessage: true },
  });
  if (!c || c.revokedAt) return { ok: false };
  const g = await prisma.fotofficeGaleria.findFirst({
    where: { id: c.galeriaId, workspaceId },
    select: {
      id: true, number: true, name: true, message: true, status: true, selectionMode: true, minSelect: true, maxSelect: true,
      allowComments: true, downloadMode: true, orderMode: true, coverFotoId: true, ownerUserId: true,
    },
  });
  if (!g || g.status !== "PUBLICADA") return { ok: false };
  return {
    ok: true,
    workspaceId,
    cliente: {
      id: c.id, name: c.name, email: c.email, status: c.status as EstadoCliente, firstSeenAt: c.firstSeenAt, lastSeenAt: c.lastSeenAt,
      submittedAt: c.submittedAt, submitMessage: c.submitMessage,
    },
    galeria: {
      id: g.id, number: g.number, name: g.name, message: g.message, selectionMode: g.selectionMode as ModoSeleccion, minSelect: g.minSelect,
      maxSelect: g.maxSelect, allowComments: g.allowComments, downloadMode: g.downloadMode as ModoDescarga, orderMode: g.orderMode as ModoOrden,
      coverFotoId: g.coverFotoId, ownerUserId: g.ownerUserId,
    },
  };
}

function config(r: Resuelto) {
  return { selectionMode: r.galeria.selectionMode, minSelect: r.galeria.minSelect, maxSelect: r.galeria.maxSelect };
}

/**
 * Deja constancia de que el cliente entró: `firstSeenAt` y el evento ENTRO la primera vez; después sólo
 * actualiza `lastSeenAt` y a lo sumo cada 5 minutos. Escrituras condicionales (dos pestañas a la vez no
 * duplican el evento). Nunca lanza ni guarda datos personales.
 */
export async function registrarEntrada(r: Resuelto, ahora: Date = new Date()): Promise<void> {
  try {
    const primera = await prisma.fotofficeGaleriaCliente.updateMany({
      where: { id: r.cliente.id, workspaceId: r.workspaceId, firstSeenAt: null },
      data: { firstSeenAt: ahora, lastSeenAt: ahora },
    });
    if (primera.count > 0) {
      await registrarEvento(prisma, { workspaceId: r.workspaceId, galeriaId: r.galeria.id, galeriaClienteId: r.cliente.id, tipo: "ENTRO" });
      return;
    }
    await prisma.fotofficeGaleriaCliente.updateMany({
      where: { id: r.cliente.id, workspaceId: r.workspaceId, lastSeenAt: { lt: new Date(ahora.getTime() - CINCO_MINUTOS) } },
      data: { lastSeenAt: ahora },
    });
  } catch (e) {
    console.error("[galerias] no se pudo registrar la entrada", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
  }
}

// --- La página ---------------------------------------------------------------------------------------------

/**
 * Todo lo que ve el cliente al abrir su enlace. Las miniaturas van firmadas (1 h) de una vez; las vistas
 * grandes se piden a medida que se abre el visor (`urlsDeVista`).
 */
export async function armarVistaGaleria(r: Resuelto): Promise<VistaGaleria> {
  const { workspaceId, galeria: g, cliente: c } = r;
  const [sitio, fotos, selecciones, comentarios] = await Promise.all([
    sitioDelWorkspace(workspaceId),
    prisma.fotofficeGaleriaFoto.findMany({
      where: { workspaceId, galeriaId: g.id, status: "LISTA" satisfies EstadoFoto },
      select: { id: true, fileName: true, order: true, thumbKey: true, viewKey: true, width: true, height: true },
    }),
    prisma.fotofficeGaleriaSeleccion.findMany({ where: { workspaceId, galeriaClienteId: c.id }, select: { fotoId: true } }),
    prisma.fotofficeGaleriaComentario.findMany({
      where: { workspaceId, galeriaClienteId: c.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, fotoId: true, author: true, body: true, createdAt: true },
    }),
  ]);
  const ordenadas = ordenarFotosDeGaleria(fotos, g.orderMode);
  const ids = new Set(ordenadas.map((f) => f.id));
  const urls = await urlsDeLecturaPorLote(ordenadas.map((f) => ({ id: f.id, viewKey: null, thumbKey: f.thumbKey })));
  let portadaUrl: string | null = null;
  const portada = g.coverFotoId ? ordenadas.find((f) => f.id === g.coverFotoId) : undefined;
  if (portada?.viewKey) {
    try {
      portadaUrl = await urlDeLecturaFoto(portada.viewKey);
    } catch {
      portadaUrl = null;
    }
  }
  const conLimites = g.selectionMode === "CANTIDAD";
  return {
    organizacion: { nombre: sitio?.nombre ?? "", logoUrl: sitio?.logoUrl ?? null },
    galeria: {
      nombre: g.name,
      mensaje: g.message?.trim() ? g.message : null,
      permiteComentarios: g.allowComments,
      permiteDescarga: g.downloadMode === "VISTA",
      modo: g.selectionMode,
      minimo: conLimites ? g.minSelect : null,
      maximo: conLimites ? g.maxSelect : null,
    },
    cliente: {
      nombre: c.name,
      estado: c.status,
      enviadaEn: c.submittedAt ? fechaArgentina(c.submittedAt) : null,
      mensajeEnviado: c.submitMessage,
    },
    portadaUrl,
    fotos: ordenadas.map((f) => ({ id: f.id, thumbUrl: urls.get(f.id)?.thumbUrl ?? null, width: f.width, height: f.height })),
    seleccionadas: selecciones.map((s) => s.fotoId).filter((id) => ids.has(id)),
    comentarios: comentarios.filter((x) => ids.has(x.fotoId)).map((x) => aComentarioPublico(x)),
  };
}

function aComentarioPublico(x: { id: string; fotoId: string; author: string; body: string; createdAt: Date }): ComentarioPublico {
  return { id: x.id, fotoId: x.fotoId, autor: x.author === "ESTUDIO" ? "ESTUDIO" : "CLIENTE", texto: x.body, fecha: fechaArgentina(x.createdAt) };
}

/** Ids pedidos que son fotos LISTAS de la galería del cliente (los demás se descartan). */
async function fotosDeLaGaleria(r: Resuelto, ids: unknown): Promise<{ id: string; viewKey: string | null; fileName: string }[]> {
  if (!Array.isArray(ids)) return [];
  const pedidos = [...new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 40))].slice(0, MAX_VISTAS_POR_LOTE);
  if (pedidos.length === 0) return [];
  return prisma.fotofficeGaleriaFoto.findMany({
    where: { workspaceId: r.workspaceId, galeriaId: r.galeria.id, status: "LISTA", id: { in: pedidos } },
    select: { id: true, viewKey: true, fileName: true },
  });
}

/** URLs firmadas (1 h) de la vista grande de unas pocas fotos, para el visor. */
export async function urlsDeVista(workspaceId: string, token: unknown, ids: unknown): Promise<{ ok: true; urls: Record<string, string> } | Falla> {
  const r = await resolverTokenGaleria(workspaceId, token);
  if (!r.ok) return INVALIDO();
  const fotos = await fotosDeLaGaleria(r, ids);
  const urls = await urlsDeLecturaPorLote(fotos.map((f) => ({ id: f.id, viewKey: f.viewKey, thumbKey: null })));
  const salida: Record<string, string> = {};
  for (const f of fotos) {
    const u = urls.get(f.id)?.viewUrl;
    if (u) salida[f.id] = u;
  }
  return { ok: true, urls: salida };
}

/** Enlace firmado para BAJAR la vista de una foto; sólo si la galería permite la descarga de la vista. */
export async function urlDeDescarga(workspaceId: string, token: unknown, fotoId: unknown): Promise<{ ok: true; url: string } | Falla> {
  const r = await resolverTokenGaleria(workspaceId, token);
  if (!r.ok) return INVALIDO();
  if (r.galeria.downloadMode !== "VISTA") return falla(M.sinDescarga);
  const [foto] = await fotosDeLaGaleria(r, [fotoId]);
  if (!foto?.viewKey) return falla(M.fotoInvalida);
  try {
    return { ok: true, url: await urlDeDescargaFoto(foto.viewKey, nombreDeDescarga(foto.fileName)) };
  } catch {
    return falla(M.generico);
  }
}

// --- Elegir y quitar ----------------------------------------------------------------------------------------

/** Marca o desmarca una foto. Idempotente (marcar dos veces no duplica). Sólo mientras el cliente está eligiendo. */
export async function elegirFoto(workspaceId: string, token: unknown, fotoId: unknown, marcar: unknown): Promise<{ ok: true; cantidad: number } | Falla> {
  const r = await resolverTokenGaleria(workspaceId, token);
  if (!r.ok) return INVALIDO();
  if (!puedeEditarElCliente(r.cliente.status)) return SOLO_LECTURA();
  if (typeof marcar !== "boolean") return falla(M.generico);
  const [foto] = await fotosDeLaGaleria(r, [fotoId]);
  if (!foto) return falla(M.fotoInvalida);
  const donde = { workspaceId, galeriaClienteId: r.cliente.id };
  if (marcar) {
    const ya = await prisma.fotofficeGaleriaSeleccion.findFirst({ where: { ...donde, fotoId: foto.id }, select: { id: true } });
    if (!ya) {
      const actuales = await prisma.fotofficeGaleriaSeleccion.count({ where: donde });
      const tope = puedeAgregar(config(r), actuales);
      if (!tope.ok) return falla(tope.error);
      try {
        await prisma.fotofficeGaleriaSeleccion.create({ data: { ...donde, fotoId: foto.id }, select: { id: true } });
      } catch (e) {
        if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
      }
      // Si en este instante envió desde otra pestaña, lo agregado después del envío no vale.
      const sigue = await prisma.fotofficeGaleriaCliente.findFirst({ where: { id: r.cliente.id, workspaceId, status: { in: [...estadosDesde("ENVIAR")] }, revokedAt: null }, select: { id: true } });
      if (!sigue) {
        await prisma.fotofficeGaleriaSeleccion.deleteMany({ where: { ...donde, fotoId: foto.id } });
        return SOLO_LECTURA();
      }
    }
  } else {
    await prisma.fotofficeGaleriaSeleccion.deleteMany({ where: { ...donde, fotoId: foto.id } });
  }
  return { ok: true, cantidad: await prisma.fotofficeGaleriaSeleccion.count({ where: donde }) };
}

// --- Comentar -----------------------------------------------------------------------------------------------

export async function comentarFoto(workspaceId: string, token: unknown, fotoId: unknown, texto: unknown): Promise<{ ok: true; comentario: ComentarioPublico } | Falla> {
  const r = await resolverTokenGaleria(workspaceId, token);
  if (!r.ok) return INVALIDO();
  if (!r.galeria.allowComments) return falla(M.sinComentarios);
  if (!puedeEditarElCliente(r.cliente.status)) return SOLO_LECTURA();
  const v = validarComentario(texto);
  if (!v.ok) return falla(v.error);
  const [foto] = await fotosDeLaGaleria(r, [fotoId]);
  if (!foto) return falla(M.fotoInvalida);
  const propios = await prisma.fotofficeGaleriaComentario.count({ where: { workspaceId, galeriaClienteId: r.cliente.id, author: "CLIENTE" } });
  if (propios >= MAX_COMENTARIOS_POR_CLIENTE) return falla(M.topeComentarios, "TOPE");
  const fila = await prisma.fotofficeGaleriaComentario.create({
    data: { workspaceId, galeriaClienteId: r.cliente.id, fotoId: foto.id, author: "CLIENTE", body: v.texto },
    select: { id: true, fotoId: true, author: true, body: true, createdAt: true },
  });
  return { ok: true, comentario: aComentarioPublico(fila) };
}

// --- Enviar -------------------------------------------------------------------------------------------------

export type EnvioHecho = {
  ok: true;
  cantidad: number;
  enviadaEn: string;
  /** Lo que necesita `after()` para los correos (el cliente ya no espera). */
  aviso: { workspaceId: string; galeriaId: string; galeriaClienteId: string; cantidad: number };
};

/** Mensaje opcional del cliente: texto recortado, o null si viene vacío; error si pasa el tope. */
export function mensajeDeEnvio(raw: unknown): { ok: true; texto: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, texto: null };
  if (typeof raw !== "string") return { ok: false, error: M.generico };
  const t = raw.replace(/\r\n?/g, "\n").trim();
  if (t.length > MAX_MENSAJE_CLIENTE) return { ok: false, error: M.mensajeLargo };
  return { ok: true, texto: t === "" ? null : t };
}

/**
 * Envía la selección: valida mínimo y máximo con lo que HAY en la base y pasa EN_PROGRESO → EN_REVISION con
 * una escritura condicional (dos envíos a la vez: gana uno y el otro ve "ya enviada").
 */
export async function enviarSeleccion(workspaceId: string, token: unknown, mensaje: unknown, ahora: Date = new Date()): Promise<EnvioHecho | Falla> {
  const r = await resolverTokenGaleria(workspaceId, token);
  if (!r.ok) return INVALIDO();
  if (!puedeEditarElCliente(r.cliente.status)) return falla(M.yaEnviada, "SOLO_LECTURA");
  const m = mensajeDeEnvio(mensaje);
  if (!m.ok) return falla(m.error);
  const cantidad = await prisma.fotofficeGaleriaSeleccion.count({ where: { workspaceId, galeriaClienteId: r.cliente.id } });
  const v = validarEnvio(config(r), cantidad);
  if (!v.ok) return falla(v.error);
  const cambio = await prisma.fotofficeGaleriaCliente.updateMany({
    where: { id: r.cliente.id, workspaceId, revokedAt: null, status: { in: [...estadosDesde("ENVIAR")] } },
    data: { status: estadoDespues("ENVIAR"), submittedAt: ahora, submitMessage: m.texto },
  });
  if (cambio.count === 0) return falla(M.yaEnviada, "SOLO_LECTURA");
  await registrarEventoSinFallar({ workspaceId, galeriaId: r.galeria.id, galeriaClienteId: r.cliente.id, tipo: "SELECCION_ENVIADA", data: { cantidad } });
  return {
    ok: true,
    cantidad,
    enviadaEn: fechaArgentina(ahora),
    aviso: { workspaceId, galeriaId: r.galeria.id, galeriaClienteId: r.cliente.id, cantidad },
  };
}
