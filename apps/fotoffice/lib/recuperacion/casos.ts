import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma, prisma } from "@repo/db";
import { checkRateLimit } from "@/lib/geocode/rate-limit";
import { borrarArchivoGuardado, urlDeLecturaArchivo, urlDeSubidaArchivo } from "@/lib/carpetas/almacen";
import {
  DIAS_VIGENCIA_CODIGO,
  ESTADOS_RECUPERACION,
  MAX_ARCHIVOS_POR_CASO,
  MAX_ARCHIVOS_POR_PEDIDO,
  codigoDesdeBytes,
  normalizarCodigo,
  validarArchivoEntrante,
  type EstadoRecuperacion,
} from "./constantes";

/**
 * Casos de recuperación de tarjetas y la API que usa el programa de escritorio
 * (`tools/recuperador-tarjetas`). El programa se vincula con el código del caso, recibe un token
 * que sólo sirve para ESE caso (en la base vive su hash) y con él informa el avance y los archivos.
 * Las miniaturas van al bucket privado con un enlace firmado; nunca por la dirección pública.
 */

const PREFIJO_TOKEN = "fo_rec_";
const FORMATO_TOKEN = /^fo_rec_[A-Za-z0-9_-]{43}$/;
const MINUTO = 60_000;

export const MENSAJES_RECUPERACION = {
  codigo: "Ese código no existe o ya venció. Pedile al estudio un código nuevo.",
  usado: "Ese código ya se usó en otra computadora. Pedile al estudio que abra un caso nuevo.",
  token: "El programa perdió la conexión con el caso. Volvé a empezar con el código.",
  cerrado: "El estudio cerró este caso.",
  datos: "Los datos no son válidos.",
  freno: "Demasiados intentos seguidos. Esperá un minuto y reintentá.",
  tope: "El caso llegó al máximo de archivos que se pueden mostrar.",
  error: "No pudimos completar el pedido. Reintentá en un momento.",
} as const;

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function respuesta(cuerpo: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(cuerpo, { status, headers: { ...NO_STORE, ...headers } });
}
export const fallo = (error: string, status: number, headers: Record<string, string> = {}) => respuesta({ error }, status, headers);

export function hashDeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function leerJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await request.json();
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function ipDe(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "sin-ip";
}

function frenado(clave: string, limite: number): NextResponse | null {
  const f = checkRateLimit({ key: clave, limit: limite, windowMs: MINUTO });
  if (f.allowed) return null;
  const espera = Math.max(1, Math.ceil((f.resetAt - Date.now()) / 1000));
  return fallo(MENSAJES_RECUPERACION.freno, 429, { "Retry-After": String(espera) });
}

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return s ? s.slice(0, max) : null;
};
const entero = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

// --- crear (desde el panel) ---------------------------------------------------------------------

export async function crearCaso(params: { workspaceId: string; userId: number; titulo: string; notas: string | null }) {
  const codigoVenceAt = new Date(Date.now() + DIAS_VIGENCIA_CODIGO * 24 * 60 * MINUTO);
  // Un choque de código es improbable (31^8), pero si pasa se prueba con otro.
  for (let intento = 0; intento < 5; intento++) {
    try {
      return await prisma.fotofficeRecuperacion.create({
        data: {
          workspaceId: params.workspaceId,
          createdByUserId: params.userId,
          titulo: params.titulo,
          notas: params.notas,
          codigo: codigoDesdeBytes(randomBytes(8)),
          codigoVenceAt,
        },
        select: { id: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("No se pudo generar un código único");
}

/** Borra el caso, sus archivos y las miniaturas guardadas. */
export async function borrarCaso(workspaceId: string, id: string): Promise<boolean> {
  const caso = await prisma.fotofficeRecuperacion.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!caso) return false;
  for (let desde = 0; ; ) {
    const filas = await prisma.fotofficeRecuperacionArchivo.findMany({
      where: { recuperacionId: id, miniaturaKey: { not: null } },
      select: { id: true, miniaturaKey: true },
      orderBy: { id: "asc" },
      take: 200,
      skip: desde,
    });
    if (filas.length === 0) break;
    await Promise.all(filas.map((f) => (f.miniaturaKey ? borrarArchivoGuardado(f.miniaturaKey).catch(() => undefined) : undefined)));
    desde += filas.length;
  }
  await prisma.fotofficeRecuperacion.delete({ where: { id } });
  return true;
}

function claveMiniatura(workspaceId: string, casoId: string, indice: number): string {
  return `fotoffice/recuperacion/${workspaceId}/${casoId}/${indice}.jpg`;
}

export async function urlsDeMiniaturas(claves: { id: string; miniaturaKey: string | null }[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    claves.map(async (c) => {
      if (c.miniaturaKey) out[c.id] = await urlDeLecturaArchivo(c.miniaturaKey, "miniatura.jpg", "ver");
    }),
  );
  return out;
}

// --- API del programa -----------------------------------------------------------------------------

type CtxCaso = { id: string; workspaceId: string; estado: string; encontrados: number };

async function autorizar(request: Request): Promise<{ caso: CtxCaso } | { respuesta: NextResponse }> {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization")?.trim() ?? "");
  if (!m || !FORMATO_TOKEN.test(m[1])) return { respuesta: fallo(MENSAJES_RECUPERACION.token, 401) };
  const caso = await prisma.fotofficeRecuperacion.findUnique({
    where: { tokenHash: hashDeToken(m[1]) },
    select: { id: true, workspaceId: true, estado: true, encontrados: true },
  });
  if (!caso) return { respuesta: fallo(MENSAJES_RECUPERACION.cerrado, 401) };
  const f = frenado(`recuperacion:${caso.id}`, 240);
  if (f) return { respuesta: f };
  return { caso };
}

/** POST /api/recuperacion/vincular — código → token. Un código sirve para una sola computadora. */
export async function vincular(request: Request): Promise<NextResponse> {
  const f = frenado(`recuperacion-vincular:${ipDe(request)}`, 20);
  if (f) return f;
  const cuerpo = await leerJson(request);
  const codigo = normalizarCodigo(cuerpo?.codigo);
  if (!codigo) return fallo(MENSAJES_RECUPERACION.codigo, 404);
  const caso = await prisma.fotofficeRecuperacion.findUnique({
    where: { codigo },
    select: { id: true, titulo: true, tokenHash: true, codigoVenceAt: true, workspace: { select: { name: true } } },
  });
  if (!caso || caso.codigoVenceAt < new Date()) return fallo(MENSAJES_RECUPERACION.codigo, 404);
  if (caso.tokenHash) return fallo(MENSAJES_RECUPERACION.usado, 409);

  const token = `${PREFIJO_TOKEN}${randomBytes(32).toString("base64url")}`;
  // Condicional: si dos computadoras usan el código a la vez, gana una sola.
  const r = await prisma.fotofficeRecuperacion.updateMany({
    where: { id: caso.id, tokenHash: null },
    data: {
      tokenHash: hashDeToken(token),
      vinculadoAt: new Date(),
      ultimaSenalAt: new Date(),
      equipo: texto(cuerpo?.equipo, 80),
      versionPrograma: texto(cuerpo?.version, 20),
    },
  });
  if (r.count !== 1) return fallo(MENSAJES_RECUPERACION.usado, 409);
  return respuesta({ casoId: caso.id, token, estudio: caso.workspace.name, titulo: caso.titulo });
}

/** POST /api/recuperacion/estado — avance de la lectura. */
export async function informarEstado(request: Request): Promise<NextResponse> {
  const a = await autorizar(request);
  if ("respuesta" in a) return a.respuesta;
  const cuerpo = await leerJson(request);
  const estado = cuerpo?.estado as EstadoRecuperacion;
  if (!cuerpo || !(ESTADOS_RECUPERACION as readonly string[]).includes(estado) || estado === "ESPERANDO") {
    return fallo(MENSAJES_RECUPERACION.datos, 400);
  }
  const ahora = new Date();
  await prisma.fotofficeRecuperacion.update({
    where: { id: a.caso.id },
    data: {
      estado,
      dispositivo: texto(cuerpo.dispositivo, 120) ?? undefined,
      equipo: texto(cuerpo.equipo, 80) ?? undefined,
      bytesTotales: BigInt(entero(cuerpo.bytesTotales)),
      bytesLeidos: BigInt(entero(cuerpo.bytesLeidos)),
      sectoresMalos: BigInt(entero(cuerpo.sectoresMalos)),
      mensaje: texto(cuerpo.mensaje, 300),
      ultimaSenalAt: ahora,
      ...(estado === "TERMINADO" || estado === "ERROR" ? { terminadoAt: ahora } : { terminadoAt: null }),
    },
  });
  return respuesta({ ok: true });
}

/**
 * POST /api/recuperacion/archivos — hasta 50 archivos por pedido. Devuelve, para los que traen
 * miniatura, un enlace firmado de subida al bucket privado (con tamaño y tipo fijos).
 */
export async function informarArchivos(request: Request): Promise<NextResponse> {
  const a = await autorizar(request);
  if ("respuesta" in a) return a.respuesta;
  const cuerpo = await leerJson(request);
  const lista = cuerpo && Array.isArray(cuerpo.archivos) ? (cuerpo.archivos as unknown[]) : null;
  if (!lista || lista.length === 0 || lista.length > MAX_ARCHIVOS_POR_PEDIDO) return fallo(MENSAJES_RECUPERACION.datos, 400);
  const archivos = lista.map(validarArchivoEntrante).filter((x): x is NonNullable<typeof x> => x !== null);
  if (a.caso.encontrados + archivos.length > MAX_ARCHIVOS_POR_CASO) return fallo(MENSAJES_RECUPERACION.tope, 409);

  try {
    const filas = archivos.map((x) => ({
      recuperacionId: a.caso.id,
      indice: x.indice,
      tipo: x.tipo,
      extension: x.extension,
      tamanio: BigInt(x.tamanio),
      offset: BigInt(x.offset),
      ancho: x.ancho,
      alto: x.alto,
      fechaToma: x.fechaToma,
      camara: x.camara,
      nombreLocal: x.nombreLocal,
      miniaturaKey: x.bytesMiniatura ? claveMiniatura(a.caso.workspaceId, a.caso.id, x.indice) : null,
    }));
    // Un reintento del programa manda la misma tanda: los repetidos se ignoran.
    const creados = await prisma.fotofficeRecuperacionArchivo.createMany({ data: filas, skipDuplicates: true });
    const total = await prisma.fotofficeRecuperacionArchivo.count({ where: { recuperacionId: a.caso.id } });
    await prisma.fotofficeRecuperacion.update({ where: { id: a.caso.id }, data: { encontrados: total, ultimaSenalAt: new Date() } });

    const subidas = await Promise.all(
      archivos
        .filter((x) => x.bytesMiniatura)
        .map(async (x) => ({
          indice: x.indice,
          url: await urlDeSubidaArchivo(claveMiniatura(a.caso.workspaceId, a.caso.id, x.indice), "image/jpeg", x.bytesMiniatura!),
        })),
    );
    return respuesta({ recibidos: creados.count, subidas });
  } catch {
    return fallo(MENSAJES_RECUPERACION.error, 503);
  }
}
