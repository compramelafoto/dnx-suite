import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { leerRevisionCliente, type ComentarioCliente, type RevisionCliente } from "./revision-cliente-tipos";

/**
 * La aprobación del cliente: un enlace para que hojee el libro, comente cada pliego y lo apruebe.
 *
 * Se guarda en un registro aparte (una plantilla archivada con la clave `fotolibro-revision`),
 * no dentro del fotolibro: el diseñador guarda el libro entero cada vez y pisaría los comentarios
 * que el cliente dejó mientras tanto.
 */
const CLAVE = "fotolibro-revision";

type Registro = { versionId: string; meta: Record<string, unknown>; revision: RevisionCliente };

async function registroDonde(path: string, valor: string): Promise<Registro | null> {
  const versiones = await prisma.templateV2Version.findMany({
    where: { AND: [{ metaJson: { path: ["templateKey"], equals: CLAVE } }, { metaJson: { path: [path], equals: valor } }] },
    select: { id: true, metaJson: true },
    take: 1,
  });
  const v = versiones[0];
  if (!v) return null;
  const meta = (v.metaJson ?? {}) as Record<string, unknown>;
  const revision = leerRevisionCliente(meta);
  return revision ? { versionId: v.id, meta, revision } : null;
}

export const revisionDelFotolibro = (fotolibroId: string) => registroDonde("fotolibroId", fotolibroId);
export const revisionPorEnlace = (token: string) => (token.length >= 20 ? registroDonde("token", token) : Promise.resolve(null));

async function guardar(r: Registro, revision: RevisionCliente) {
  await prisma.templateV2Version.update({ where: { id: r.versionId }, data: { metaJson: { ...r.meta, ...revision } } });
}

const tokenNuevo = () => randomBytes(18).toString("base64url");

/** Crea el enlace (o lo devuelve si ya hay uno vigente). */
export async function compartirConCliente(fotolibroId: string, ownerUserId: number): Promise<RevisionCliente> {
  const r = await revisionDelFotolibro(fotolibroId);
  if (r?.revision.token) return r.revision;
  if (r) {
    const nueva = { ...r.revision, token: tokenNuevo(), estado: "pendiente" as const };
    await guardar(r, nueva);
    return nueva;
  }
  const revision: RevisionCliente = { fotolibroId, token: tokenNuevo(), creada: new Date().toISOString(), estado: "pendiente", comentarios: [], aprobacion: null };
  await prisma.$transaction(async (tx) => {
    const t = await tx.templateV2.create({
      data: { ownerUserId, workspaceId: null, name: `Revisión de cliente ${fotolibroId}`, status: "ARCHIVED" },
      select: { id: true },
    });
    const v = await tx.templateV2Version.create({
      data: { templateId: t.id, versionNumber: 1, canvasJson: { width: 1, height: 1 }, metaJson: { templateKey: CLAVE, product: "fotoffice", ...revision }, createdByUserId: ownerUserId },
      select: { id: true },
    });
    await tx.templateV2.update({ where: { id: t.id }, data: { currentVersionId: v.id } });
  });
  return revision;
}

/** Corta el enlace: el que lo tenga ya no puede ver el libro. Los comentarios quedan. */
export async function dejarDeCompartir(fotolibroId: string): Promise<void> {
  const r = await revisionDelFotolibro(fotolibroId);
  if (r) await guardar(r, { ...r.revision, token: null });
}

export async function comentar(token: string, c: { pliego: number; texto: string; nombre: string }): Promise<RevisionCliente | null> {
  const r = await revisionPorEnlace(token);
  if (!r || r.revision.estado === "aprobado") return null;
  const texto = c.texto.trim().slice(0, 1000);
  if (!texto) return r.revision;
  const comentario: ComentarioCliente = {
    id: randomUUID().slice(0, 12),
    pliego: Math.max(-1, Math.min(200, Math.trunc(c.pliego))),
    texto,
    nombre: c.nombre.trim().slice(0, 80),
    fecha: new Date().toISOString(),
    resuelto: false,
  };
  const nueva: RevisionCliente = { ...r.revision, estado: "cambios", comentarios: [...r.revision.comentarios, comentario].slice(-300) };
  await guardar(r, nueva);
  return nueva;
}

/** El cliente aprueba: queda quién, cuándo y sobre qué guardado del libro. */
export async function aprobar(token: string, nombre: string): Promise<RevisionCliente | null> {
  const r = await revisionPorEnlace(token);
  if (!r) return null;
  const libro = await prisma.templateV2.findUnique({ where: { id: r.revision.fotolibroId }, select: { currentVersionId: true } });
  const version = libro?.currentVersionId
    ? await prisma.templateV2Version.findUnique({ where: { id: libro.currentVersionId }, select: { revision: true } })
    : null;
  const nueva: RevisionCliente = {
    ...r.revision,
    estado: "aprobado",
    aprobacion: { nombre: nombre.trim().slice(0, 80) || "Cliente", fecha: new Date().toISOString(), revision: version?.revision ?? 0 },
  };
  await guardar(r, nueva);
  return nueva;
}

/** El estudio marca un comentario como resuelto (o lo reabre). */
export async function resolverComentario(fotolibroId: string, id: string, resuelto: boolean): Promise<RevisionCliente | null> {
  const r = await revisionDelFotolibro(fotolibroId);
  if (!r) return null;
  const nueva = { ...r.revision, comentarios: r.revision.comentarios.map((c) => (c.id === id ? { ...c, resuelto } : c)) };
  await guardar(r, nueva);
  return nueva;
}

/** Después de corregir, el estudio vuelve a pedir la aprobación con el mismo enlace. */
export async function pedirAprobacionDeNuevo(fotolibroId: string): Promise<RevisionCliente | null> {
  const r = await revisionDelFotolibro(fotolibroId);
  if (!r) return null;
  const nueva = { ...r.revision, estado: "pendiente" as const, aprobacion: null };
  await guardar(r, nueva);
  return nueva;
}
