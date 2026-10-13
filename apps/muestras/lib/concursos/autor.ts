"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import { CONTEST_EXHIBIT_TEXT_VERSION, EXHIBITOR_TEXT_LIMITS, contestConsentTransition, isContestConsentAction, temporalStatus, type ContestConsentAction } from "@repo/muestras";
import { frenarPorUsuario } from "@/lib/limite";
import { crearOActualizarPerfil } from "@/lib/perfiles/crear";
import { LARGOS_PERFIL, perfilDesdeFormData, type PerfilForm } from "@/lib/perfiles/mapear";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { sincronizarObraConGaleria } from "./galeria";
import { borrarImagenDeConcurso } from "./imagen";

/**
 * Lo que responde el autor de una obra traída de un concurso (etapa 7, D14 a D16, D19, D20, D28).
 * Todo se busca **por la cuenta** (`authorUserId`/`userId` = la sesión): con el id de otra persona,
 * la obra "no existe". Cada respuesta va en una transacción que bloquea la muestra y deja la galería
 * como dice la regla (`sincronizarObraConGaleria`).
 */
export type ResultadoAutor = { ok: true; id: string } | { ok: false; errores: string[] };

const error = (texto: string): ResultadoAutor => ({ ok: false, errores: [texto] });
const ES_ID = /^[A-Za-z0-9_-]{1,64}$/;
const OBRA_NO_EXISTE = "La obra no existe.";
const AUTOR_NO_EXISTE = "No encontramos tus obras en esta muestra.";
const OPCIONES_TX = { timeout: 30_000, maxWait: 10_000 } as const;
/** Lo que puede hacer el autor; la autorización escrita y preguntar la venta son de la organización. */
const ACCIONES_DEL_AUTOR: readonly ContestConsentAction[] = ["accept", "decline", "withdraw", "reconsider", "acceptSale", "declineSale"];
const CON_TEXTO: readonly ContestConsentAction[] = ["accept", "reconsider"];
const DE_VENTA: readonly ContestConsentAction[] = ["acceptSale", "declineSale"];

class Corte extends Error {}

/**
 * "Cómo firmás" y el perfil, como en el alta de expositores (etapa 6): si ya tiene perfil, del
 * formulario sólo cuenta la biografía (y sólo si la suya está vacía); si no, se crea con su nombre.
 */
async function datosDeFirma(fd: FormData, usuarioId: number): Promise<{ ok: true; firma: string; datos: PerfilForm } | { ok: false; errores: string[] }> {
  const firma = String(fd.get("firma") ?? "").trim().slice(0, EXHIBITOR_TEXT_LIMITS.displayName).trim();
  if (!firma) return { ok: false, errores: ["Poné cómo firmás tus obras."] };
  const tienePerfil = await prisma.photographerProfile.findUnique({ where: { userId: usuarioId }, select: { id: true } });
  if (tienePerfil) {
    const bio = String(fd.get("bio") ?? "").trim().slice(0, LARGOS_PERFIL.bio).trim();
    return { ok: true, firma, datos: { displayName: firma, slug: "", bio: bio || null, city: null, province: null, website: null, instagram: null, avatarUrl: null } };
  }
  const paraPerfil = new FormData();
  for (const k of ["displayName", "bio", "city", "province", "instagram", "avatarUrl"]) {
    const v = fd.get(k);
    if (typeof v === "string") paraPerfil.set(k, v);
  }
  if (!String(paraPerfil.get("displayName") ?? "").trim()) paraPerfil.set("displayName", firma);
  const leido = perfilDesdeFormData(paraPerfil);
  if (!leido.ok) return leido;
  return { ok: true, firma, datos: leido.perfil };
}

/** Guarda la firma y el perfil, y vuelve a sincronizar todas sus obras de la muestra (D28: firmar confirma el nombre). */
async function aplicarFirma(
  tx: Prisma.TransactionClient,
  p: { authorId: string; activityId: string; userId: number; firma: string; datos: PerfilForm },
): Promise<(string | undefined)[]> {
  const perfil = await crearOActualizarPerfil(tx, p.userId, p.datos);
  await tx.culturalContestAuthor.update({ where: { id: p.authorId }, data: { displayName: p.firma, profileId: perfil.id } });
  const suyas = await tx.culturalContestWork.findMany({ where: { activityId: p.activityId, authorUserId: p.userId }, select: { id: true } });
  const borrar: (string | undefined)[] = [];
  for (const o of suyas) borrar.push((await sincronizarObraConGaleria(tx, p.activityId, o.id)).borrarImagen);
  return borrar;
}

async function bloquear(tx: Prisma.TransactionClient, activityId: string) {
  await tx.$queryRaw`SELECT id FROM "CulturalActivity" WHERE id = ${activityId} FOR UPDATE`;
  const a = await tx.culturalActivity.findUnique({ where: { id: activityId }, select: { id: true, slug: true, startsAt: true, endsAt: true } });
  if (!a) throw new Corte(OBRA_NO_EXISTE);
  return a;
}

function refrescar(activityId: string, slug: string) {
  revalidatePath("/panel", "layout");
  revalidatePath(`/panel/muestras/${activityId}`, "layout");
  revalidatePath(`/m/${slug}`, "layout");
  revalidatePath("/fotografos", "layout");
}

async function borrarCopias(urls: readonly (string | undefined)[]) {
  for (const u of urls) if (u) await borrarImagenDeConcurso(u);
}

async function sesionYFreno(): Promise<{ usuario: Usuario } | { error: ResultadoAutor }> {
  const usuario = await getUsuario();
  if (!usuario) return { error: error("Tenés que ingresar.") };
  if (!frenarPorUsuario("respuestaAutor", usuario.id).allowed) return { error: error("Respondiste muchas veces seguidas. Esperá un rato y probá de nuevo.") };
  return { usuario };
}

/**
 * Aceptar, no aceptar, sacar o volver a aceptar que se exponga una obra, y responder sobre la venta
 * (D15, D16, D19). `version` tiene que ser la del texto vigente al aceptar. La primera aceptación
 * puede traer "Cómo firmás" (`firma`) y el perfil en el mismo formulario.
 */
export async function responderComoAutor(fd: FormData): Promise<ResultadoAutor> {
  const contestWorkId = fd.get("contestWorkId");
  const accion = fd.get("accion");
  if (typeof contestWorkId !== "string" || !ES_ID.test(contestWorkId)) return error(OBRA_NO_EXISTE);
  if (!isContestConsentAction(accion) || !ACCIONES_DEL_AUTOR.includes(accion)) return error("Esa respuesta no existe.");
  const s = await sesionYFreno();
  if ("error" in s) return s.error;
  const { usuario } = s;
  if (CON_TEXTO.includes(accion) && fd.get("version") !== CONTEST_EXHIBIT_TEXT_VERSION) {
    return error("Actualizá la página: cambió el texto de la autorización.");
  }

  // Siempre por la cuenta: la obra de otra persona no existe.
  const w = await prisma.culturalContestWork.findFirst({ where: { id: contestWorkId, authorUserId: usuario.id }, select: { id: true, activityId: true } });
  if (!w) return error(OBRA_NO_EXISTE);
  const autor = await prisma.culturalContestAuthor.findUnique({
    where: { activityId_userId: { activityId: w.activityId, userId: usuario.id } },
    select: { id: true, displayName: true },
  });
  if (!autor) return error(OBRA_NO_EXISTE);

  let firma: { firma: string; datos: PerfilForm } | null = null;
  if (CON_TEXTO.includes(accion) && String(fd.get("firma") ?? "").trim()) {
    const leida = await datosDeFirma(fd, usuario.id);
    if (!leida.ok) return { ok: false, errores: leida.errores };
    firma = leida;
  }

  const ahora = new Date();
  let slug = "";
  const borrar: (string | undefined)[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      const a = await bloquear(tx, w.activityId);
      slug = a.slug;
      const row = await tx.culturalContestWork.findFirst({
        where: { id: w.id, activityId: a.id, authorUserId: usuario.id },
        select: { id: true, include: true, forSale: true, exhibitBasis: true, exhibitConsent: true, saleConsent: true, updatedAt: true },
      });
      if (!row) throw new Corte(OBRA_NO_EXISTE);
      if (!row.include) throw new Corte("La organización sacó esta obra de la muestra.");
      const venta = DE_VENTA.includes(accion);
      if (venta && !row.forSale) throw new Corte("Esta obra no está ofrecida a la venta.");
      const t = contestConsentTransition(accion, row, { closed: temporalStatus(a, ahora) === "CLOSED" });
      if (!t.ok) throw new Corte(t.reason);
      const data: Prisma.CulturalContestWorkUpdateManyMutationInput = venta
        ? { saleConsent: t.next, saleConsentAt: ahora }
        : { exhibitConsent: t.next, consentBy: "AUTHOR", consentAt: ahora };
      // Contra la fila leída: si la organización la cambió en el medio, no se pisa.
      const { count } = await tx.culturalContestWork.updateMany({
        where: { id: row.id, activityId: a.id, authorUserId: usuario.id, updatedAt: row.updatedAt },
        data,
      });
      if (count === 0) throw new Corte("La obra cambió mientras tanto. Recargá la página.");
      await tx.culturalContestAuthor.update({
        where: { id: autor.id },
        data: CON_TEXTO.includes(accion) ? { respondedAt: ahora, textVersion: CONTEST_EXHIBIT_TEXT_VERSION } : { respondedAt: ahora },
      });
      if (firma) {
        borrar.push(...(await aplicarFirma(tx, { authorId: autor.id, activityId: a.id, userId: usuario.id, ...firma })));
      } else {
        borrar.push((await sincronizarObraConGaleria(tx, a.id, row.id)).borrarImagen);
      }
    }, OPCIONES_TX);
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  await borrarCopias(borrar);
  refrescar(w.activityId, slug);
  return { ok: true, id: w.id };
}

/**
 * "Cómo firmás" y el perfil de fotógrafo (D19, D28): `authorId` es la fila del autor en la muestra.
 * Firmar confirma el nombre: sus obras que figuraban como "Autoría reservada" pasan a su firma y a su
 * perfil. Vale también con la muestra cerrada (es su nombre).
 */
export async function guardarFirmaDeAutor(fd: FormData): Promise<ResultadoAutor> {
  const authorId = fd.get("authorId");
  if (typeof authorId !== "string" || !ES_ID.test(authorId)) return error(AUTOR_NO_EXISTE);
  const s = await sesionYFreno();
  if ("error" in s) return s.error;
  const { usuario } = s;
  const autor = await prisma.culturalContestAuthor.findFirst({ where: { id: authorId, userId: usuario.id }, select: { id: true, activityId: true } });
  if (!autor) return error(AUTOR_NO_EXISTE);
  const leida = await datosDeFirma(fd, usuario.id);
  if (!leida.ok) return { ok: false, errores: leida.errores };

  let slug = "";
  let borrar: (string | undefined)[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      const a = await bloquear(tx, autor.activityId);
      slug = a.slug;
      borrar = await aplicarFirma(tx, { authorId: autor.id, activityId: a.id, userId: usuario.id, firma: leida.firma, datos: leida.datos });
    }, OPCIONES_TX);
  } catch (err) {
    if (err instanceof Corte) return error(AUTOR_NO_EXISTE);
    throw err;
  }
  await borrarCopias(borrar);
  refrescar(autor.activityId, slug);
  return { ok: true, id: autor.id };
}
