import "server-only";
import { prisma } from "@repo/db";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { MENSAJES_GALERIA as M, puedeGestionarGalerias, puedeVerGalerias, type CtxGalerias } from "./acceso";
import { urlsDeLecturaPorLote } from "./almacen";
import { MAX_COMENTARIOS_POR_RONDA, type DecisionAlbum, type EstadoCliente, type EstadoGaleria, type EstadoRonda } from "./constantes";
import { registrarEvento } from "./eventos";
import { ordenarFotosDeGaleria } from "./orden";
import { validarComentario } from "./seleccion";

/**
 * Revisión en el estudio de la prueba de ÁLBUM de un cliente (etapa 7, Entrega C): las láminas de una ronda con los
 * pines del cliente, la conversación de cada pin y los comentarios generales, "Responder", la decisión de la ronda,
 * el historial de decisiones y finalizar / reactivar. Recibe un ctx YA autorizado por quien llama, pero cada función
 * vuelve a exigir el permiso y a acotar TODA consulta al workspace del ctx y a la galería.
 *
 * Convención de las respuestas (la misma que lee el cliente): una respuesta del estudio a un pin es un comentario
 * con autor ESTUDIO, la misma lámina y ronda, y el MISMO `pinNumber`/`pinX`/`pinY` del pin; una respuesta a un
 * comentario general lleva los tres nulos.
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const idValido = (v: unknown): v is string => typeof v === "string" && ID_VALIDO.test(v);
const no = (error: string) => ({ ok: false as const, error });

export const MENSAJES_REVISION_ALBUM = {
  noEsAlbum: "Esta galería no es una prueba de álbum.",
  sinRonda: "El álbum no tiene una ronda abierta.",
  rondaCerrada: "Esa ronda ya está cerrada: sólo se puede mirar.",
  laminaNoExiste: "Esa lámina no está en la ronda abierta de este álbum.",
  pinNoExiste: "No encontramos ese punto en la lámina.",
  sinComentarioGeneral: "El cliente no dejó un comentario general en esa lámina para responderle.",
  topeRespuestas: `Ya hay ${MAX_COMENTARIOS_POR_RONDA} respuestas del estudio para este cliente en esta ronda.`,
  sinAprobacion: "Sólo se puede finalizar si el cliente aprobó el álbum en la ronda actual.",
  noReactivable: "Sólo se puede reactivar una prueba que el cliente ya decidió o que está finalizada.",
  galeriaArchivada: "La galería está archivada: reactivala antes de devolverle la prueba al cliente.",
  clienteAnulado: "El enlace de este cliente está anulado: habilitalo con un enlace nuevo antes de reactivar su prueba.",
  rondaCambio: "El álbum cambió de ronda mientras tanto. Recargá la página.",
} as const;

export type ComentarioAlbum = {
  id: string;
  laminaId: string;
  autor: "CLIENTE" | "ESTUDIO";
  nombreAutor: string;
  texto: string;
  /** ISO. */
  fecha: string;
  pinNumber: number | null;
  pinX: number | null;
  pinY: number | null;
};

export type LaminaRevision = {
  id: string;
  fileName: string;
  thumbUrl: string | null;
  ancho: number | null;
  alto: number | null;
  comentarios: ComentarioAlbum[];
};

export type DecisionVista = { rondaId: string; rondaNumero: number; decision: DecisionAlbum; mensaje: string | null; fecha: string };

export type RevisionAlbum = {
  galeria: { id: string; numero: string; nombre: string; estado: EstadoGaleria };
  cliente: {
    id: string; nombre: string; email: string | null; telefono: string | null; estado: EstadoCliente; anulado: boolean;
    primeraVez: string | null; enviadoEn: string | null; finalizadoEn: string | null; reactivadoEn: string | null;
  };
  rondas: { id: string; numero: number; estado: EstadoRonda }[];
  ronda: { id: string; numero: number; estado: EstadoRonda; nota: string | null };
  laminas: LaminaRevision[];
  /** La decisión del cliente en la ronda que se mira, si ya decidió. */
  decision: DecisionVista | null;
  /** Todas las decisiones del cliente, de la primera ronda a la última. */
  historial: DecisionVista[];
  /** Respuestas del estudio ya escritas en la ronda que se mira (el tope es por ronda). */
  respuestasDelEstudio: number;
};

const estadoCliente = (v: string): EstadoCliente => (v === "EN_REVISION" || v === "FINALIZADO" ? v : "EN_PROGRESO");
const decisionValida = (v: string): DecisionAlbum => (v === "APROBADO" ? "APROBADO" : "CAMBIOS");

/** ¿Es una galería de álbum de este workspace? (La página usa esto para elegir qué pantalla de revisión mostrar.) */
export async function esGaleriaAlbum(ctx: CtxGalerias, galeriaId: unknown): Promise<boolean> {
  if (!puedeVerGalerias(ctx) || !idValido(galeriaId)) return false;
  const g = await prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId: ctx.workspaceId }, select: { kind: true } });
  return g?.kind === "ALBUM";
}

/**
 * La pantalla de revisión de un cliente en una ronda (por omisión, la abierta; si no hay, la última). Null si la
 * galería no es un álbum de este workspace o el cliente no es de esa galería.
 */
export async function cargarRevisionAlbum(ctx: CtxGalerias, galeriaId: unknown, galeriaClienteId: unknown, rondaNumero?: unknown): Promise<RevisionAlbum | null> {
  if (!puedeVerGalerias(ctx) || !idValido(galeriaId) || !idValido(galeriaClienteId)) return null;
  const { workspaceId } = ctx;
  const [galeria, cliente, rondas] = await Promise.all([
    prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId, kind: "ALBUM" }, select: { id: true, number: true, name: true, status: true, orderMode: true } }),
    prisma.fotofficeGaleriaCliente.findFirst({
      where: { id: galeriaClienteId, galeriaId, workspaceId },
      select: { id: true, name: true, email: true, phone: true, status: true, revokedAt: true, firstSeenAt: true, submittedAt: true, finalizedAt: true, reopenedAt: true },
    }),
    prisma.fotofficeGaleriaRonda.findMany({ where: { galeriaId, workspaceId }, orderBy: { number: "asc" }, select: { id: true, number: true, status: true, note: true } }),
  ]);
  if (!galeria || !cliente || rondas.length === 0) return null;
  const pedida = typeof rondaNumero === "number" ? rondaNumero : Number(rondaNumero);
  const mirada = rondas.find((r) => r.number === pedida) ?? rondas.find((r) => r.status === "ABIERTA") ?? rondas[rondas.length - 1]!;

  const [fotos, comentarios, decisiones] = await Promise.all([
    prisma.fotofficeGaleriaFoto.findMany({
      where: { galeriaId, workspaceId, rondaId: mirada.id, status: "LISTA" },
      select: { id: true, fileName: true, order: true, thumbKey: true, width: true, height: true },
    }),
    prisma.fotofficeGaleriaComentario.findMany({
      where: { galeriaClienteId, workspaceId, rondaId: mirada.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, fotoId: true, author: true, authorUserId: true, body: true, createdAt: true, pinNumber: true, pinX: true, pinY: true },
    }),
    prisma.fotofficeGaleriaDecision.findMany({ where: { galeriaClienteId, workspaceId }, select: { rondaId: true, decision: true, message: true, createdAt: true } }),
  ]);
  const idsAutores = [...new Set(comentarios.map((c) => c.authorUserId).filter((x): x is number => x !== null))];
  const usuarios = idsAutores.length ? await prisma.user.findMany({ where: { id: { in: idsAutores } }, select: { id: true, name: true, email: true } }) : [];
  const nombreDeUsuario = new Map(usuarios.map((u) => [u.id, u.name?.trim() || u.email || "Estudio"]));
  const urls = await urlsDeLecturaPorLote(fotos.map((f) => ({ id: f.id, viewKey: null, thumbKey: f.thumbKey })));

  const porLamina = new Map<string, ComentarioAlbum[]>();
  for (const c of comentarios) {
    const autor = c.author === "ESTUDIO" ? "ESTUDIO" : "CLIENTE";
    const lista = porLamina.get(c.fotoId) ?? [];
    lista.push({
      id: c.id, laminaId: c.fotoId, autor, texto: c.body, fecha: c.createdAt.toISOString(),
      nombreAutor: autor === "CLIENTE" ? cliente.name : ((c.authorUserId !== null ? nombreDeUsuario.get(c.authorUserId) : null) ?? "Estudio"),
      pinNumber: c.pinNumber, pinX: c.pinX, pinY: c.pinY,
    });
    porLamina.set(c.fotoId, lista);
  }
  const laminas: LaminaRevision[] = ordenarFotosDeGaleria(fotos, galeria.orderMode === "MANUAL" ? "MANUAL" : "NOMBRE").map((f) => ({
    id: f.id, fileName: f.fileName, thumbUrl: urls.get(f.id)?.thumbUrl ?? null, ancho: f.width, alto: f.height, comentarios: porLamina.get(f.id) ?? [],
  }));

  const numeroDe = new Map(rondas.map((r) => [r.id, r.number]));
  const historial: DecisionVista[] = decisiones
    .filter((d) => numeroDe.has(d.rondaId))
    .map((d) => ({ rondaId: d.rondaId, rondaNumero: numeroDe.get(d.rondaId)!, decision: decisionValida(d.decision), mensaje: d.message, fecha: d.createdAt.toISOString() }))
    .sort((a, b) => a.rondaNumero - b.rondaNumero);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    galeria: { id: galeria.id, numero: galeria.number, nombre: galeria.name, estado: galeria.status as EstadoGaleria },
    cliente: {
      id: cliente.id, nombre: cliente.name, email: cliente.email, telefono: cliente.phone, estado: estadoCliente(cliente.status), anulado: cliente.revokedAt !== null,
      primeraVez: iso(cliente.firstSeenAt), enviadoEn: iso(cliente.submittedAt), finalizadoEn: iso(cliente.finalizedAt), reactivadoEn: iso(cliente.reopenedAt),
    },
    rondas: rondas.map((r) => ({ id: r.id, numero: r.number, estado: r.status === "ABIERTA" ? "ABIERTA" : "CERRADA" })),
    ronda: { id: mirada.id, numero: mirada.number, estado: mirada.status === "ABIERTA" ? "ABIERTA" : "CERRADA", nota: mirada.note },
    laminas,
    decision: historial.find((d) => d.rondaId === mirada.id) ?? null,
    historial,
    respuestasDelEstudio: comentarios.filter((c) => c.author === "ESTUDIO").length,
  };
}

// --- Responder ---------------------------------------------------------------------------------------

export type ResultadoRespuestaAlbum = { ok: true; comentario: ComentarioAlbum } | { ok: false; error: string };

/**
 * El estudio responde en la conversación de una lámina de la ronda ABIERTA. `pinNumber` es el pin al que contesta
 * (la respuesta hereda sus coordenadas) o null para responder a un comentario general. Hasta 2.000 caracteres y 300
 * respuestas del estudio por cliente y ronda.
 */
export async function responderLamina(
  ctx: CtxGalerias,
  galeriaId: unknown,
  galeriaClienteId: unknown,
  fotoId: unknown,
  pinNumber: unknown,
  texto: unknown,
): Promise<ResultadoRespuestaAlbum> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  const pinValido = pinNumber === null || pinNumber === undefined || (typeof pinNumber === "number" && Number.isInteger(pinNumber) && pinNumber >= 1 && pinNumber <= 100000);
  if (!idValido(galeriaId) || !idValido(galeriaClienteId) || !idValido(fotoId) || !pinValido) return no(M.datosInvalidos);
  const v = validarComentario(texto);
  if (!v.ok) return no(v.error);
  const { workspaceId } = ctx;
  const pin = typeof pinNumber === "number" ? pinNumber : null;
  const [galeria, cliente] = await Promise.all([
    prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId, kind: "ALBUM" }, select: { id: true } }),
    prisma.fotofficeGaleriaCliente.findFirst({ where: { id: galeriaClienteId, galeriaId, workspaceId }, select: { id: true } }),
  ]);
  if (!galeria) return no(MENSAJES_REVISION_ALBUM.noEsAlbum);
  if (!cliente) return no(M.clienteNoExiste);
  const ronda = await prisma.fotofficeGaleriaRonda.findFirst({ where: { galeriaId, workspaceId, status: "ABIERTA" }, select: { id: true } });
  if (!ronda) return no(MENSAJES_REVISION_ALBUM.sinRonda);
  const lamina = await prisma.fotofficeGaleriaFoto.findFirst({ where: { id: fotoId, galeriaId, workspaceId, rondaId: ronda.id, status: "LISTA" }, select: { id: true } });
  if (!lamina) return no(MENSAJES_REVISION_ALBUM.laminaNoExiste);

  // El pin tiene que ser de ESTE cliente en ESTA lámina y ronda; el general, un comentario suyo sin pin.
  const origen = await prisma.fotofficeGaleriaComentario.findFirst({
    where: { galeriaClienteId, workspaceId, fotoId, rondaId: ronda.id, author: "CLIENTE", pinNumber: pin },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { pinNumber: true, pinX: true, pinY: true },
  });
  if (!origen) return no(pin === null ? MENSAJES_REVISION_ALBUM.sinComentarioGeneral : MENSAJES_REVISION_ALBUM.pinNoExiste);
  const respuestas = await prisma.fotofficeGaleriaComentario.count({ where: { galeriaClienteId, workspaceId, rondaId: ronda.id, author: "ESTUDIO" } });
  if (respuestas >= MAX_COMENTARIOS_POR_RONDA) return no(MENSAJES_REVISION_ALBUM.topeRespuestas);
  try {
    const c = await prisma.fotofficeGaleriaComentario.create({
      data: {
        workspaceId, galeriaClienteId, fotoId, rondaId: ronda.id, author: "ESTUDIO", authorUserId: ctx.userId, body: v.texto,
        pinNumber: origen.pinNumber, pinX: origen.pinX, pinY: origen.pinY,
      },
      select: { id: true, createdAt: true },
    });
    // Si otra persona abrió una ronda nueva mientras tanto, la respuesta no tiene lugar: se deshace.
    const sigue = await prisma.fotofficeGaleriaRonda.findFirst({ where: { id: ronda.id, workspaceId, status: "ABIERTA" }, select: { id: true } });
    if (!sigue) {
      await prisma.fotofficeGaleriaComentario.deleteMany({ where: { id: c.id, workspaceId } });
      return no(MENSAJES_REVISION_ALBUM.rondaCambio);
    }
    return {
      ok: true,
      comentario: {
        id: c.id, laminaId: fotoId, autor: "ESTUDIO", nombreAutor: ctx.userLabel || "Estudio", texto: v.texto, fecha: c.createdAt.toISOString(),
        pinNumber: origen.pinNumber, pinX: origen.pinX, pinY: origen.pinY,
      },
    };
  } catch {
    return no(M.guardar);
  }
}

// --- Finalizar y reactivar ----------------------------------------------------------------------------

export type ResultadoTransicionAlbum = { ok: true } | { ok: false; error: string };

/**
 * Cierra la prueba de un cliente: sólo si su decisión en la ronda ACTUAL (la abierta) es APROBADO y está EN_REVISION
 * (escritura condicional EN_REVISION → FINALIZADO, con constancia en el historial).
 */
export async function finalizarAlbum(ctx: CtxGalerias, galeriaId: unknown, galeriaClienteId: unknown, ahora: Date = new Date()): Promise<ResultadoTransicionAlbum> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId) || !idValido(galeriaClienteId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx) => {
      const galeria = await tx.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId, kind: "ALBUM" }, select: { id: true } });
      if (!galeria) return no(MENSAJES_REVISION_ALBUM.noEsAlbum);
      const ronda = await tx.fotofficeGaleriaRonda.findFirst({ where: { galeriaId, workspaceId, status: "ABIERTA" }, select: { id: true, number: true } });
      if (!ronda) return no(MENSAJES_REVISION_ALBUM.sinRonda);
      const decision = await tx.fotofficeGaleriaDecision.findFirst({ where: { galeriaClienteId, rondaId: ronda.id, workspaceId }, select: { decision: true } });
      if (decision?.decision !== "APROBADO") return no(MENSAJES_REVISION_ALBUM.sinAprobacion);
      const r = await tx.fotofficeGaleriaCliente.updateMany({
        where: { id: galeriaClienteId, galeriaId, workspaceId, status: "EN_REVISION" },
        data: { status: "FINALIZADO", finalizedAt: ahora },
      });
      if (r.count !== 1) {
        const existe = await tx.fotofficeGaleriaCliente.findFirst({ where: { id: galeriaClienteId, galeriaId, workspaceId }, select: { id: true } });
        return no(existe ? MENSAJES_REVISION_ALBUM.sinAprobacion : M.clienteNoExiste);
      }
      await registrarEvento(tx, { workspaceId, galeriaId, galeriaClienteId, tipo: "ALBUM_FINALIZADO", actorUserId: ctx.userId, data: { ronda: ronda.number } });
      return { ok: true as const };
    }, OPCIONES_TRANSACCION);
  } catch {
    return no(M.guardar);
  }
}

/**
 * Le devuelve la prueba al cliente en la ronda abierta para que decida de nuevo: de EN_REVISION o FINALIZADO a
 * EN_PROGRESO. Conserva sus comentarios, borra su decisión de ESTA ronda (hay una sola por cliente y ronda; queda
 * constancia en el historial con la decisión anterior) y anota `reopenedAt`. No manda correo.
 */
export async function reactivarAlbum(ctx: CtxGalerias, galeriaId: unknown, galeriaClienteId: unknown, ahora: Date = new Date()): Promise<ResultadoTransicionAlbum> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId) || !idValido(galeriaClienteId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  const galeria = await prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId, kind: "ALBUM" }, select: { status: true } });
  if (!galeria) return no(MENSAJES_REVISION_ALBUM.noEsAlbum);
  if (galeria.status === "ARCHIVADA") return no(MENSAJES_REVISION_ALBUM.galeriaArchivada);
  try {
    return await prisma.$transaction(async (tx) => {
      const ronda = await tx.fotofficeGaleriaRonda.findFirst({ where: { galeriaId, workspaceId, status: "ABIERTA" }, select: { id: true, number: true } });
      if (!ronda) return no(MENSAJES_REVISION_ALBUM.sinRonda);
      const r = await tx.fotofficeGaleriaCliente.updateMany({
        where: { id: galeriaClienteId, galeriaId, workspaceId, revokedAt: null, status: { in: ["EN_REVISION", "FINALIZADO"] } },
        data: { status: "EN_PROGRESO", reopenedAt: ahora, finalizedAt: null },
      });
      if (r.count !== 1) {
        const c = await tx.fotofficeGaleriaCliente.findFirst({ where: { id: galeriaClienteId, galeriaId, workspaceId }, select: { revokedAt: true } });
        if (!c) return no(M.clienteNoExiste);
        return no(c.revokedAt ? MENSAJES_REVISION_ALBUM.clienteAnulado : MENSAJES_REVISION_ALBUM.noReactivable);
      }
      const anterior = await tx.fotofficeGaleriaDecision.findFirst({ where: { galeriaClienteId, rondaId: ronda.id, workspaceId }, select: { decision: true } });
      await tx.fotofficeGaleriaDecision.deleteMany({ where: { galeriaClienteId, rondaId: ronda.id, workspaceId } });
      await registrarEvento(tx, {
        workspaceId, galeriaId, galeriaClienteId, tipo: "ALBUM_REACTIVADO", actorUserId: ctx.userId,
        data: { ronda: ronda.number, decisionAnterior: anterior?.decision ?? null },
      });
      return { ok: true as const };
    }, OPCIONES_TRANSACCION);
  } catch {
    return no(M.guardar);
  }
}

// --- Resumen de la galería ----------------------------------------------------------------------------

export type ResumenRondaAlbum = {
  numero: number;
  estado: EstadoRonda;
  aprobaron: number;
  pidieronCambios: number;
  pendientes: number;
  /** Láminas con comentarios de clientes en esa ronda, con quién comentó (para ir directo a su revisión). */
  laminasConComentarios: { id: string; fileName: string; comentarios: number; clientes: { id: string; nombre: string; comentarios: number }[] }[];
};

/**
 * Por ronda: cuántos clientes aprobaron, pidieron cambios o no decidieron, y las láminas con comentarios. Los
 * clientes con el enlace anulado no cuentan; en una ronda cerrada sólo cuentan los que ya existían al cerrarla.
 */
export async function resumenDeAlbum(ctx: CtxGalerias, galeriaId: unknown): Promise<ResumenRondaAlbum[]> {
  if (!puedeVerGalerias(ctx) || !idValido(galeriaId)) return [];
  const { workspaceId } = ctx;
  const galeria = await prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId, kind: "ALBUM" }, select: { id: true } });
  if (!galeria) return [];
  const rondas = await prisma.fotofficeGaleriaRonda.findMany({ where: { galeriaId, workspaceId }, orderBy: { number: "asc" }, select: { id: true, number: true, status: true, closedAt: true } });
  if (rondas.length === 0) return [];
  const ids = rondas.map((r) => r.id);
  const clientes = await prisma.fotofficeGaleriaCliente.findMany({ where: { galeriaId, workspaceId, revokedAt: null }, select: { id: true, name: true, createdAt: true } });
  const idsClientes = clientes.map((c) => c.id);
  const [decisiones, comentarios] = await Promise.all([
    prisma.fotofficeGaleriaDecision.findMany({ where: { workspaceId, rondaId: { in: ids }, galeriaClienteId: { in: idsClientes } }, select: { rondaId: true, galeriaClienteId: true, decision: true } }),
    prisma.fotofficeGaleriaComentario.findMany({
      where: { workspaceId, rondaId: { in: ids }, galeriaClienteId: { in: idsClientes }, author: "CLIENTE" },
      select: { rondaId: true, galeriaClienteId: true, fotoId: true },
    }),
  ]);
  const fotoIds = [...new Set(comentarios.map((c) => c.fotoId))];
  const fotos = fotoIds.length ? await prisma.fotofficeGaleriaFoto.findMany({ where: { workspaceId, galeriaId, id: { in: fotoIds } }, select: { id: true, fileName: true } }) : [];
  const nombreFoto = new Map(fotos.map((f) => [f.id, f.fileName]));
  const nombreCliente = new Map(clientes.map((c) => [c.id, c.name]));

  return rondas.map((r) => {
    const deRonda = decisiones.filter((d) => d.rondaId === r.id);
    const decidieron = new Set(deRonda.map((d) => d.galeriaClienteId));
    const pendientes = clientes.filter((c) => !decidieron.has(c.id) && (r.closedAt === null || c.createdAt <= r.closedAt)).length;
    const aprobaron = deRonda.filter((d) => d.decision === "APROBADO").length;
    const pidieronCambios = deRonda.filter((d) => d.decision === "CAMBIOS").length;
    const porLamina = new Map<string, Map<string, number>>();
    for (const c of comentarios) {
      if (c.rondaId !== r.id || !nombreFoto.has(c.fotoId)) continue;
      const m = porLamina.get(c.fotoId) ?? new Map<string, number>();
      m.set(c.galeriaClienteId, (m.get(c.galeriaClienteId) ?? 0) + 1);
      porLamina.set(c.fotoId, m);
    }
    const laminasConComentarios = [...porLamina.entries()]
      .map(([id, m]) => ({
        id,
        fileName: nombreFoto.get(id) ?? "",
        comentarios: [...m.values()].reduce((a, b) => a + b, 0),
        clientes: [...m.entries()].map(([cid, n]) => ({ id: cid, nombre: nombreCliente.get(cid) ?? "Cliente", comentarios: n })),
      }))
      .sort((a, b) => b.comentarios - a.comentarios || a.fileName.localeCompare(b.fileName, "es", { numeric: true }));
    return {
      numero: r.number,
      estado: r.status === "ABIERTA" ? ("ABIERTA" as const) : ("CERRADA" as const),
      aprobaron,
      pidieronCambios,
      pendientes,
      laminasConComentarios,
    };
  });
}
