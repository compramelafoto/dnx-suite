import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { hashDeToken, resolverClaveDeEnlace, tokenConForma } from "@/lib/presupuestos/enlace";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { MENSAJES_PROYECTO, puedeGestionarProyectos, type CtxProyectos } from "@/lib/proyectos/acceso";
import { borrarArchivoGuardado, tamanoDeArchivo, urlDeLecturaArchivo, urlDeSubidaArchivo } from "./almacen";
import {
  MAX_ARCHIVOS_CARPETA,
  MAX_BYTES_ARCHIVO,
  claveDeArchivo,
  esVideo,
  limpiarNombreArchivo,
  nuevoVencimiento,
  tipoDeArchivo,
  type Audiencia,
} from "./reglas";

/**
 * La carpeta de un trabajo: subir y borrar archivos, y los dos enlaces privados (laboratorio y
 * cliente). El token de cada enlace se rehace con HMAC desde su fecha de emisión (como las
 * galerías): la base guarda sólo el hash, para encontrarlo cuando alguien lo abre.
 */

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const PREFIJO = "fotoffice-carpeta:v1:";

import type { ArchivoVista, VistaCarpeta } from "./tipos";
export type { ArchivoVista, VistaCarpeta };

function tokenDe(proyectoId: string, audiencia: Audiencia, emitida: Date, clave: string): string {
  return createHmac("sha256", clave).update(`${PREFIJO}${proyectoId}:${audiencia}:${emitida.toISOString()}`).digest("base64url");
}

function origen(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
}

async function urlDe(workspaceId: string, token: string): Promise<string | null> {
  const sitio = await sitioDelWorkspace(workspaceId);
  if (!sitio) return null;
  const ruta = `/archivos/${encodeURIComponent(token)}`;
  if (sitio.customDomain) return `https://${sitio.customDomain}${ruta}`;
  const o = origen();
  if (!o || !sitio.slug) return null;
  return `${o}/w/${encodeURIComponent(sitio.slug)}${ruta}`;
}

async function proyectoPropio(ctx: CtxProyectos, proyectoId: unknown) {
  if (typeof proyectoId !== "string" || !ID.test(proyectoId)) return null;
  return prisma.fotofficeProyecto.findFirst({
    where: { id: proyectoId, workspaceId: ctx.workspaceId },
    select: { id: true, carpetaClienteEmitida: true, carpetaLabEmitida: true, carpetaVence: true },
  });
}

export async function listarArchivos(ctx: CtxProyectos, proyectoId: string): Promise<ArchivoVista[]> {
  const filas = await prisma.fotofficeArchivoTrabajo.findMany({
    where: { workspaceId: ctx.workspaceId, proyectoId, estado: "LISTO" },
    orderBy: { createdAt: "asc" },
    select: { id: true, nombre: true, tipo: true, bytes: true, createdAt: true },
  });
  return filas.map((f) => ({ ...f, bytes: Number(f.bytes), createdAt: f.createdAt.toISOString() }));
}

export type ResultadoSubida = { ok: true; archivoId: string; url: string; tipo: string } | { ok: false; error: string };

/** Anota el archivo y devuelve la URL firmada para subirlo directo a R2 desde el navegador. */
export async function pedirSubida(ctx: CtxProyectos, proyectoId: unknown, nombreRaw: unknown, tipoRaw: unknown, bytesRaw: unknown): Promise<ResultadoSubida> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  const p = await proyectoPropio(ctx, proyectoId);
  if (!p) return { ok: false, error: MENSAJES_PROYECTO.noExiste };
  const bytes = Number(bytesRaw);
  if (!Number.isInteger(bytes) || bytes <= 0) return { ok: false, error: "Ese archivo está vacío." };
  if (bytes > MAX_BYTES_ARCHIVO) return { ok: false, error: "Ese archivo pasa los 5 GB." };
  const cantidad = await prisma.fotofficeArchivoTrabajo.count({ where: { proyectoId: p.id } });
  if (cantidad >= MAX_ARCHIVOS_CARPETA) return { ok: false, error: `La carpeta admite hasta ${MAX_ARCHIVOS_CARPETA} archivos.` };
  const nombre = limpiarNombreArchivo(String(nombreRaw ?? ""));
  const tipo = tipoDeArchivo(String(tipoRaw ?? ""));
  const id = randomUUID();
  const key = claveDeArchivo(ctx.workspaceId, p.id, id, nombre);
  await prisma.fotofficeArchivoTrabajo.create({
    data: { id, workspaceId: ctx.workspaceId, proyectoId: p.id, key, nombre, tipo, bytes: BigInt(bytes), uploadedByUserId: ctx.userId },
  });
  return { ok: true, archivoId: id, url: await urlDeSubidaArchivo(key, tipo, bytes), tipo };
}

/** Después de subir: se mira en R2 que el archivo esté y pese lo declarado. */
export async function confirmarSubida(ctx: CtxProyectos, archivoId: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (typeof archivoId !== "string" || !ID.test(archivoId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const a = await prisma.fotofficeArchivoTrabajo.findFirst({ where: { id: archivoId, workspaceId: ctx.workspaceId }, select: { id: true, key: true } });
  if (!a) return { ok: false, error: "Ese archivo no existe." };
  const real = await tamanoDeArchivo(a.key);
  if (real === null) return { ok: false, error: "El archivo no llegó a subirse. Probá de nuevo." };
  await prisma.fotofficeArchivoTrabajo.update({ where: { id: a.id }, data: { estado: "LISTO", bytes: BigInt(real) } });
  return { ok: true };
}

export async function borrarArchivo(ctx: CtxProyectos, archivoId: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (typeof archivoId !== "string" || !ID.test(archivoId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const a = await prisma.fotofficeArchivoTrabajo.findFirst({ where: { id: archivoId, workspaceId: ctx.workspaceId }, select: { id: true, key: true } });
  if (!a) return { ok: true };
  await borrarArchivoGuardado(a.key);
  await prisma.fotofficeArchivoTrabajo.delete({ where: { id: a.id } });
  return { ok: true };
}

export type ResultadoEnlace = { ok: true; url: string; vence: string } | { ok: false; error: string };

/**
 * El enlace de la carpeta para el laboratorio o para el cliente. Se emite la primera vez que se
 * pide (y se repite igual después). Compartirlo extiende el vencimiento a 30 días desde hoy.
 */
export async function enlaceDeCarpeta(ctx: CtxProyectos, proyectoId: unknown, audiencia: Audiencia, ahora = new Date()): Promise<ResultadoEnlace> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  const p = await proyectoPropio(ctx, proyectoId);
  if (!p) return { ok: false, error: MENSAJES_PROYECTO.noExiste };
  const clave = resolverClaveDeEnlace();
  if (!clave) return { ok: false, error: "Falta la clave de enlaces del servidor." };
  const emitidaPrevia = audiencia === "CLIENTE" ? p.carpetaClienteEmitida : p.carpetaLabEmitida;
  const emitida = emitidaPrevia ?? ahora;
  const token = tokenDe(p.id, audiencia, emitida, clave);
  const vence = nuevoVencimiento(p.carpetaVence, ahora);
  await prisma.fotofficeProyecto.update({
    where: { id: p.id },
    data:
      audiencia === "CLIENTE"
        ? { carpetaClienteEmitida: emitida, carpetaClienteHash: hashDeToken(token), carpetaVence: vence }
        : { carpetaLabEmitida: emitida, carpetaLabHash: hashDeToken(token), carpetaVence: vence },
  });
  const url = await urlDe(ctx.workspaceId, token);
  if (!url) return { ok: false, error: "El estudio no tiene sitio público configurado para armar el enlace." };
  return { ok: true, url, vence: vence.toISOString() };
}

/** Para el correo al proveedor: el enlace del laboratorio, si la carpeta tiene archivos. */
export async function enlaceLaboratorioSiHayArchivos(ctx: CtxProyectos, proyectoId: string): Promise<string | null> {
  const hay = await prisma.fotofficeArchivoTrabajo.count({ where: { workspaceId: ctx.workspaceId, proyectoId, estado: "LISTO" } });
  if (hay === 0) return null;
  const r = await enlaceDeCarpeta(ctx, proyectoId, "LABORATORIO");
  return r.ok ? r.url : null;
}

// --- Lo que ve quien abre el enlace ---------------------------------------------------------------


export async function abrirCarpeta(workspaceId: string, token: unknown, ahora = new Date()): Promise<VistaCarpeta | null> {
  if (!tokenConForma(token)) return null;
  const hash = hashDeToken(token);
  const p = await prisma.fotofficeProyecto.findFirst({
    where: { workspaceId, OR: [{ carpetaClienteHash: hash }, { carpetaLabHash: hash }] },
    select: {
      id: true,
      name: true,
      carpetaClienteHash: true,
      carpetaVence: true,
      client: { select: { firstName: true, lastName: true, businessName: true } },
      product: { select: { name: true } },
    },
  });
  if (!p) return null;
  if (p.carpetaVence && p.carpetaVence < ahora) return null;
  const [archivos, branding] = await Promise.all([
    prisma.fotofficeArchivoTrabajo.findMany({
      where: { workspaceId, proyectoId: p.id, estado: "LISTO" },
      orderBy: { createdAt: "asc" },
      select: { id: true, nombre: true, tipo: true, bytes: true, createdAt: true, key: true },
    }),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { commercialName: true } }),
  ]);
  const cliente = p.client?.businessName?.trim() || [p.client?.firstName, p.client?.lastName].filter(Boolean).join(" ") || "";
  return {
    audiencia: p.carpetaClienteHash === hash ? "CLIENTE" : "LABORATORIO",
    estudio: branding?.commercialName?.trim() || "el estudio",
    trabajo: p.product?.name ?? p.name,
    cliente,
    vence: p.carpetaVence ? p.carpetaVence.toISOString() : null,
    archivos: await Promise.all(
      archivos.map(async (a) => ({
        id: a.id,
        nombre: a.nombre,
        tipo: a.tipo,
        bytes: Number(a.bytes),
        createdAt: a.createdAt.toISOString(),
        descargar: await urlDeLecturaArchivo(a.key, a.nombre, "descargar"),
        ver: esVideo(a.tipo) ? await urlDeLecturaArchivo(a.key, a.nombre, "ver") : null,
      })),
    ),
  };
}

// --- Borrado de carpetas vencidas (cron) -----------------------------------------------------------

/** Borra los archivos de las carpetas vencidas y los pendientes viejos. Devuelve cuántos borró. */
export async function purgarCarpetas(ahora = new Date(), tope = 200): Promise<number> {
  const viejoPendiente = new Date(ahora.getTime() - 24 * 3_600_000);
  const filas = await prisma.fotofficeArchivoTrabajo.findMany({
    where: {
      OR: [{ proyecto: { carpetaVence: { lt: ahora } } }, { estado: "PENDIENTE", createdAt: { lt: viejoPendiente } }],
    },
    select: { id: true, key: true },
    take: tope,
  });
  let n = 0;
  for (const f of filas) {
    try {
      await borrarArchivoGuardado(f.key);
      await prisma.fotofficeArchivoTrabajo.delete({ where: { id: f.id } });
      n++;
    } catch (e) {
      console.error("[carpetas] no se pudo borrar", { id: f.id, error: e instanceof Error ? e.name : "?" });
    }
  }
  return n;
}
