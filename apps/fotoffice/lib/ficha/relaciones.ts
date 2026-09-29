import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { crearClienteConNumero } from "@/lib/clients/alta";
import { registrarEventoPersona, type Actor } from "./eventos";
import { duenoDe, resolverPersonaPorCliente, resolverPersonaPorSocio, type Dueno, type PersonaRef } from "./persona";
import { CLAVE_VINCULO_LIBRE, MAX_ETIQUETA_LIBRE, esClaveDeVinculo, etiquetaDelVinculo } from "./vinculos";

export const MAX_NOTA_RELACION = 200;
export const MAX_NOMBRE_ALTA_RAPIDA = 100;
export const MAX_TELEFONO_ALTA_RAPIDA = 40;

export const ERROR_PERSONA_NO_ENCONTRADA = "No encontramos a esa persona.";
export const ERROR_MISMA_PERSONA = "No podés vincular a una persona consigo misma.";
export const ERROR_YA_VINCULADAS = "Ya están vinculadas.";
export const ERROR_VINCULO_NO_ENCONTRADO = "No encontramos ese vínculo.";

export type CtxRelaciones = { workspaceId: string; userId: number; userLabel: string; role: string | null };
export type ResultadoRelacion = { ok: true } | { ok: false; error: string };

export type OtraPersona = PersonaRef | { nuevoCliente: { nombre: string; telefono: string } };

export type RelacionDePersona = {
  id: string;
  otra: { tipo: "CLIENTE" | "SOCIO"; id: string; nombre: string; href: string };
  etiqueta: string;
  nota: string | null;
};

function nombreDeCliente(c: { firstName: string | null; lastName: string | null; businessName: string | null }): string {
  const persona = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return persona || c.businessName?.trim() || "Sin nombre";
}

function nombreDeSocio(m: { firstName: string; lastName: string }): string {
  return `${m.firstName} ${m.lastName}`.trim() || "Sin nombre";
}

/** Condiciones para "alguno de los extremos de la persona" en el lado `lado` de la relación. */
function extremos(p: PersonaRef, lado: "from" | "to"): Prisma.FotofficePersonRelationWhereInput[] {
  const out: Prisma.FotofficePersonRelationWhereInput[] = [];
  if (p.clientId) out.push(lado === "from" ? { fromClientId: p.clientId } : { toClientId: p.clientId });
  if (p.memberId) out.push(lado === "from" ? { fromMemberId: p.memberId } : { toMemberId: p.memberId });
  return out;
}

function dondeInvolucra(workspaceId: string, p: PersonaRef): Prisma.FotofficePersonRelationWhereInput {
  return { workspaceId, OR: [...extremos(p, "from"), ...extremos(p, "to")] };
}

function extremoDeDueno(lado: "from" | "to", d: Dueno) {
  return "clientId" in d
    ? { [`${lado}ClientId`]: d.clientId }
    : { [`${lado}MemberId`]: d.memberId };
}

/**
 * Las relaciones de la persona, leídas en los dos sentidos y con las dos formas (cliente y
 * socio). Del lado de origen se lee `desde`; del lado de destino, `hacia`.
 */
export async function relacionesDePersona(workspaceId: string, persona: PersonaRef): Promise<RelacionDePersona[]> {
  const donde = dondeInvolucra(workspaceId, persona);
  if (donde.OR!.length === 0) return [];
  const filas = await prisma.fotofficePersonRelation.findMany({
    where: donde,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      customLabel: true,
      note: true,
      fromClientId: true,
      fromMemberId: true,
      toClientId: true,
      toMemberId: true,
      fromClient: { select: { id: true, firstName: true, lastName: true, businessName: true } },
      toClient: { select: { id: true, firstName: true, lastName: true, businessName: true } },
      fromMember: { select: { id: true, firstName: true, lastName: true } },
      toMember: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const out: RelacionDePersona[] = [];
  for (const f of filas) {
    const soyOrigen =
      (persona.clientId !== null && f.fromClientId === persona.clientId) ||
      (persona.memberId !== null && f.fromMemberId === persona.memberId);
    const otroCliente = soyOrigen ? f.toClient : f.fromClient;
    const otroSocio = soyOrigen ? f.toMember : f.fromMember;
    let otra: RelacionDePersona["otra"] | null = null;
    if (otroCliente) {
      otra = { tipo: "CLIENTE", id: otroCliente.id, nombre: nombreDeCliente(otroCliente), href: `/clientes/${otroCliente.id}` };
    } else if (otroSocio) {
      otra = { tipo: "SOCIO", id: otroSocio.id, nombre: nombreDeSocio(otroSocio), href: `/members/${otroSocio.id}` };
    }
    if (!otra) continue;
    out.push({
      id: f.id,
      otra,
      etiqueta: etiquetaDelVinculo(f.kind, soyOrigen ? "desde" : "hacia", f.customLabel),
      nota: f.note,
    });
  }
  return out;
}

async function resolver(workspaceId: string, p: PersonaRef): Promise<PersonaRef | null> {
  if (p.clientId) return resolverPersonaPorCliente(workspaceId, p.clientId);
  if (p.memberId) return resolverPersonaPorSocio(workspaceId, p.memberId);
  return null;
}

function limpiarNuevoCliente(v: unknown): { nombre: string; telefono: string } | null {
  if (!v || typeof v !== "object") return null;
  const { nombre, telefono } = v as Record<string, unknown>;
  if (typeof nombre !== "string" || typeof telefono !== "string") return null;
  const n = nombre.replace(/\s+/g, " ").trim();
  const t = telefono.trim();
  if (n.length < 1 || n.length > MAX_NOMBRE_ALTA_RAPIDA) return null;
  if (t.length > MAX_TELEFONO_ALTA_RAPIDA) return null;
  return { nombre: n, telefono: t };
}

export async function crearRelacion(
  ctx: CtxRelaciones,
  persona: PersonaRef,
  datos: { otra: OtraPersona; clave: string; customLabel?: string | null; nota?: string | null },
): Promise<ResultadoRelacion> {
  if (!esClaveDeVinculo(datos.clave)) return { ok: false, error: "Elegí el tipo de vínculo." };
  let customLabel: string | null = null;
  if (datos.clave === CLAVE_VINCULO_LIBRE) {
    const c = typeof datos.customLabel === "string" ? datos.customLabel.replace(/\s+/g, " ").trim() : "";
    if (c.length < 1 || c.length > MAX_ETIQUETA_LIBRE) {
      return { ok: false, error: "Escribí cómo se relacionan, hasta 40 caracteres." };
    }
    customLabel = c;
  }
  let nota: string | null = null;
  if (datos.nota !== undefined && datos.nota !== null) {
    if (typeof datos.nota !== "string") return { ok: false, error: "La nota no es válida." };
    const n = datos.nota.trim();
    if (n.length > MAX_NOTA_RELACION) return { ok: false, error: "La nota puede tener hasta 200 caracteres." };
    nota = n || null;
  }

  const actor: Actor = { userId: ctx.userId, label: ctx.userLabel };
  const desde = duenoDe(persona);
  const detalle = (relacionId: string, otroNombre: string, sentido: "desde" | "hacia") => ({
    relacionId,
    vinculo: datos.clave,
    etiqueta: etiquetaDelVinculo(datos.clave, sentido, customLabel),
    otra: otroNombre,
  });
  const nombreDe = async (p: PersonaRef): Promise<string> => {
    if (p.clientId) {
      const c = await prisma.client.findFirst({
        where: { id: p.clientId, workspaceId: ctx.workspaceId },
        select: { firstName: true, lastName: true, businessName: true },
      });
      if (c) return nombreDeCliente(c);
    }
    if (p.memberId) {
      const m = await prisma.member.findFirst({
        where: { id: p.memberId, workspaceId: ctx.workspaceId },
        select: { firstName: true, lastName: true },
      });
      if (m) return nombreDeSocio(m);
    }
    return "Sin nombre";
  };
  const mia = await nombreDe(persona);

  // Alta rápida: cliente nuevo + relación + eventos, todo en la misma transacción.
  if ("nuevoCliente" in datos.otra) {
    const nuevo = limpiarNuevoCliente(datos.otra.nuevoCliente);
    if (!nuevo) return { ok: false, error: "Escribí el nombre y el teléfono de la persona nueva." };
    const id = await crearClienteConNumero(
      ctx.workspaceId,
      { firstName: nuevo.nombre, phone: nuevo.telefono || null },
      actor,
      async (tx, clientId) => {
        const rel = await tx.fotofficePersonRelation.create({
          data: {
            workspaceId: ctx.workspaceId,
            ...extremoDeDueno("from", desde),
            toClientId: clientId,
            kind: datos.clave,
            customLabel,
            note: nota,
            createdByUserId: ctx.userId,
          },
          select: { id: true },
        });
        await registrarEventoPersona(tx, {
          workspaceId: ctx.workspaceId, dueno: desde, kind: "RELACION_CREADA", detail: detalle(rel.id, nuevo.nombre, "hacia"), actor,
        });
        await registrarEventoPersona(tx, {
          workspaceId: ctx.workspaceId, dueno: { clientId }, kind: "RELACION_CREADA", detail: detalle(rel.id, mia, "desde"), actor,
        });
      },
    );
    return id ? { ok: true } : { ok: false, error: "No se pudo asignar un número. Probá de nuevo." };
  }

  const otra = await resolver(ctx.workspaceId, datos.otra);
  if (!otra) return { ok: false, error: ERROR_PERSONA_NO_ENCONTRADA };
  if (
    (persona.clientId !== null && otra.clientId === persona.clientId) ||
    (persona.memberId !== null && otra.memberId === persona.memberId)
  ) {
    return { ok: false, error: ERROR_MISMA_PERSONA };
  }

  // "Repetido" es el mismo par en cualquier sentido y con cualquiera de las dos formas.
  const repetida = await prisma.fotofficePersonRelation.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      OR: [
        { AND: [{ OR: extremos(persona, "from") }, { OR: extremos(otra, "to") }] },
        { AND: [{ OR: extremos(otra, "from") }, { OR: extremos(persona, "to") }] },
      ],
    },
    select: { id: true },
  });
  if (repetida) return { ok: false, error: ERROR_YA_VINCULADAS };

  const hacia = duenoDe(otra);
  const suya = await nombreDe(otra);
  await prisma.$transaction(async (tx) => {
    const rel = await tx.fotofficePersonRelation.create({
      data: {
        workspaceId: ctx.workspaceId,
        ...extremoDeDueno("from", desde),
        ...extremoDeDueno("to", hacia),
        kind: datos.clave,
        customLabel,
        note: nota,
        createdByUserId: ctx.userId,
      },
      select: { id: true },
    });
    await registrarEventoPersona(tx, {
      workspaceId: ctx.workspaceId, dueno: desde, kind: "RELACION_CREADA", detail: detalle(rel.id, suya, "hacia"), actor,
    });
    await registrarEventoPersona(tx, {
      workspaceId: ctx.workspaceId, dueno: hacia, kind: "RELACION_CREADA", detail: detalle(rel.id, mia, "desde"), actor,
    });
  });
  return { ok: true };
}

export async function borrarRelacion(ctx: CtxRelaciones, persona: PersonaRef, id: string): Promise<ResultadoRelacion> {
  if (typeof id !== "string" || id.length === 0) return { ok: false, error: ERROR_VINCULO_NO_ENCONTRADO };
  const actor: Actor = { userId: ctx.userId, label: ctx.userLabel };
  const donde = dondeInvolucra(ctx.workspaceId, persona);
  if (donde.OR!.length === 0) return { ok: false, error: ERROR_VINCULO_NO_ENCONTRADO };
  const rel = await prisma.fotofficePersonRelation.findFirst({
    where: { ...donde, id },
    select: { id: true, kind: true, customLabel: true, fromClientId: true, fromMemberId: true, toClientId: true, toMemberId: true },
  });
  if (!rel) return { ok: false, error: ERROR_VINCULO_NO_ENCONTRADO };

  const origen: Dueno = rel.fromClientId ? { clientId: rel.fromClientId } : { memberId: rel.fromMemberId! };
  const destino: Dueno = rel.toClientId ? { clientId: rel.toClientId } : { memberId: rel.toMemberId! };
  await prisma.$transaction(async (tx) => {
    await tx.fotofficePersonRelation.deleteMany({ where: { id: rel.id, workspaceId: ctx.workspaceId } });
    for (const [dueno, sentido] of [[origen, "desde"], [destino, "hacia"]] as const) {
      await registrarEventoPersona(tx, {
        workspaceId: ctx.workspaceId,
        dueno,
        kind: "RELACION_BORRADA",
        detail: { relacionId: rel.id, vinculo: rel.kind, etiqueta: etiquetaDelVinculo(rel.kind, sentido, rel.customLabel) },
        actor,
      });
    }
  });
  return { ok: true };
}

export type PersonaEncontrada = { tipo: "CLIENTE" | "SOCIO"; id: string; nombre: string; detalle: string | null };

/**
 * Busca clientes y socios del workspace por nombre, documento o teléfono. Un socio que ya
 * es cliente aparece una sola vez (como cliente). Como máximo `take` resultados.
 */
export async function buscarPersonas(
  workspaceId: string,
  texto: string,
  opciones: { clientes: boolean; socios: boolean; take?: number } = { clientes: true, socios: true },
): Promise<PersonaEncontrada[]> {
  const q = texto.trim().slice(0, 60);
  if (q.length < 1) return [];
  const take = Math.min(Math.max(1, Math.floor(opciones.take ?? 10)), 10);
  const doc = q.replace(/[.\-\s]/g, "");
  const out: PersonaEncontrada[] = [];

  if (opciones.clientes) {
    const cs = await prisma.client.findMany({
      where: {
        workspaceId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { businessName: { contains: q, mode: "insensitive" } },
          ...(doc ? [{ docNumber: { contains: doc } }] : []),
          { phone: { contains: q } },
        ],
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take,
      select: { id: true, firstName: true, lastName: true, businessName: true, docNumber: true, phone: true },
    });
    for (const c of cs) {
      out.push({ tipo: "CLIENTE", id: c.id, nombre: nombreDeCliente(c), detalle: c.docNumber || c.phone || null });
    }
  }
  if (opciones.socios) {
    const ms = await prisma.member.findMany({
      where: {
        workspaceId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          ...(doc ? [{ documentNumber: { contains: doc } }] : []),
          { phone: { contains: q } },
        ],
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: take,
      select: {
        id: true, firstName: true, lastName: true, documentNumber: true, phone: true,
        clientLink: { select: { id: true } },
      },
    });
    for (const m of ms) {
      // Un socio que ya es cliente se ofrece como cliente (la persona es una sola).
      const tipo = m.clientLink ? "CLIENTE" : "SOCIO";
      const id = m.clientLink?.id ?? m.id;
      if (out.some((o) => o.tipo === tipo && o.id === id)) continue;
      out.push({ tipo, id, nombre: nombreDeSocio(m), detalle: m.documentNumber || m.phone || null });
    }
  }
  return out.slice(0, take);
}
