import "server-only";
import { prisma } from "@repo/db";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { MENSAJES_GALERIA as M, puedeGestionarGalerias, puedeVerGalerias, type CtxGalerias } from "./acceso";
import { urlsDeLecturaPorLote } from "./almacen";
import { ESTADOS_CLIENTE, MAX_COMENTARIOS_POR_CLIENTE, type EstadoCliente, type EstadoGaleria } from "./constantes";
import { registrarEvento } from "./eventos";
import { exportarSeleccion, type FilaCsvSeleccion, type SeleccionExportada } from "./exportar";
import { ordenarPorNombre } from "./orden";
import { estadoDespues, estadosDesde, validarComentario } from "./seleccion";

/**
 * Revisión en el estudio de la selección de un cliente (etapa 7): ver lo que eligió y comentó, responderle,
 * exportar para Lightroom / Windows / Excel, finalizar y reactivar. Recibe un ctx YA autorizado por quien
 * llama (acción, ruta o página), pero cada función vuelve a exigir el permiso y a acotar TODA consulta al
 * workspace del ctx y a la galería: un id de otro workspace o de otra galería no encuentra nada.
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const idValido = (v: unknown): v is string => typeof v === "string" && ID_VALIDO.test(v);
const no = (error: string) => ({ ok: false as const, error });

export const MENSAJES_REVISION = {
  fotoSinRelacion: "Esa foto no está en la selección de este cliente ni tiene comentarios suyos.",
  topeRespuestas: `Ya hay ${MAX_COMENTARIOS_POR_CLIENTE} respuestas del estudio para este cliente.`,
  soloEnRevision: "Sólo se puede finalizar una selección que el cliente ya envió y está esperando revisión.",
  noReactivable: "Sólo se puede reactivar una selección enviada o finalizada.",
  galeriaArchivada: "La galería está archivada: reactivala antes de devolverle la selección al cliente.",
  clienteAnulado: "El enlace de este cliente está anulado: habilitalo con un enlace nuevo antes de reactivar su selección.",
} as const;

export type ComentarioRevision = {
  id: string;
  fotoId: string;
  autor: "CLIENTE" | "ESTUDIO";
  nombreAutor: string;
  texto: string;
  /** ISO. */
  fecha: string;
};

export type FotoRevision = {
  id: string;
  fileName: string;
  thumbUrl: string | null;
  seleccionada: boolean;
  comentarios: ComentarioRevision[];
};

export type RevisionCliente = {
  galeria: { id: string; numero: string; nombre: string; estado: EstadoGaleria; comentarios: boolean };
  cliente: {
    id: string;
    nombre: string;
    email: string | null;
    telefono: string | null;
    estado: EstadoCliente;
    anulado: boolean;
    primeraVez: string | null;
    ultimaVez: string | null;
    enviadoEn: string | null;
    finalizadoEn: string | null;
    reactivadoEn: string | null;
    mensaje: string | null;
  };
  /** Las elegidas y las que sólo tienen comentarios, en orden natural por nombre. */
  fotos: FotoRevision[];
  seleccionadas: number;
  conComentarios: number;
  exportacion: SeleccionExportada;
};

type Base = {
  galeria: { id: string; number: string; name: string; status: string; allowComments: boolean };
  cliente: {
    id: string; name: string; email: string | null; phone: string | null; status: string; revokedAt: Date | null; firstSeenAt: Date | null;
    lastSeenAt: Date | null; submittedAt: Date | null; submitMessage: string | null; finalizedAt: Date | null; reopenedAt: Date | null;
  };
  fotos: { id: string; fileName: string; thumbKey: string | null; viewKey: string | null }[];
  seleccionIds: Set<string>;
  comentarios: { id: string; fotoId: string; author: string; authorUserId: number | null; body: string; createdAt: Date }[];
};

/** Lee todo lo del cliente, siempre con workspace y galería. Null si el cliente no es de esa galería de ese workspace. */
async function leerBase(ctx: CtxGalerias, galeriaId: unknown, galeriaClienteId: unknown): Promise<Base | null> {
  if (!puedeVerGalerias(ctx) || !idValido(galeriaId) || !idValido(galeriaClienteId)) return null;
  const { workspaceId } = ctx;
  const [galeria, cliente] = await Promise.all([
    prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId }, select: { id: true, number: true, name: true, status: true, allowComments: true } }),
    prisma.fotofficeGaleriaCliente.findFirst({
      where: { id: galeriaClienteId, galeriaId, workspaceId },
      select: {
        id: true, name: true, email: true, phone: true, status: true, revokedAt: true, firstSeenAt: true, lastSeenAt: true,
        submittedAt: true, submitMessage: true, finalizedAt: true, reopenedAt: true,
      },
    }),
  ]);
  if (!galeria || !cliente) return null;
  const [selecciones, comentarios] = await Promise.all([
    prisma.fotofficeGaleriaSeleccion.findMany({ where: { galeriaClienteId, workspaceId }, select: { fotoId: true } }),
    prisma.fotofficeGaleriaComentario.findMany({
      where: { galeriaClienteId, workspaceId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, fotoId: true, author: true, authorUserId: true, body: true, createdAt: true },
    }),
  ]);
  const seleccionIds = new Set(selecciones.map((s) => s.fotoId));
  const ids = [...new Set([...seleccionIds, ...comentarios.map((c) => c.fotoId)])];
  const fotos = ids.length
    ? await prisma.fotofficeGaleriaFoto.findMany({ where: { galeriaId, workspaceId, id: { in: ids } }, select: { id: true, fileName: true, thumbKey: true, viewKey: true } })
    : [];
  return { galeria, cliente, fotos, seleccionIds, comentarios };
}

function estadoValido(v: string): EstadoCliente {
  return (ESTADOS_CLIENTE as readonly string[]).includes(v) ? (v as EstadoCliente) : "EN_PROGRESO";
}

/** La pantalla de revisión de un cliente. Null si no existe o no es de este workspace. */
export async function cargarRevisionCliente(ctx: CtxGalerias, galeriaId: unknown, galeriaClienteId: unknown): Promise<RevisionCliente | null> {
  const base = await leerBase(ctx, galeriaId, galeriaClienteId);
  if (!base) return null;
  const { galeria, cliente, comentarios } = base;
  const idsAutores = [...new Set(comentarios.map((c) => c.authorUserId).filter((x): x is number => x !== null))];
  const usuarios = idsAutores.length ? await prisma.user.findMany({ where: { id: { in: idsAutores } }, select: { id: true, name: true, email: true } }) : [];
  const nombreDeUsuario = new Map(usuarios.map((u) => [u.id, u.name?.trim() || u.email || "Estudio"]));
  const urls = await urlsDeLecturaPorLote(base.fotos.map((f) => ({ id: f.id, viewKey: null, thumbKey: f.thumbKey })));

  const porFoto = new Map<string, ComentarioRevision[]>();
  for (const c of comentarios) {
    const autor = c.author === "ESTUDIO" ? "ESTUDIO" : "CLIENTE";
    const lista = porFoto.get(c.fotoId) ?? [];
    lista.push({
      id: c.id, fotoId: c.fotoId, autor, texto: c.body, fecha: c.createdAt.toISOString(),
      nombreAutor: autor === "CLIENTE" ? cliente.name : ((c.authorUserId !== null ? nombreDeUsuario.get(c.authorUserId) : null) ?? "Estudio"),
    });
    porFoto.set(c.fotoId, lista);
  }
  const fotos: FotoRevision[] = ordenarPorNombre(base.fotos).map((f) => ({
    id: f.id,
    fileName: f.fileName,
    thumbUrl: urls.get(f.id)?.thumbUrl ?? null,
    seleccionada: base.seleccionIds.has(f.id),
    comentarios: porFoto.get(f.id) ?? [],
  }));
  const elegidas = fotos.filter((f) => f.seleccionada);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    galeria: { id: galeria.id, numero: galeria.number, nombre: galeria.name, estado: galeria.status as EstadoGaleria, comentarios: galeria.allowComments },
    cliente: {
      id: cliente.id, nombre: cliente.name, email: cliente.email, telefono: cliente.phone, estado: estadoValido(cliente.status),
      anulado: cliente.revokedAt !== null, primeraVez: iso(cliente.firstSeenAt), ultimaVez: iso(cliente.lastSeenAt), enviadoEn: iso(cliente.submittedAt),
      finalizadoEn: iso(cliente.finalizedAt), reactivadoEn: iso(cliente.reopenedAt), mensaje: cliente.submitMessage,
    },
    fotos,
    seleccionadas: elegidas.length,
    conComentarios: fotos.filter((f) => f.comentarios.length > 0).length,
    exportacion: exportarSeleccion(elegidas),
  };
}

/** Las filas del CSV: una por foto elegida, con los comentarios que escribió el cliente (no las respuestas del estudio). */
export async function filasParaCsv(
  ctx: CtxGalerias,
  galeriaId: unknown,
  galeriaClienteId: unknown,
): Promise<{ filas: FilaCsvSeleccion[]; galeriaNumero: string; clienteNombre: string } | null> {
  const base = await leerBase(ctx, galeriaId, galeriaClienteId);
  if (!base) return null;
  const propios = new Map<string, string[]>();
  for (const c of base.comentarios) {
    if (c.author !== "CLIENTE") continue;
    propios.set(c.fotoId, [...(propios.get(c.fotoId) ?? []), c.body]);
  }
  const filas = base.fotos.filter((f) => base.seleccionIds.has(f.id)).map((f) => ({ fileName: f.fileName, comentarios: propios.get(f.id) ?? [] }));
  return { filas, galeriaNumero: base.galeria.number, clienteNombre: base.cliente.name };
}

// --- Responder ---------------------------------------------------------------------------------------

export type ResultadoRespuesta = { ok: true; comentario: ComentarioRevision } | { ok: false; error: string };

/**
 * El estudio responde en la conversación de una foto. La foto tiene que ser de la galería y estar elegida por
 * ese cliente o tener comentarios suyos. Hasta 2.000 caracteres y 300 respuestas por cliente.
 */
export async function responderComentario(
  ctx: CtxGalerias,
  galeriaId: unknown,
  galeriaClienteId: unknown,
  fotoId: unknown,
  texto: unknown,
): Promise<ResultadoRespuesta> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId) || !idValido(galeriaClienteId) || !idValido(fotoId)) return no(M.datosInvalidos);
  const v = validarComentario(texto);
  if (!v.ok) return no(v.error);
  const { workspaceId } = ctx;
  const cliente = await prisma.fotofficeGaleriaCliente.findFirst({ where: { id: galeriaClienteId, galeriaId, workspaceId }, select: { id: true } });
  if (!cliente) return no(M.clienteNoExiste);
  const foto = await prisma.fotofficeGaleriaFoto.findFirst({ where: { id: fotoId, galeriaId, workspaceId }, select: { id: true } });
  if (!foto) return no(M.fotoNoExiste);
  const [elegida, hablo, respuestas] = await Promise.all([
    prisma.fotofficeGaleriaSeleccion.findFirst({ where: { galeriaClienteId, fotoId, workspaceId }, select: { id: true } }),
    prisma.fotofficeGaleriaComentario.findFirst({ where: { galeriaClienteId, fotoId, workspaceId, author: "CLIENTE" }, select: { id: true } }),
    prisma.fotofficeGaleriaComentario.count({ where: { galeriaClienteId, workspaceId, author: "ESTUDIO" } }),
  ]);
  if (!elegida && !hablo) return no(MENSAJES_REVISION.fotoSinRelacion);
  if (respuestas >= MAX_COMENTARIOS_POR_CLIENTE) return no(MENSAJES_REVISION.topeRespuestas);
  try {
    const c = await prisma.fotofficeGaleriaComentario.create({
      data: { workspaceId, galeriaClienteId, fotoId, author: "ESTUDIO", authorUserId: ctx.userId, body: v.texto },
      select: { id: true, createdAt: true },
    });
    return { ok: true, comentario: { id: c.id, fotoId, autor: "ESTUDIO", nombreAutor: ctx.userLabel || "Estudio", texto: v.texto, fecha: c.createdAt.toISOString() } };
  } catch {
    return no(M.guardar);
  }
}

// --- Finalizar y reactivar ----------------------------------------------------------------------------

export type ResultadoTransicion = { ok: true } | { ok: false; error: string };

/** Cierra la selección ya revisada: sólo desde EN_REVISION (escritura condicional, deja constancia en el historial). */
export async function finalizarSeleccion(ctx: CtxGalerias, galeriaId: unknown, galeriaClienteId: unknown, ahora: Date = new Date()): Promise<ResultadoTransicion> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId) || !idValido(galeriaClienteId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx) => {
      const r = await tx.fotofficeGaleriaCliente.updateMany({
        where: { id: galeriaClienteId, galeriaId, workspaceId, status: { in: [...estadosDesde("FINALIZAR")] } },
        data: { status: estadoDespues("FINALIZAR"), finalizedAt: ahora },
      });
      if (r.count !== 1) {
        const existe = await tx.fotofficeGaleriaCliente.findFirst({ where: { id: galeriaClienteId, galeriaId, workspaceId }, select: { id: true } });
        return no(existe ? MENSAJES_REVISION.soloEnRevision : M.clienteNoExiste);
      }
      await registrarEvento(tx, { workspaceId, galeriaId, galeriaClienteId, tipo: "SELECCION_FINALIZADA", actorUserId: ctx.userId });
      return { ok: true as const };
    }, OPCIONES_TRANSACCION);
  } catch {
    return no(M.guardar);
  }
}

/**
 * Le devuelve la selección al cliente para que siga eligiendo: desde EN_REVISION o FINALIZADO a EN_PROGRESO.
 * Conserva lo elegido y lo comentado; anota `reopenedAt`. No manda correo (el estudio puede reenviar el enlace).
 */
export async function reactivarSeleccion(ctx: CtxGalerias, galeriaId: unknown, galeriaClienteId: unknown, ahora: Date = new Date()): Promise<ResultadoTransicion> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId) || !idValido(galeriaClienteId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  const galeria = await prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId }, select: { status: true } });
  if (!galeria) return no(M.noExiste);
  if (galeria.status === "ARCHIVADA") return no(MENSAJES_REVISION.galeriaArchivada);
  try {
    return await prisma.$transaction(async (tx) => {
      const r = await tx.fotofficeGaleriaCliente.updateMany({
        where: { id: galeriaClienteId, galeriaId, workspaceId, revokedAt: null, status: { in: [...estadosDesde("REACTIVAR")] } },
        data: { status: estadoDespues("REACTIVAR"), reopenedAt: ahora, finalizedAt: null },
      });
      if (r.count !== 1) {
        const c = await tx.fotofficeGaleriaCliente.findFirst({ where: { id: galeriaClienteId, galeriaId, workspaceId }, select: { revokedAt: true } });
        if (!c) return no(M.clienteNoExiste);
        return no(c.revokedAt ? MENSAJES_REVISION.clienteAnulado : MENSAJES_REVISION.noReactivable);
      }
      await registrarEvento(tx, { workspaceId, galeriaId, galeriaClienteId, tipo: "SELECCION_REACTIVADA", actorUserId: ctx.userId });
      return { ok: true as const };
    }, OPCIONES_TRANSACCION);
  } catch {
    return no(M.guardar);
  }
}
