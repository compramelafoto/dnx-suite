import "server-only";
import type { Prisma } from "@repo/db";
import { MAX_WORKS, planContestImport, type ContestTier } from "@repo/muestras";
import type { ObraDelConcurso, ResultadosDelConcurso } from "./fotorank";
import { sincronizarObraConGaleria } from "./galeria";

/**
 * Armar y actualizar una muestra desde un concurso de FotoRank (etapa 7, D10 y D11). No es una acción
 * de servidor: lo llaman las acciones de `acciones.ts` **dentro de una transacción que ya bloqueó la
 * muestra** (`SELECT … FOR UPDATE`). Así dos pestañas, un doble clic o "Actualizar desde FotoRank" no
 * duplican obras y el tope técnico (`MAX_WORKS`) se cuenta con lo que la muestra tiene en ese momento.
 *
 * Idempotente: crea sólo las obras que faltan (en los niveles elegidos), actualiza premio, categoría y
 * orden de las que ya estaban (nunca la casilla, el título ni los permisos) y marca "Ya no figura en
 * los resultados" (`GONE`) a las que salieron, sin sacarlas: decide quien organiza.
 */

/** Corta la transacción con un texto para la persona. */
export class CorteDeArmado extends Error {}

type Resultados = Extract<ResultadosDelConcurso, { ok: true }>;

/**
 * Cuántas obras ocupan lugar en la muestra: las que ya están en la galería y las del concurso que
 * van a entrar cuando se copie su imagen o responda su autor (marcadas y sin un "no" del autor).
 */
async function lugaresOcupados(tx: Prisma.TransactionClient, activityId: string): Promise<number> {
  const [enLaGaleria, porEntrar] = await Promise.all([
    tx.culturalActivityWork.count({ where: { activityId } }),
    tx.culturalContestWork.count({
      where: { activityId, include: true, activityWorkId: null, exhibitConsent: { notIn: ["DECLINED", "WITHDRAWN"] } },
    }),
  ]);
  return enLaGaleria + porEntrar;
}

/** Los datos de la obra que vienen de FotoRank y se pisan al actualizar (nunca título ni permisos). */
const datosDelPremio = (w: ObraDelConcurso) => ({
  tier: w.tier, awardType: w.awardType, categoryId: w.categoryId, categoryName: w.categoryName, distinction: w.distinction, rank: w.rank,
});

export type ResultadoDelArmado = { creadas: number; actualizadas: number; gone: number; creadasIds: string[]; avisos: string[] };

export async function aplicarResultados(
  tx: Prisma.TransactionClient,
  p: { activityId: string; importId: string; resultados: Resultados; tiers: readonly ContestTier[]; ahora?: Date },
): Promise<ResultadoDelArmado> {
  const ahora = p.ahora ?? new Date();
  const { activityId, importId, resultados } = p;

  const existentes = await tx.culturalContestWork.findMany({
    where: { activityId },
    select: {
      id: true, entryId: true, include: true, sourceStatus: true, imageStatus: true, exhibitConsent: true, activityWorkId: true,
      tier: true, awardType: true, categoryId: true, categoryName: true, distinction: true, rank: true,
    },
  });
  const porEntrada = new Map(existentes.map((e) => [e.entryId, e]));
  const plan = planContestImport({
    selected: resultados.works,
    existing: new Map(existentes.map((e) => [e.entryId, { include: e.include, sourceStatus: e.sourceStatus }])),
    tiers: p.tiers,
    galleryCount: await lugaresOcupados(tx, activityId),
  });
  if (plan.problems.length) throw new CorteDeArmado(plan.problems.join(" "));
  // `planContestImport` ya lo mira; esto es la red por si cambia la regla.
  if (plan.create.length > MAX_WORKS) throw new CorteDeArmado(`La muestra admite hasta ${MAX_WORKS} obras.`);

  // Autores: uno por cuenta y muestra (los que ya estaban se conservan, con su firma y su perfil).
  const conCuenta = [...new Set(plan.create.flatMap((w) => (w.authorUserId != null ? [w.authorUserId] : [])))];
  if (conCuenta.length) {
    const [yaEstan, perfiles] = await Promise.all([
      tx.culturalContestAuthor.findMany({ where: { activityId, userId: { in: conCuenta } }, select: { userId: true } }),
      tx.photographerProfile.findMany({ where: { userId: { in: conCuenta } }, select: { id: true, userId: true } }),
    ]);
    const esta = new Set(yaEstan.map((a) => a.userId));
    const perfilDe = new Map(perfiles.map((x) => [x.userId, x.id]));
    const nuevos = conCuenta.filter((id) => !esta.has(id));
    if (nuevos.length) {
      await tx.culturalContestAuthor.createMany({
        data: nuevos.map((userId) => ({
          importId, activityId, userId,
          authorName: plan.create.find((w) => w.authorUserId === userId)!.authorName,
          profileId: perfilDe.get(userId) ?? null,
        })),
        // Otra transacción no puede haberlo creado (la muestra está bloqueada), pero si pasara, no se duplica.
        skipDuplicates: true,
      });
    }
  }
  // Autores sin cuenta (obras viejas o importadas, D22): una fila por obra, sólo al traerla.
  const sinCuenta = plan.create.filter((w) => w.authorUserId == null);
  if (sinCuenta.length) {
    await tx.culturalContestAuthor.createMany({ data: sinCuenta.map((w) => ({ importId, activityId, userId: null, authorName: w.authorName })) });
  }

  const creadasIds: string[] = [];
  for (const w of plan.create) {
    // Con bases que autorizan exhibir (D14), la obra entra sin esperar un clic; si no, espera al autor.
    const porBases = w.exhibitBasis === "RULES";
    const creada = await tx.culturalContestWork.create({
      data: {
        importId, activityId, entryId: w.entryId, authorUserId: w.authorUserId, authorName: w.authorName, title: w.title,
        ...datosDelPremio(w),
        exhibitBasis: w.exhibitBasis, attributionRequired: w.attributionRequired,
        exhibitConsent: porBases ? "ACCEPTED" : "PENDING",
        consentBy: porBases ? "RULES" : null,
        consentAt: porBases ? ahora : null,
      },
      select: { id: true },
    });
    creadasIds.push(creada.id);
  }

  let actualizadas = 0;
  for (const w of plan.update) {
    const e = porEntrada.get(w.entryId)!;
    const nuevo = { ...datosDelPremio(w), sourceStatus: "CURRENT" };
    const igual = (Object.keys(nuevo) as (keyof typeof nuevo)[]).every((k) => e[k] === nuevo[k]);
    if (igual) continue;
    await tx.culturalContestWork.update({ where: { id: e.id }, data: nuevo });
    actualizadas += 1;
  }

  if (plan.gone.length) {
    await tx.culturalContestWork.updateMany({ where: { activityId, entryId: { in: plan.gone } }, data: { sourceStatus: "GONE" } });
  }

  await tx.culturalContestImport.update({
    where: { id: importId },
    data: {
      contestSlug: resultados.contest.slug,
      contestTitle: resultados.contest.title,
      organizationName: resultados.contest.organizationName,
      tiers: [...p.tiers],
      resultBatchId: resultados.batch.id,
      resultBatchStatus: resultados.batch.status,
      sourceVersion: resultados.batch.version,
      syncedAt: ahora,
    },
  });

  // Re-armar: las que ya tenían imagen y permiso pero no están en la galería (p. ej. no entraron por
  // el tope) se vuelven a llevar. Las nuevas esperan su imagen.
  const avisos = new Set<string>();
  for (const e of existentes) {
    if (!e.include || e.imageStatus !== "COPIED" || e.exhibitConsent !== "ACCEPTED" || e.activityWorkId) continue;
    const s = await sincronizarObraConGaleria(tx, activityId, e.id);
    if (s.aviso) avisos.add(s.aviso);
  }

  return { creadas: creadasIds.length, actualizadas, gone: plan.gone.length, creadasIds, avisos: [...avisos] };
}
