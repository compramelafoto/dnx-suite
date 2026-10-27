import "server-only";
import { createHmac } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import type { SuscriptorParaExportar, EnvioParaExportar } from "./formularios-csv";
import { paresDeJson, type ContactoEnvio, type EstadoEnvio, type ParEnvio } from "./formularios";

/**
 * Formularios propios del sitio, del lado del servidor: guardar envíos y suscriptores y leer la
 * bandeja (Sitio web → Formularios). Las tablas se crean con SQL a mano: si todavía no existen,
 * Prisma avisa P2021 y acá se devuelve `null` (la bandeja lo dice; el sitio responde «no
 * disponible»), nunca se rompe una página.
 */

export function esTablaFaltante(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2021";
}

/**
 * Huella de la IP: HMAC-SHA256 con un secreto del servidor y el workspace. Nunca se guarda la IP
 * cruda; la huella sirve para ver si muchos envíos vienen del mismo lado. Sin secreto configurado
 * (`FOTOFFICE_SITIO_IP_SECRET` o `CRON_SECRET`) no se guarda huella: con una clave fija se podría
 * revertir probando todas las IP.
 */
export function huellaIp(ip: string | null, workspaceId: string): string | null {
  if (!ip || ip === "desconocido") return null;
  const secreto = process.env.FOTOFFICE_SITIO_IP_SECRET || process.env.CRON_SECRET;
  if (!secreto) return null;
  return createHmac("sha256", secreto).update(`${workspaceId}:${ip}`).digest("hex").slice(0, 32);
}

export const ORIGEN_SITIO = "SITIO";
export const ORIGEN_IMPORTADO_PROSITE = "IMPORTADO_PROSITE";

type Db = Prisma.TransactionClient | typeof prisma;

/** El formulario de una clave (lo crea la primera vez; el nombre sigue al título del bloque). */
export async function asegurarFormulario(db: Db, workspaceId: string, clave: string, nombre: string, origen: string): Promise<string> {
  const nombreLimpio = nombre.trim().slice(0, 200) || "Formulario";
  const fila = await db.fotofficeSitioFormulario.upsert({
    where: { workspaceId_clave: { workspaceId, clave } },
    create: { workspaceId, clave, nombre: nombreLimpio, origen },
    update: { nombre: nombreLimpio },
    select: { id: true },
  });
  return fila.id;
}

export async function guardarEnvio(args: {
  workspaceId: string;
  clave: string;
  nombreFormulario: string;
  pares: ParEnvio[];
  contacto: ContactoEnvio;
  paginaUrl: string | null;
  ipHash: string | null;
}): Promise<string> {
  const formularioId = await asegurarFormulario(prisma, args.workspaceId, args.clave, args.nombreFormulario, ORIGEN_SITIO);
  const envio = await prisma.fotofficeSitioFormularioEnvio.create({
    data: {
      workspaceId: args.workspaceId,
      formularioId,
      datosJson: args.pares as unknown as Prisma.InputJsonValue,
      nombre: args.contacto.nombre,
      email: args.contacto.email,
      telefono: args.contacto.telefono,
      paginaUrl: args.paginaUrl,
      ipHash: args.ipHash,
    },
    select: { id: true },
  });
  return envio.id;
}

export async function vincularConsulta(workspaceId: string, envioId: string, consultaId: string): Promise<void> {
  await prisma.fotofficeSitioFormularioEnvio.updateMany({ where: { id: envioId, workspaceId }, data: { consultaId } });
}

/**
 * Alta idempotente en el boletín: un correo ya suscripto queda igual (se completa el nombre si
 * faltaba); uno dado de baja vuelve a activo porque la persona se volvió a anotar.
 */
export async function suscribir(workspaceId: string, email: string, nombre: string | null): Promise<void> {
  const existente = await prisma.fotofficeSitioSuscriptor.findUnique({
    where: { workspaceId_email: { workspaceId, email } },
    select: { id: true, nombre: true, estado: true },
  });
  if (!existente) {
    try {
      await prisma.fotofficeSitioSuscriptor.create({ data: { workspaceId, email, nombre, origen: ORIGEN_SITIO } });
      return;
    } catch (err) {
      // Dos altas del mismo correo a la vez: la otra ganó, y eso ya es lo que se quería.
      if ((err as { code?: unknown })?.code === "P2002") return;
      throw err;
    }
  }
  const data: Prisma.FotofficeSitioSuscriptorUpdateInput = {};
  if (existente.estado !== "ACTIVO") data.estado = "ACTIVO";
  if (!existente.nombre && nombre) data.nombre = nombre;
  if (Object.keys(data).length > 0) await prisma.fotofficeSitioSuscriptor.update({ where: { id: existente.id }, data });
}

// ── Bandeja ─────────────────────────────────────────────────────────────────────────────────

export const ENVIOS_POR_PAGINA = 50;
export const SUSCRIPTORES_POR_PAGINA = 100;
/** Tope de filas de una exportación (DNX trae ~10.000 envíos de Prosite). */
export const TOPE_EXPORTACION = 50000;

export type FormularioResumen = { id: string; nombre: string; origen: string; total: number; nuevos: number; ultimo: Date | null };

/** Los formularios con su cantidad de envíos y de nuevos. `null` = faltan las tablas. */
export async function resumenFormularios(workspaceId: string): Promise<FormularioResumen[] | null> {
  try {
    const [formularios, totales, nuevos] = await Promise.all([
      prisma.fotofficeSitioFormulario.findMany({
        where: { workspaceId },
        select: { id: true, nombre: true, origen: true },
        take: 500,
      }),
      prisma.fotofficeSitioFormularioEnvio.groupBy({
        by: ["formularioId"],
        where: { workspaceId },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.fotofficeSitioFormularioEnvio.groupBy({
        by: ["formularioId"],
        where: { workspaceId, estado: "NUEVO" },
        _count: { _all: true },
      }),
    ]);
    const total = new Map(totales.map((t) => [t.formularioId, t]));
    const nuevo = new Map(nuevos.map((n) => [n.formularioId, n._count._all]));
    return formularios
      .map((f) => ({
        ...f,
        total: total.get(f.id)?._count._all ?? 0,
        nuevos: nuevo.get(f.id) ?? 0,
        ultimo: total.get(f.id)?._max.createdAt ?? null,
      }))
      .sort((a, b) => (b.ultimo?.getTime() ?? 0) - (a.ultimo?.getTime() ?? 0) || a.nombre.localeCompare(b.nombre, "es"));
  } catch (err) {
    if (esTablaFaltante(err)) return null;
    throw err;
  }
}

export type FiltroEnvios = { formularioId?: string | null; estado?: EstadoEnvio | "TODOS" | null; q?: string | null };

function whereEnvios(workspaceId: string, f: FiltroEnvios): Prisma.FotofficeSitioFormularioEnvioWhereInput {
  const where: Prisma.FotofficeSitioFormularioEnvioWhereInput = { workspaceId };
  if (f.formularioId) where.formularioId = f.formularioId;
  // Por omisión, la bandeja muestra lo que no está archivado.
  if (f.estado && f.estado !== "TODOS") where.estado = f.estado;
  else if (!f.estado) where.estado = { in: ["NUEVO", "LEIDO"] };
  const q = f.q?.trim().slice(0, 100);
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { telefono: { contains: q } },
    ];
  }
  return where;
}

export type EnvioDeLista = {
  id: string;
  formularioId: string;
  formulario: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  estado: string;
  createdAt: Date;
  resumen: string;
};

export async function listarEnvios(
  workspaceId: string,
  filtro: FiltroEnvios,
  pagina: number,
): Promise<{ filas: EnvioDeLista[]; total: number } | null> {
  try {
    const where = whereEnvios(workspaceId, filtro);
    const [filas, total] = await Promise.all([
      prisma.fotofficeSitioFormularioEnvio.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: Math.max(0, pagina - 1) * ENVIOS_POR_PAGINA,
        take: ENVIOS_POR_PAGINA,
        select: {
          id: true,
          formularioId: true,
          nombre: true,
          email: true,
          telefono: true,
          estado: true,
          createdAt: true,
          datosJson: true,
          formulario: { select: { nombre: true } },
        },
      }),
      prisma.fotofficeSitioFormularioEnvio.count({ where }),
    ]);
    return {
      total,
      filas: filas.map((f) => ({
        id: f.id,
        formularioId: f.formularioId,
        formulario: f.formulario.nombre,
        nombre: f.nombre,
        email: f.email,
        telefono: f.telefono,
        estado: f.estado,
        createdAt: f.createdAt,
        resumen: resumenDePares(paresDeJson(f.datosJson), f),
      })),
    };
  } catch (err) {
    if (esTablaFaltante(err)) return null;
    throw err;
  }
}

/** Una línea para la lista: los datos que no son nombre/correo/teléfono, recortados. */
function resumenDePares(pares: ParEnvio[], contacto: { nombre: string | null; email: string | null; telefono: string | null }): string {
  const ya = new Set([contacto.nombre, contacto.email, contacto.telefono].filter(Boolean));
  return pares
    .filter((p) => !ya.has(p.valor) && !ya.has(p.valor.toLowerCase()))
    .map((p) => p.valor)
    .join(" · ")
    .slice(0, 160);
}

export type EnvioDetalle = EnvioDeLista & { pares: ParEnvio[]; paginaUrl: string | null; consultaId: string | null };

export async function detalleEnvio(workspaceId: string, id: string): Promise<EnvioDetalle | null> {
  try {
    const f = await prisma.fotofficeSitioFormularioEnvio.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        formularioId: true,
        nombre: true,
        email: true,
        telefono: true,
        estado: true,
        createdAt: true,
        datosJson: true,
        paginaUrl: true,
        consultaId: true,
        formulario: { select: { nombre: true } },
      },
    });
    if (!f) return null;
    const pares = paresDeJson(f.datosJson);
    return {
      id: f.id,
      formularioId: f.formularioId,
      formulario: f.formulario.nombre,
      nombre: f.nombre,
      email: f.email,
      telefono: f.telefono,
      estado: f.estado,
      createdAt: f.createdAt,
      resumen: "",
      pares,
      paginaUrl: f.paginaUrl,
      consultaId: f.consultaId,
    };
  } catch (err) {
    if (esTablaFaltante(err)) return null;
    throw err;
  }
}

/** Cambia el estado de uno o varios envíos del workspace. Devuelve cuántos cambió. */
export async function cambiarEstadoEnvios(workspaceId: string, ids: string[], estado: EstadoEnvio): Promise<number> {
  if (ids.length === 0) return 0;
  const r = await prisma.fotofficeSitioFormularioEnvio.updateMany({ where: { workspaceId, id: { in: ids.slice(0, 500) } }, data: { estado } });
  return r.count;
}

/** Abrir un envío nuevo lo marca leído. */
export async function marcarLeidoSiNuevo(workspaceId: string, id: string): Promise<void> {
  await prisma.fotofficeSitioFormularioEnvio.updateMany({ where: { workspaceId, id, estado: "NUEVO" }, data: { estado: "LEIDO" } });
}

export type SuscriptorDeLista = { id: string; email: string; nombre: string | null; estado: string; origen: string; createdAt: Date };

export async function listarSuscriptores(
  workspaceId: string,
  filtro: { estado?: "ACTIVO" | "BAJA" | "TODOS" | null; q?: string | null },
  pagina: number,
): Promise<{ filas: SuscriptorDeLista[]; total: number; activos: number } | null> {
  try {
    const where: Prisma.FotofficeSitioSuscriptorWhereInput = { workspaceId };
    if (filtro.estado === "ACTIVO" || filtro.estado === "BAJA") where.estado = filtro.estado;
    const q = filtro.q?.trim().slice(0, 100);
    if (q) where.OR = [{ email: { contains: q, mode: "insensitive" } }, { nombre: { contains: q, mode: "insensitive" } }];
    const [filas, total, activos] = await Promise.all([
      prisma.fotofficeSitioSuscriptor.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: Math.max(0, pagina - 1) * SUSCRIPTORES_POR_PAGINA,
        take: SUSCRIPTORES_POR_PAGINA,
        select: { id: true, email: true, nombre: true, estado: true, origen: true, createdAt: true },
      }),
      prisma.fotofficeSitioSuscriptor.count({ where }),
      prisma.fotofficeSitioSuscriptor.count({ where: { workspaceId, estado: "ACTIVO" } }),
    ]);
    return { filas, total, activos };
  } catch (err) {
    if (esTablaFaltante(err)) return null;
    throw err;
  }
}

export async function cambiarEstadoSuscriptor(workspaceId: string, id: string, estado: "ACTIVO" | "BAJA"): Promise<boolean> {
  const r = await prisma.fotofficeSitioSuscriptor.updateMany({ where: { workspaceId, id }, data: { estado } });
  return r.count > 0;
}

/** Los envíos a exportar (de un formulario o de todos), de a tandas, hasta `TOPE_EXPORTACION`. */
export async function enviosParaExportar(workspaceId: string, formularioId: string | null): Promise<EnvioParaExportar[]> {
  const out: EnvioParaExportar[] = [];
  let cursor: string | undefined;
  while (out.length < TOPE_EXPORTACION) {
    const tanda = await prisma.fotofficeSitioFormularioEnvio.findMany({
      where: { workspaceId, ...(formularioId ? { formularioId } : {}) },
      orderBy: { id: "asc" },
      take: 2000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, createdAt: true, estado: true, paginaUrl: true, datosJson: true, formulario: { select: { nombre: true } } },
    });
    if (tanda.length === 0) break;
    for (const e of tanda) {
      out.push({ createdAt: e.createdAt, formulario: e.formulario.nombre, estado: e.estado, paginaUrl: e.paginaUrl, pares: paresDeJson(e.datosJson) });
    }
    cursor = tanda[tanda.length - 1].id;
    if (tanda.length < 2000) break;
  }
  // Del más reciente al más viejo, como en la bandeja.
  return out.slice(0, TOPE_EXPORTACION).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function suscriptoresParaExportar(workspaceId: string): Promise<SuscriptorParaExportar[]> {
  return prisma.fotofficeSitioSuscriptor.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: TOPE_EXPORTACION,
    select: { email: true, nombre: true, estado: true, origen: true, createdAt: true },
  });
}

export async function nombreDelFormulario(workspaceId: string, id: string): Promise<string | null> {
  const f = await prisma.fotofficeSitioFormulario.findFirst({ where: { id, workspaceId }, select: { nombre: true } });
  return f?.nombre ?? null;
}
