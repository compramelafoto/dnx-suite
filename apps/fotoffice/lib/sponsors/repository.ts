import "server-only";
import { randomBytes } from "node:crypto";
import {
  resolveInventoryAvailability,
  resolveInventoryCapacity,
  type InventoryBooking,
} from "@repo/partners";
import { elegirLogo } from "@/lib/raffles/partners-live";
import { normalizarSitioWeb, normalizarUsuarioRed } from "@/lib/membership/social";
import { partnersReader, partnersWriter, type PartnersDb } from "./clients";
import { type SponsorPlacementKey, isSponsorPlacementKey } from "./constants";
import { estaVigente, rangoArgentino } from "./slots";
import { discardSponsorLogo, uploadSponsorLogo } from "./logo-storage";

/**
 * Los sponsors de una institución, sobre DNX Partners.
 *
 * Un sponsor "es de" una institución cuando tiene una participación de FOTOFFICE con
 * contexto ORGANIZATION = workspaceId. TODO lo que se lee o escribe acá pasa por ese filtro:
 * es lo que impide que SFPR vea los contactos de un sponsor de Clickatón o toque las
 * asignaciones de otra sociedad. La ficha común (nombre, logo, redes) sí la puede editar
 * cualquiera que la tenga vinculada: es una decisión de producto (ver el spec).
 */

const SIN_CONEXION =
  "Falta la conexión de FOTOFFICE con DNX Partners: por ahora los sponsors se pueden ver pero no cambiar.";

export type Resultado = { ok: true } | { ok: false; error: string };

function escritor(): PartnersDb {
  const db = partnersWriter();
  if (!db) throw new SponsorsError(SIN_CONEXION);
  return db;
}

/** Error con un mensaje pensado para mostrarle a la institución. */
export class SponsorsError extends Error {}

function participacionesDe(workspaceId: string) {
  return {
    application: "FOTO_OFFICE" as const,
    contextType: "ORGANIZATION" as const,
    contextId: workspaceId,
    archivedAt: null,
    status: { notIn: ["ARCHIVED" as const, "CANCELLED" as const] },
  };
}

const ASSETS_VISIBLES = {
  where: { archivedAt: null, status: "ACTIVE" as const, approvalStatus: "APPROVED" as const },
  orderBy: { createdAt: "desc" as const },
};

type FilaConLogo = {
  logoUrl: string | null;
  brandAssets: { id: string; isPrimary: boolean; type: string; storageKey: string | null }[];
};

const TIPOS_DE_LOGO = new Set([
  "LOGO_GENERAL",
  "LOGO_PRIMARY",
  "LOGO_HORIZONTAL",
  "LOGO_DARK",
  "LOGO_LIGHT",
  "ISOTYPE",
]);

/**
 * El logo a mostrar. Primero el marcado como principal —el que se acaba de subir desde
 * FOTOFFICE lo es—, y si no, la misma elección que las fichas de premio.
 */
export function logoDe(partner: FilaConLogo): string | null {
  const principal = partner.brandAssets.find((a) => a.isPrimary && TIPOS_DE_LOGO.has(a.type) && a.storageKey);
  if (principal) return `/api/sorteos/logo/${principal.id}`;
  return elegirLogo(partner as Parameters<typeof elegirLogo>[0]);
}

function textoONulo(valor: string | null | undefined, max: number): string | null {
  const t = (valor ?? "").trim();
  return t ? t.slice(0, max) : null;
}

// ─────────────────────────────── Lecturas ───────────────────────────────

export type SponsorPlacementRow = {
  bookingId: string;
  placementKey: SponsorPlacementKey;
  startsAt: Date;
  endsAt: Date;
  vigente: boolean;
};

export type SponsorRow = {
  partnerId: string;
  name: string;
  logoSrc: string | null;
  websiteUrl: string | null;
  instagram: string | null;
  placements: SponsorPlacementRow[];
};

async function asignacionesDe(db: PartnersDb, workspaceId: string, partnerIds: string[], ahora: Date) {
  if (partnerIds.length === 0) return [];
  const filas = await db.dnxPartnerInventoryBooking.findMany({
    where: {
      contextType: "ORGANIZATION",
      contextId: workspaceId,
      partnerId: { in: partnerIds },
      status: "SOLD",
      endsAt: { gt: ahora },
    },
    orderBy: [{ startsAt: "asc" }],
    select: { id: true, partnerId: true, placementKey: true, startsAt: true, endsAt: true },
  });
  return filas.filter((f) => isSponsorPlacementKey(f.placementKey));
}

export async function listWorkspaceSponsors(workspaceId: string, ahora = new Date()): Promise<SponsorRow[]> {
  const db = await partnersReader();
  const participaciones = await db.dnxPartnerParticipation.findMany({
    where: { ...participacionesDe(workspaceId), partner: { archivedAt: null } },
    orderBy: { createdAt: "asc" },
    select: {
      partner: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          websiteUrl: true,
          instagram: true,
          brandAssets: ASSETS_VISIBLES,
        },
      },
    },
  });

  const vistos = new Map<string, SponsorRow>();
  for (const { partner } of participaciones) {
    if (vistos.has(partner.id)) continue;
    vistos.set(partner.id, {
      partnerId: partner.id,
      name: partner.name,
      logoSrc: logoDe(partner),
      websiteUrl: partner.websiteUrl,
      instagram: partner.instagram,
      placements: [],
    });
  }

  for (const b of await asignacionesDe(db, workspaceId, [...vistos.keys()], ahora)) {
    vistos.get(b.partnerId)?.placements.push({
      bookingId: b.id,
      placementKey: b.placementKey as SponsorPlacementKey,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      vigente: estaVigente(b, ahora),
    });
  }

  return [...vistos.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export type SponsorDetail = SponsorRow & {
  title: string | null;
  description: string | null;
  destinationUrl: string | null;
  notes: string | null;
  /** Cuántas otras instituciones o plataformas lo tienen vinculado: por eso el aviso al editar. */
  otherLinks: number;
};

export async function getWorkspaceSponsor(
  workspaceId: string,
  partnerId: string,
  ahora = new Date(),
): Promise<SponsorDetail | null> {
  const db = await partnersReader();
  const participacion = await db.dnxPartnerParticipation.findFirst({
    where: { ...participacionesDe(workspaceId), partnerId, partner: { archivedAt: null } },
    orderBy: { createdAt: "asc" },
    select: {
      title: true,
      description: true,
      destinationUrl: true,
      notes: true,
      partner: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          websiteUrl: true,
          instagram: true,
          brandAssets: ASSETS_VISIBLES,
        },
      },
    },
  });
  if (!participacion) return null;
  const { partner } = participacion;

  const [asignaciones, otros] = await Promise.all([
    asignacionesDe(db, workspaceId, [partner.id], ahora),
    db.dnxPartnerParticipation.count({
      where: {
        partnerId,
        archivedAt: null,
        NOT: { application: "FOTO_OFFICE", contextId: workspaceId },
      },
    }),
  ]);

  return {
    partnerId: partner.id,
    name: partner.name,
    logoSrc: logoDe(partner),
    websiteUrl: partner.websiteUrl,
    instagram: partner.instagram,
    placements: asignaciones.map((b) => ({
      bookingId: b.id,
      placementKey: b.placementKey as SponsorPlacementKey,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      vigente: estaVigente(b, ahora),
    })),
    title: participacion.title,
    description: participacion.description,
    destinationUrl: participacion.destinationUrl,
    notes: participacion.notes,
    otherLinks: otros,
  };
}

export type CatalogOption = {
  id: string;
  name: string;
  logoSrc: string | null;
  /** El `logoUrl` crudo de la ficha: es lo que guardan como respaldo los premios de los sorteos. */
  logoUrl: string | null;
  /** Ya es sponsor de esta institución. */
  linked: boolean;
  /** Sólo de los vinculados: los datos de contacto de los demás no son de esta institución. */
  email: string | null;
};

/**
 * El buscador de la base común. Devuelve sólo nombre y logo de los sponsors ajenos: la
 * institución los puede sumar, pero sus contactos y notas no son suyos.
 */
export async function searchCatalog(workspaceId: string, texto: string): Promise<CatalogOption[]> {
  const q = texto.trim();
  if (q.length < 2) return [];
  const db = await partnersReader();
  const filas = await db.dnxPartner.findMany({
    where: { archivedAt: null, name: { contains: q, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 12,
    select: {
      id: true,
      name: true,
      logoUrl: true,
      email: true,
      brandAssets: ASSETS_VISIBLES,
      participations: { where: participacionesDe(workspaceId), select: { id: true }, take: 1 },
    },
  });
  return filas
    .map((p) => {
      const linked = p.participations.length > 0;
      return { id: p.id, name: p.name, logoSrc: logoDe(p), logoUrl: p.logoUrl, linked, email: linked ? p.email : null };
    })
    .sort((a, b) => Number(b.linked) - Number(a.linked));
}

// ─────────────────────────────── Escrituras ───────────────────────────────

async function exigirVinculo(db: PartnersDb, workspaceId: string, partnerId: string) {
  const p = await db.dnxPartnerParticipation.findFirst({
    where: { ...participacionesDe(workspaceId), partnerId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!p) throw new SponsorsError("Ese sponsor no está vinculado a la institución.");
  return p;
}

/** Vincula un sponsor de la base común a la institución. Si ya lo estaba, no hace nada. */
export async function linkSponsor(input: { workspaceId: string; partnerId: string }): Promise<void> {
  const db = escritor();
  const partner = await db.dnxPartner.findFirst({
    where: { id: input.partnerId, archivedAt: null },
    select: { id: true },
  });
  if (!partner) throw new SponsorsError("Ese sponsor ya no existe en la base común.");

  const existente = await db.dnxPartnerParticipation.findFirst({
    where: { ...participacionesDe(input.workspaceId), partnerId: input.partnerId },
    select: { id: true, organizationId: true },
  });
  if (existente) {
    // La participación que creó la carga de premios de octubre no tenía organizationId.
    if (!existente.organizationId) {
      await db.dnxPartnerParticipation.update({
        where: { id: existente.id },
        data: { organizationId: input.workspaceId },
      });
    }
    return;
  }

  await db.dnxPartnerParticipation.create({
    data: {
      partnerId: input.partnerId,
      organizationId: input.workspaceId,
      application: "FOTO_OFFICE",
      contextType: "ORGANIZATION",
      contextId: input.workspaceId,
      participationType: "SPONSOR",
      institutionalRole: "SPONSOR",
      status: "ACTIVE",
      publicVisibility: "PUBLIC",
      soldByOrganizationId: input.workspaceId,
    },
  });
}

function slugBase(nombre: string): string {
  const s = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "sponsor";
}

export type SponsorCommonInput = { name: string; websiteUrl: string; instagram: string };

function normalizarComunes(input: SponsorCommonInput) {
  const name = input.name.trim().slice(0, 120);
  if (name.length < 2) throw new SponsorsError("El nombre del sponsor tiene que tener al menos 2 letras.");
  const web = normalizarSitioWeb(input.websiteUrl);
  if (!web.ok) throw new SponsorsError(web.error);
  const ig = normalizarUsuarioRed("instagram", input.instagram);
  if (!ig.ok) throw new SponsorsError(ig.error);
  return { name, websiteUrl: web.valor, instagram: ig.valor };
}

/** Crea la ficha en la base común y la vincula. Devuelve el id del sponsor. */
export async function createSponsor(input: SponsorCommonInput & { workspaceId: string }): Promise<string> {
  const db = escritor();
  const datos = normalizarComunes(input);

  const repetido = await db.dnxPartner.findFirst({
    where: { archivedAt: null, name: { equals: datos.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (repetido) {
    throw new SponsorsError(
      `Ya existe un sponsor llamado "${datos.name}" en la base común. Buscalo y vinculalo en lugar de crear otro.`,
    );
  }

  const base = slugBase(datos.name);
  let slug = base;
  for (let i = 0; i < 5 && (await db.dnxPartner.findUnique({ where: { slug }, select: { id: true } })); i += 1) {
    slug = `${base}-${randomBytes(2).toString("hex")}`;
  }

  const creado = await db.dnxPartner.create({
    data: { ...datos, slug, type: "BRAND", status: "ACTIVE" },
    select: { id: true },
  });
  await linkSponsor({ workspaceId: input.workspaceId, partnerId: creado.id });
  return creado.id;
}

/** Nombre, web e Instagram: la ficha común, que se ve en todas las plataformas. */
export async function updateSponsorCommon(
  workspaceId: string,
  partnerId: string,
  input: SponsorCommonInput,
): Promise<void> {
  const db = escritor();
  await exigirVinculo(db, workspaceId, partnerId);
  await db.dnxPartner.update({ where: { id: partnerId }, data: normalizarComunes(input) });
}

export type SponsorLocalInput = { title: string; description: string; destinationUrl: string; notes: string };

/** Lo que es de la institución: el texto del portal, el enlace y las notas internas. */
export async function updateSponsorLocal(
  workspaceId: string,
  partnerId: string,
  input: SponsorLocalInput,
): Promise<void> {
  const db = escritor();
  await exigirVinculo(db, workspaceId, partnerId);
  const destino = normalizarSitioWeb(input.destinationUrl);
  if (!destino.ok) throw new SponsorsError("El enlace no parece una dirección válida.");
  await db.dnxPartnerParticipation.updateMany({
    where: { ...participacionesDe(workspaceId), partnerId },
    data: {
      title: textoONulo(input.title, 120),
      description: textoONulo(input.description, 600),
      destinationUrl: destino.valor,
      notes: textoONulo(input.notes, 4000),
      organizationId: workspaceId,
    },
  });
}

/** Lo saca de la institución: la participación se archiva y sus espacios se liberan. */
export async function unlinkSponsor(workspaceId: string, partnerId: string, ahora = new Date()): Promise<void> {
  const db = escritor();
  await exigirVinculo(db, workspaceId, partnerId);
  await db.$transaction([
    db.dnxPartnerInventoryBooking.updateMany({
      where: {
        contextType: "ORGANIZATION",
        contextId: workspaceId,
        partnerId,
        status: "SOLD",
        endsAt: { gt: ahora },
      },
      data: { status: "CANCELLED" },
    }),
    db.dnxPartnerParticipation.updateMany({
      where: { ...participacionesDe(workspaceId), partnerId },
      data: { status: "ARCHIVED", archivedAt: ahora },
    }),
  ]);
}

const EXCLUSION_VIOLATION = "23P01";

function esSuperposicion(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (code === EXCLUSION_VIOLATION) return true;
  const meta = (err as { meta?: { code?: unknown } }).meta;
  return code === "P2010" && meta?.code === EXCLUSION_VIOLATION;
}

/**
 * Pone el sponsor en un espacio, del día `desde` al día `hasta` (hora argentina).
 *
 * Una institución no reserva con vencimiento como un vendedor de DNX: asigna, y queda
 * confirmado (`SOLD`). El lugar libre se calcula con la misma función que el inventario de
 * Clickatón, pero la verdad la dice la restricción de exclusión de Postgres: si otro tomó el
 * lugar en el medio, se vuelve a mirar.
 */
export async function assignPlacement(input: {
  workspaceId: string;
  partnerId: string;
  placementKey: string;
  desde: string;
  hasta: string;
  ahora?: Date;
}): Promise<Resultado> {
  if (!isSponsorPlacementKey(input.placementKey)) return { ok: false, error: "Elegí un espacio." };
  const rango = rangoArgentino(input.desde, input.hasta);
  if ("error" in rango) return { ok: false, error: rango.error };
  const ahora = input.ahora ?? new Date();
  if (rango.endsAt.getTime() <= ahora.getTime()) {
    return { ok: false, error: "Ese período ya terminó." };
  }

  const db = escritor();
  const participacion = await exigirVinculo(db, input.workspaceId, input.partnerId);
  const capacidad = resolveInventoryCapacity(input.placementKey);

  for (let intento = 0; intento <= capacidad; intento += 1) {
    const ocupan = await db.dnxPartnerInventoryBooking.findMany({
      where: {
        placementKey: input.placementKey,
        contextId: input.workspaceId,
        status: { in: ["RESERVED", "SOLD"] },
        startsAt: { lt: rango.endsAt },
        endsAt: { gt: rango.startsAt },
      },
      select: {
        partnerId: true,
        placementKey: true,
        contextId: true,
        slotIndex: true,
        status: true,
        startsAt: true,
        endsAt: true,
        reservationExpiresAt: true,
      },
    });
    if (ocupan.some((b) => b.partnerId === input.partnerId && b.status === "SOLD")) {
      return { ok: false, error: "Este sponsor ya está en ese espacio en esas fechas." };
    }

    const lugar = resolveInventoryAvailability({
      placementKey: input.placementKey,
      contextId: input.workspaceId,
      range: rango,
      bookings: ocupan as InventoryBooking[],
      now: ahora,
      capacity: capacidad,
    });
    if (lugar.slotIndex === null) {
      return {
        ok: false,
        error: `Ese espacio ya tiene ${capacidad} ${capacidad === 1 ? "sponsor" : "sponsors"} en esas fechas. Liberá uno o elegí otro período.`,
      };
    }

    try {
      await db.dnxPartnerInventoryBooking.create({
        data: {
          placementKey: input.placementKey,
          contextType: "ORGANIZATION",
          contextId: input.workspaceId,
          partnerId: input.partnerId,
          participationId: participacion.id,
          slotIndex: lugar.slotIndex,
          status: "SOLD",
          startsAt: rango.startsAt,
          endsAt: rango.endsAt,
          soldByOrganizationId: input.workspaceId,
        },
      });
      return { ok: true };
    } catch (err) {
      if (!esSuperposicion(err)) throw err;
    }
  }
  return { ok: false, error: "No se pudo tomar un lugar en ese espacio. Probá de nuevo." };
}

/** Saca al sponsor de un espacio. Sólo puede tocar asignaciones de su propia institución. */
export async function cancelPlacement(workspaceId: string, bookingId: string): Promise<void> {
  const db = escritor();
  await db.dnxPartnerInventoryBooking.updateMany({
    where: { id: bookingId, contextType: "ORGANIZATION", contextId: workspaceId, status: "SOLD" },
    data: { status: "CANCELLED" },
  });
}

/** Sube un logo nuevo y lo deja como principal del sponsor. */
export async function saveSponsorLogo(input: {
  workspaceId: string;
  partnerId: string;
  file: File;
}): Promise<Resultado> {
  const db = escritor();
  await exigirVinculo(db, input.workspaceId, input.partnerId);

  let subido: Awaited<ReturnType<typeof uploadSponsorLogo>>;
  try {
    subido = await uploadSponsorLogo(input.file);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo subir el logo." };
  }

  try {
    const partner = await db.dnxPartner.findUnique({ where: { id: input.partnerId }, select: { name: true } });
    await db.$transaction([
      db.dnxPartnerAsset.updateMany({
        where: { partnerId: input.partnerId, isPrimary: true },
        data: { isPrimary: false },
      }),
      db.dnxPartnerAsset.create({
        data: {
          partnerId: input.partnerId,
          type: "LOGO_GENERAL",
          name: `Logo de ${partner?.name ?? "sponsor"}`.slice(0, 120),
          storageProvider: "R2",
          storageKey: subido.storageKey,
          originalFilename: subido.filename,
          mimeType: subido.mimeType,
          fileExtension: subido.filename.split(".").pop()?.toLowerCase() ?? null,
          fileSize: subido.sizeBytes,
          width: subido.width,
          height: subido.height,
          backgroundType: "TRANSPARENT",
          isPrimary: true,
          status: "ACTIVE",
          approvalStatus: "APPROVED",
          approvedAt: new Date(),
          altText: `Logo de ${partner?.name ?? "sponsor"}`.slice(0, 200),
          notes: `Subido desde FOTOFFICE (institución ${input.workspaceId}).`,
        },
      }),
    ]);
    return { ok: true };
  } catch (error) {
    // El archivo ya está en el bucket pero no quedó registrado: se borra para no dejar huérfanos.
    await discardSponsorLogo(subido.storageKey);
    throw error;
  }
}
