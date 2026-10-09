"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { assemblyPlan, canDecide, canEdit, isWorkDecision, rankWorks, selectionRoom, type ReviewStatus } from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { frenarPorUsuario } from "@/lib/limite";
import type { ResultadoAccion } from "@/lib/actividades/acciones";

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La obra no existe."] };
const NO_EXISTE_CONV: ResultadoAccion = { ok: false, errores: ["La convocatoria no existe."] };
const YA_ARMADA = "La muestra ya se armó con esta selección.";

class Corte extends Error {}

/** Seleccionar, descartar o volver a pendiente una obra, durante la curaduría. */
export async function decidir(callWorkId: string, decision: string): Promise<ResultadoAccion> {
  if (typeof callWorkId !== "string" || !isWorkDecision(decision)) return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!frenarPorUsuario("decidir", usuario.id).allowed) return { ok: false, errores: ["Vas muy rápido. Esperá unos minutos."] };
  const w = await prisma.culturalCallWork.findUnique({
    where: { id: callWorkId },
    select: {
      id: true, callId: true, decision: true, anonymousCode: true,
      submission: { select: { status: true } },
      call: { select: { status: true, activity: { select: { id: true, proposedByUserId: true } } } },
    },
  });
  if (!w || !w.anonymousCode) return NO_EXISTE;
  if (w.call.activity.proposedByUserId !== usuario.id && !usuario.esSuperAdmin) return NO_EXISTE;
  if (!canDecide(w.call.status)) return { ok: false, errores: ["Sólo se decide durante la curaduría."] };
  if (w.submission?.status === "WITHDRAWN") return { ok: false, errores: ["Esa persona retiró su envío."] };
  try {
    await prisma.$transaction(async (tx) => {
      // Bloquea la convocatoria: dos "Seleccionar" a la vez no se pasan juntos del tope.
      await tx.$queryRaw`SELECT id FROM "CulturalCall" WHERE id = ${w.callId} FOR UPDATE`;
      if (decision === "SELECTED" && w.decision !== "SELECTED") {
        // Y la muestra, para contar sus obras sin que el editor las cambie en el medio.
        await tx.$queryRaw`SELECT id FROM "CulturalActivity" WHERE id = ${w.call.activity.id} FOR UPDATE`;
        const [enLaMuestra, elegidas] = await Promise.all([
          tx.culturalActivityWork.count({ where: { activityId: w.call.activity.id } }),
          tx.culturalCallWork.count({ where: { callId: w.callId, decision: "SELECTED" } }),
        ]);
        if (selectionRoom(enLaMuestra, elegidas) < 1) {
          throw new Corte("La muestra admite hasta 40 obras: para elegir otra, sacá alguna de la selección.");
        }
      }
      const { count } = await tx.culturalCallWork.updateMany({
        where: { id: callWorkId, call: { status: "CURATING" } },
        data: { decision, decidedAt: new Date() },
      });
      if (count === 0) throw new Corte("La curaduría cambió mientras tanto. Recargá la página.");
    });
  } catch (err) {
    if (err instanceof Corte) return { ok: false, errores: [err.message] };
    throw err;
  }
  revalidatePath(`/panel/convocatorias/${w.callId}/seleccion`);
  return { ok: true, id: callWorkId };
}

/**
 * Copia las obras seleccionadas de ESTA convocatoria a la galería de la muestra, en el orden del
 * ranking, con su autor (y su perfil de fotógrafo, si tiene). Todo en una transacción que primero
 * bloquea la fila de la convocatoria y después la de la muestra: un doble clic o dos pestañas no
 * duplican obras, y los topes se cuentan con lo que la muestra tiene en ese momento (el editor
 * escribe la misma fila de la muestra, así que espera o hace esperar).
 *
 * Es idempotente: sólo copia las elegidas que todavía no están en la galería. Una elegida cuya
 * obra copiada ya no existe (p. ej. se borró en el editor) cuenta como no copiada, así que se
 * puede volver a armar aunque la convocatoria ya tenga `assembledAt`.
 *
 * Las imágenes se copian tal cual (`imageUrl` en `muestras/<userId>/…`): ya son nuestras, procesadas.
 * La galería pública sólo existe después de cerrar la curaduría, cuando cada autor firma su obra.
 */
export async function armarMuestra(callId: string): Promise<ResultadoAccion> {
  if (typeof callId !== "string") return NO_EXISTE_CONV;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  let activityId = "";
  let slug = "";
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "CulturalCall" WHERE id = ${callId} FOR UPDATE`;
        const c = await tx.culturalCall.findUnique({
          where: { id: callId },
          select: {
            id: true, status: true, assembledAt: true,
            activity: { select: { id: true, slug: true, reviewStatus: true, proposedByUserId: true, workspaceId: true, isCancelled: true, rightsConfirmedAt: true } },
          },
        });
        if (!c || (c.activity.proposedByUserId !== usuario.id && !usuario.esSuperAdmin)) throw new Corte("La convocatoria no existe.");
        if (c.status !== "DONE") throw new Corte("Primero cerrá la curaduría.");
        const a = c.activity;
        if (!canEdit({ ...a, reviewStatus: a.reviewStatus as ReviewStatus }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin })) {
          throw new Corte("La muestra no se puede editar ahora (está en revisión o despublicada).");
        }

        // Bloquea la muestra antes de contar sus obras para los topes de 40 y 12.
        await tx.$queryRaw`SELECT id FROM "CulturalActivity" WHERE id = ${a.id} FOR UPDATE`;
        const actuales = await tx.culturalActivityWork.findMany({ where: { activityId: a.id }, select: { id: true, isHighlight: true } });
        const enLaGaleria = new Set(actuales.map((w) => w.id));

        // Sólo obras de esta convocatoria, vigentes y que no estén ya en la galería.
        const candidatas = await tx.culturalCallWork.findMany({
          where: { callId, decision: "SELECTED", submission: { status: "ACTIVE" } },
          select: { id: true, anonymousCode: true, decision: true, imageUrl: true, title: true, year: true, technique: true, activityWorkId: true, submission: { select: { authorName: true, userId: true } } },
        });
        const elegidas = candidatas.filter((e) => !e.activityWorkId || !enLaGaleria.has(e.activityWorkId));
        if (c.assembledAt && elegidas.length === 0) throw new Corte(YA_ARMADA);

        const puntajes = await tx.culturalCallScore.findMany({
          where: { callWorkId: { in: elegidas.map((e) => e.id) }, curator: { status: "ACTIVE" } },
          select: { callWorkId: true, score: true },
        });
        const perfiles = await tx.photographerProfile.findMany({
          where: { userId: { in: [...new Set(elegidas.map((e) => e.submission.userId))] } },
          select: { id: true, userId: true },
        });
        const perfilDe = new Map(perfiles.map((p) => [p.userId, p.id]));
        const porId = new Map(elegidas.map((e) => [e.id, e]));
        const enOrden = rankWorks(elegidas, puntajes).map((r) => {
          const e = porId.get(r.workId)!;
          return {
            callWorkId: e.id, imageUrl: e.imageUrl, title: e.title, year: e.year, technique: e.technique,
            authorName: e.submission.authorName, authorUserId: e.submission.userId, authorProfileId: perfilDe.get(e.submission.userId) ?? null,
          };
        });
        const plan = assemblyPlan(enOrden, { count: actuales.length, highlights: actuales.filter((w) => w.isHighlight).length });
        if (plan.problems.length) throw new Corte(plan.problems.join(" "));

        if (!c.assembledAt) {
          const { count } = await tx.culturalCall.updateMany({ where: { id: callId, status: "DONE", assembledAt: null }, data: { assembledAt: new Date() } });
          if (count === 0) throw new Corte(YA_ARMADA);
        }
        for (const o of plan.works) {
          const { callWorkId, ...obra } = o;
          const creada = await tx.culturalActivityWork.create({ data: { ...obra, activityId: a.id }, select: { id: true } });
          await tx.culturalCallWork.update({ where: { id: callWorkId }, data: { activityWorkId: creada.id } });
        }
        // Cada autor aceptó la autorización de derechos al enviar.
        if (!a.rightsConfirmedAt) await tx.culturalActivity.update({ where: { id: a.id }, data: { rightsConfirmedAt: new Date() } });
        activityId = a.id;
        slug = a.slug;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (err) {
    if (err instanceof Corte) return { ok: false, errores: [err.message] };
    throw err;
  }
  revalidatePath("/panel", "layout");
  revalidatePath(`/m/${slug}`, "layout");
  return { ok: true, id: activityId };
}
