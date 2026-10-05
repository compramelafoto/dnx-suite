import "server-only";

import { randomInt } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { cargarResultadosDeEdicion } from "@/lib/edition-results/cargar-resultados";
import { nombreDelPremio } from "@/lib/edition-results/armar-resultados";
import { pickClickatoner } from "./pick";
import { pickFeaturedWork } from "./featured-work";
import { baseSlug, freeSlug, personKey } from "./slug";
import { clickatonerWeekStart } from "./week";

/**
 * El Clickatoner de la semana en la base.
 *
 * Quién puede salir (diseño 2026-10-05): quien participó —inscripción confirmada, no de prueba—
 * en una edición con "Resultados publicados", aceptó las bases (que incluyen el uso de imagen),
 * no pidió quedar afuera y tiene al menos una obra admitida. Sin obra no hay nada que mostrar.
 */

/** Las ediciones con resultados anunciados, sin las de prueba. */
export async function publishedEditionIds(): Promise<string[]> {
  const publicadas = await prisma.clickatonEditionResultsPublication.findMany({
    select: { editionId: true },
  });
  if (publicadas.length === 0) return [];
  const reales = await prisma.clickatonEdition.findMany({
    where: { id: { in: publicadas.map((p) => p.editionId) }, isOpsFixture: false },
    select: { id: true },
  });
  return reales.map((e) => e.id);
}

/**
 * Las obras admitidas: las que tienen como **última** decisión técnica "elegible". Una obra
 * puede tener varias decisiones (se revisó a mano y cambió); manda la más reciente.
 */
async function obrasAdmitidas(editionIds: string[]): Promise<Set<string>> {
  const decisiones = await prisma.clickatonTechnicalAdmissionDecision.findMany({
    where: { editionId: { in: editionIds } },
    orderBy: [{ evaluatedAt: "desc" }, { createdAt: "desc" }],
    select: { submissionId: true, eligible: true },
  });
  const vistas = new Set<string>();
  const admitidas = new Set<string>();
  for (const d of decisiones) {
    if (vistas.has(d.submissionId)) continue;
    vistas.add(d.submissionId);
    if (d.eligible) admitidas.add(d.submissionId);
  }
  return admitidas;
}

/** Aceptó las bases: los permisos de imagen se marcan con ellas (`PublicRegistrationWizard`). */
const ACEPTO_LAS_BASES: Prisma.ClickatonRegistrationWhereInput = {
  OR: [
    { imageUsageConsent: true },
    { acceptedImageAt: { not: null } },
    { acceptedTermsAt: { not: null } },
    { termsAcceptedAt: { not: null } },
  ],
};

const SELECT_INSCRIPCION = {
  id: true,
  editionId: true,
  email: true,
  firstName: true,
  lastName: true,
  city: true,
  province: true,
  instagramHandle: true,
  profilePhotoAssetId: true,
  profilePhotoStatus: true,
} as const satisfies Prisma.ClickatonRegistrationSelect;

type Inscripcion = Prisma.ClickatonRegistrationGetPayload<{ select: typeof SELECT_INSCRIPCION }>;

/**
 * Las inscripciones que pueden aparecer, agrupadas por persona (email en minúsculas).
 * Si `email` viene, sólo las de esa persona.
 */
async function inscripcionesElegibles(email?: string): Promise<Map<string, Inscripcion[]>> {
  const ediciones = await publishedEditionIds();
  if (ediciones.length === 0) return new Map();

  const inscripciones = await prisma.clickatonRegistration.findMany({
    where: {
      editionId: { in: ediciones },
      status: "CONFIRMED",
      isOpsTest: false,
      ...ACEPTO_LAS_BASES,
      ...(email ? { email: { equals: email, mode: "insensitive" } } : {}),
    },
    select: SELECT_INSCRIPCION,
  });
  if (inscripciones.length === 0) return new Map();

  // Con al menos una obra admitida: la decisión técnica es lo que separa una obra válida de un
  // archivo que se subió y no corresponde.
  const admitidas = await obrasAdmitidas(ediciones);
  const conObra = new Set(
    (
      await prisma.clickatonPhotoSubmission.findMany({
        where: {
          id: { in: [...admitidas] },
          registrationId: { in: inscripciones.map((i) => i.id) },
          status: "CONFIRMED",
        },
        select: { registrationId: true },
      })
    ).map((s) => s.registrationId),
  );

  const afuera = new Set(
    (await prisma.clickatonClickatonerOptOut.findMany({ select: { email: true } })).map((o) => o.email),
  );

  const porPersona = new Map<string, Inscripcion[]>();
  for (const i of inscripciones) {
    const clave = personKey(i.email);
    if (!clave || afuera.has(clave) || !conObra.has(i.id)) continue;
    porPersona.set(clave, [...(porPersona.get(clave) ?? []), i]);
  }
  return porPersona;
}

export type PublishedWork = {
  submissionId: string;
  editionId: string;
  editionName: string;
  editionEndAt: Date | null;
  promptTitle: string | null;
  premio: string | null;
  premioLabel: string | null;
  puesto: number | null;
};

/**
 * Las obras publicables de una persona: admitidas, de ediciones con resultados publicados, con su
 * premio y su puesto según el ranking final.
 */
async function obrasDe(inscripciones: Inscripcion[]): Promise<PublishedWork[]> {
  if (inscripciones.length === 0) return [];
  const ids = inscripciones.map((i) => i.id);
  const edicionIds = [...new Set(inscripciones.map((i) => i.editionId))];

  const [envios, admitida, ediciones] = await Promise.all([
    prisma.clickatonPhotoSubmission.findMany({
      where: { registrationId: { in: ids }, status: "CONFIRMED" },
      select: { id: true, editionId: true, promptId: true },
    }),
    obrasAdmitidas(edicionIds),
    prisma.clickatonEdition.findMany({
      where: { id: { in: edicionIds } },
      select: { id: true, name: true, endAt: true },
    }),
  ]);
  const validos = envios.filter((e) => admitida.has(e.id));
  if (validos.length === 0) return [];

  const consignas = await prisma.clickatonPrompt.findMany({
    where: { id: { in: [...new Set(validos.map((v) => v.promptId))] } },
    select: { id: true, title: true, titleSnapshot: true, internalName: true },
  });
  const consigna = new Map(consignas.map((c) => [c.id, c.titleSnapshot ?? c.title ?? c.internalName]));
  const edicion = new Map(ediciones.map((e) => [e.id, e]));

  // El ranking de cada edición, una vez. Si no se puede leer, la obra sale sin puesto.
  const rankingPorObra = new Map<string, { premio: string | null; puesto: number | null }>();
  for (const editionId of edicionIds) {
    try {
      const resultados = await cargarResultadosDeEdicion(editionId);
      for (const fila of resultados?.filas ?? []) {
        if (fila.autor?.submissionId) {
          rankingPorObra.set(fila.autor.submissionId, { premio: fila.premio, puesto: fila.puesto });
        }
      }
    } catch (error) {
      console.error("[clickaton][clickatoner] no se pudo leer el ranking", {
        editionId,
        detalle: error instanceof Error ? error.message : "error desconocido",
      });
    }
  }

  return validos.map((v) => {
    const ranking = rankingPorObra.get(v.id);
    const ed = edicion.get(v.editionId);
    return {
      submissionId: v.id,
      editionId: v.editionId,
      editionName: ed?.name ?? "",
      editionEndAt: ed?.endAt ?? null,
      promptTitle: consigna.get(v.promptId) ?? null,
      premio: ranking?.premio ?? null,
      premioLabel: nombreDelPremio(ranking?.premio ?? null),
      puesto: ranking?.puesto ?? null,
    };
  });
}

/** La inscripción con la que se muestra a la persona: la de la edición más reciente. */
function inscripcionPrincipal(
  inscripciones: [Inscripcion, ...Inscripcion[]],
  obras: PublishedWork[],
): Inscripcion {
  const finDe = new Map(obras.map((o) => [o.editionId, o.editionEndAt?.getTime() ?? 0]));
  return (
    [...inscripciones].sort(
      (a, b) => (finDe.get(b.editionId) ?? 0) - (finDe.get(a.editionId) ?? 0),
    )[0] ?? inscripciones[0]
  );
}

/** La lista no vacía, o `null`: el resto del código trabaja con "al menos una inscripción". */
function noVacia(lista: Inscripcion[] | undefined): [Inscripcion, ...Inscripcion[]] | null {
  return lista && lista.length > 0 ? (lista as [Inscripcion, ...Inscripcion[]]) : null;
}

function azar(): number {
  return randomInt(0, 2 ** 32) / 2 ** 32;
}

/** Candado global: la tarea horaria y el panel pueden querer elegir a la vez. */
async function bloquear(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"clickaton:clickatoner"}))::text`;
}

async function asegurarPerfil(
  tx: Prisma.TransactionClient,
  email: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  const existente = await tx.clickatonPublicProfile.findUnique({ where: { email }, select: { id: true } });
  if (existente) return;
  const base = baseSlug(firstName, lastName);
  const tomados = await tx.clickatonPublicProfile.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  await tx.clickatonPublicProfile.create({
    data: { email, slug: freeSlug(base, new Set(tomados.map((t) => t.slug))) },
  });
}

async function elegirSiFalta(tx: Prisma.TransactionClient, weekStart: Date) {
  const vigente = await tx.clickatonClickatoner.findFirst({
    where: { weekStart, skippedAt: null },
    select: { id: true, email: true },
  });
  if (vigente) return vigente;

  const [personas, historia] = await Promise.all([
    inscripcionesElegibles(),
    tx.clickatonClickatoner.findMany({
      select: { email: true, round: true, weekStart: true, skippedAt: true },
    }),
  ]);

  const elegido = pickClickatoner({
    candidates: [...personas.keys()],
    history: historia.map((h) => ({
      email: h.email,
      round: h.round,
      weekStart: h.weekStart,
      skipped: h.skippedAt !== null,
    })),
    exclude: historia
      .filter((h) => h.skippedAt !== null && h.weekStart.getTime() === weekStart.getTime())
      .map((h) => h.email),
    random: azar,
  });
  if (!elegido) return null;

  const inscripciones = noVacia(personas.get(elegido.email));
  if (!inscripciones) return null;
  const obras = await obrasDe(inscripciones);
  const principal = inscripcionPrincipal(inscripciones, obras);
  const obra = pickFeaturedWork(obras);

  await asegurarPerfil(tx, elegido.email, principal.firstName, principal.lastName);
  return tx.clickatonClickatoner.create({
    data: {
      weekStart,
      round: elegido.round,
      email: elegido.email,
      registrationId: principal.id,
      submissionId: obra?.submissionId ?? null,
    },
    select: { id: true, email: true },
  });
}

/** Elige al clickatoner de esta semana si todavía no hay. Idempotente. */
export async function ensureCurrentClickatoner(now = new Date()) {
  const weekStart = clickatonerWeekStart(now);
  return prisma.$transaction(
    async (tx) => {
      await bloquear(tx);
      return elegirSiFalta(tx, weekStart);
    },
    // Leer los rankings puede tardar más que los 5 s que Prisma da por omisión.
    { timeout: 60_000, maxWait: 10_000 },
  );
}

export type ClickatonerCard = {
  id: string;
  weekStart: Date;
  fullName: string;
  firstName: string;
  place: string | null;
  instagramHandle: string | null;
  photoUrl: string | null;
  work: (PublishedWork & { imageUrl: string }) | null;
  profilePath: string | null;
};

function lugar(i: Pick<Inscripcion, "city" | "province">): string | null {
  const ciudad = i.city?.trim() || null;
  const provincia = i.province?.trim() || null;
  if (ciudad && provincia) {
    return ciudad.toLowerCase() === provincia.toLowerCase() ? ciudad : `${ciudad}, ${provincia}`;
  }
  return ciudad ?? provincia;
}

export function registrationPhotoPath(registrationId: string) {
  return `/api/public/clickatoners/fotos/${registrationId}`;
}

export function submissionImagePath(submissionId: string) {
  return `/api/public/clickatoners/obras/${submissionId}`;
}

export function profilePath(slug: string) {
  return `/clickatoners/${slug}`;
}

/**
 * El clickatoner de esta semana, listo para la portada. `null` si no hay o si dejó de poder
 * aparecer (pidió salir, su edición despublicó resultados): deja de mostrarse en el acto.
 */
export async function loadCurrentClickatoner(now = new Date()): Promise<ClickatonerCard | null> {
  const weekStart = clickatonerWeekStart(now);
  const fila = await prisma.clickatonClickatoner.findFirst({
    where: { weekStart, skippedAt: null },
    select: { id: true, weekStart: true, email: true, registrationId: true, submissionId: true },
  });
  if (!fila) return null;

  const personas = await inscripcionesElegibles(fila.email);
  const inscripciones = noVacia(personas.get(fila.email));
  if (!inscripciones) return null;
  const principal = inscripciones.find((i) => i.id === fila.registrationId) ?? inscripciones[0];

  const [obras, perfil] = await Promise.all([
    obrasDe(inscripciones),
    prisma.clickatonPublicProfile.findUnique({ where: { email: fila.email }, select: { slug: true } }),
  ]);
  const obra = obras.find((o) => o.submissionId === fila.submissionId) ?? pickFeaturedWork(obras);
  const obraCompleta = obra ? obras.find((o) => o.submissionId === obra.submissionId) ?? null : null;

  return {
    id: fila.id,
    weekStart: fila.weekStart,
    fullName: `${principal.firstName} ${principal.lastName}`.trim(),
    firstName: principal.firstName.trim(),
    place: lugar(principal),
    instagramHandle: principal.instagramHandle?.trim().replace(/^@+/, "") || null,
    photoUrl:
      principal.profilePhotoAssetId && principal.profilePhotoStatus === "READY"
        ? registrationPhotoPath(principal.id)
        : null,
    work: obraCompleta ? { ...obraCompleta, imageUrl: submissionImagePath(obraCompleta.submissionId) } : null,
    profilePath: perfil ? profilePath(perfil.slug) : null,
  };
}

export type ClickatonerProfile = {
  fullName: string;
  place: string | null;
  instagramHandle: string | null;
  photoUrl: string | null;
  works: (PublishedWork & { imageUrl: string })[];
};

/**
 * La página pública de un clickatoner. `null` —404— si no existe o si ya no puede aparecer: el
 * mismo 404 en los dos casos, para no confirmar que alguien existe.
 */
export async function loadClickatonerProfile(slug: string): Promise<ClickatonerProfile | null> {
  const perfil = await prisma.clickatonPublicProfile.findUnique({ where: { slug }, select: { email: true } });
  if (!perfil) return null;
  const inscripciones = noVacia((await inscripcionesElegibles(perfil.email)).get(perfil.email));
  if (!inscripciones) return null;

  const obras = await obrasDe(inscripciones);
  const principal = inscripcionPrincipal(inscripciones, obras);
  const conFoto = [...inscripciones].find((i) => i.profilePhotoAssetId && i.profilePhotoStatus === "READY");
  const fotoDe = principal.profilePhotoAssetId && principal.profilePhotoStatus === "READY" ? principal : conFoto;

  const ordenadas = [...obras].sort((a, b) => {
    const fa = a.editionEndAt?.getTime() ?? 0;
    const fb = b.editionEndAt?.getTime() ?? 0;
    if (fa !== fb) return fb - fa;
    return (a.puesto ?? Number.POSITIVE_INFINITY) - (b.puesto ?? Number.POSITIVE_INFINITY);
  });

  return {
    fullName: `${principal.firstName} ${principal.lastName}`.trim(),
    place: lugar(principal),
    instagramHandle: principal.instagramHandle?.trim().replace(/^@+/, "") || null,
    photoUrl: fotoDe ? registrationPhotoPath(fotoDe.id) : null,
    works: ordenadas.map((o) => ({ ...o, imageUrl: submissionImagePath(o.submissionId) })),
  };
}

/** Compuerta de la foto de perfil pública: sólo de una inscripción que hoy puede aparecer. */
export async function servablePhotoAsset(registrationId: string): Promise<string | null> {
  const insc = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: { email: true, profilePhotoAssetId: true, profilePhotoStatus: true },
  });
  if (!insc?.profilePhotoAssetId || insc.profilePhotoStatus !== "READY") return null;
  const clave = personKey(insc.email);
  const inscripciones = (await inscripcionesElegibles(clave)).get(clave);
  if (!inscripciones?.some((i) => i.id === registrationId)) return null;
  return insc.profilePhotoAssetId;
}

/** Compuerta de una obra pública: admitida, de una edición publicada y de alguien que puede aparecer. */
export async function servableSubmissionKey(submissionId: string): Promise<string | null> {
  const envio = await prisma.clickatonPhotoSubmission.findUnique({
    where: { id: submissionId },
    select: { registrationId: true, previewStorageKey: true, status: true },
  });
  if (!envio?.previewStorageKey || envio.status !== "CONFIRMED") return null;
  const insc = await prisma.clickatonRegistration.findUnique({
    where: { id: envio.registrationId },
    select: { email: true },
  });
  if (!insc) return null;
  const clave = personKey(insc.email);
  const inscripciones = (await inscripcionesElegibles(clave)).get(clave);
  if (!inscripciones?.length) return null;
  const obras = await obrasDe(inscripciones);
  return obras.some((o) => o.submissionId === submissionId) ? envio.previewStorageKey : null;
}

// ── Panel ──

export async function listEditionsForPublication() {
  const [ediciones, publicadas] = await Promise.all([
    prisma.clickatonEdition.findMany({
      where: { isOpsFixture: false },
      orderBy: [{ startAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true, status: true, startAt: true },
    }),
    prisma.clickatonEditionResultsPublication.findMany(),
  ]);
  const publicada = new Map(publicadas.map((p) => [p.editionId, p.publishedAt]));
  return ediciones.map((e) => ({ ...e, resultsPublishedAt: publicada.get(e.id) ?? null }));
}

export async function setEditionResultsPublished(input: {
  editionId: string;
  published: boolean;
  userId: number | null;
}): Promise<void> {
  if (input.published) {
    await prisma.clickatonEditionResultsPublication.upsert({
      where: { editionId: input.editionId },
      create: { editionId: input.editionId, publishedByUserId: input.userId },
      update: {},
    });
  } else {
    await prisma.clickatonEditionResultsPublication.deleteMany({ where: { editionId: input.editionId } });
  }
}

export async function listClickatonerHistory(take = 60) {
  const filas = await prisma.clickatonClickatoner.findMany({
    orderBy: [{ weekStart: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      weekStart: true,
      round: true,
      email: true,
      registrationId: true,
      skippedAt: true,
      skipReason: true,
    },
  });
  const inscripciones = await prisma.clickatonRegistration.findMany({
    where: { id: { in: filas.map((f) => f.registrationId) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nombre = new Map(inscripciones.map((i) => [i.id, `${i.firstName} ${i.lastName}`.trim()]));
  return filas.map((f) => ({ ...f, name: nombre.get(f.registrationId) ?? f.email }));
}

export async function countClickatonerCandidates(): Promise<number> {
  return (await inscripcionesElegibles()).size;
}

export async function skipCurrentClickatoner(input: {
  id: string;
  userId: number | null;
  reason: string | null;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const weekStart = clickatonerWeekStart(input.now ?? new Date());
  return prisma.$transaction(
    async (tx) => {
      await bloquear(tx);
      const fila = await tx.clickatonClickatoner.findFirst({
        where: { id: input.id, skippedAt: null, weekStart },
        select: { id: true },
      });
      if (!fila) return { ok: false as const, error: "Sólo se puede saltear al clickatoner de esta semana." };
      await tx.clickatonClickatoner.update({
        where: { id: fila.id },
        data: {
          skippedAt: new Date(),
          skippedByUserId: input.userId,
          skipReason: input.reason?.trim().slice(0, 200) || null,
        },
      });
      await elegirSiFalta(tx, weekStart);
      return { ok: true as const };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

// ── Mi cuenta ──

export async function isOptedOut(email: string): Promise<boolean> {
  const fila = await prisma.clickatonClickatonerOptOut.findUnique({ where: { email: personKey(email) } });
  return fila !== null;
}

export async function setOptOut(input: { email: string; userId: number; optOut: boolean }): Promise<void> {
  const email = personKey(input.email);
  if (input.optOut) {
    await prisma.clickatonClickatonerOptOut.upsert({
      where: { email },
      create: { email, userId: input.userId },
      update: {},
    });
  } else {
    await prisma.clickatonClickatonerOptOut.deleteMany({ where: { email } });
  }
}
