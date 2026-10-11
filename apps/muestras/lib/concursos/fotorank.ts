import "server-only";
import { prisma } from "@repo/db";
import {
  contestSelections, distinctionText, exhibitBasisFromRights, MARATHON_NOT_SUPPORTED, pickResultBatch, rankContestWorks,
  rightsFromConfigurationJson, USABLE_BATCH_STATUSES, type ContestTier, type ExhibitBasis, type ReviewStatus,
} from "@repo/muestras";
import { dondePuede } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";

/**
 * El ÚNICO lugar de Muestras que lee tablas de FotoRank (etapa 7, D4). Misma base, misma tabla `User`:
 * el autor de una obra es la misma cuenta con la que entra a Muestras.
 *
 * Fuente: el último lote de resultados FINALIZED o PUBLISHED, como diplomas, imágenes de ganadores y la
 * tienda de FOTOFFICE (la publicación oficial LIVE está trabada en producción). Lo ve sólo la organización
 * del concurso; lo público es la muestra, que pasa por su propia revisión.
 *
 * Lista cerrada de campos (el test la revisa): nunca códigos anónimos, puntajes, votos, jurados, notas,
 * metadata, email ni teléfono. Sólo lectura. Las maratones viven en la base de Clickatón: no se leen
 * (ni con el cliente cruzado) y una maratón que aparezca en esta base se rechaza con un mensaje claro.
 */
export const ROLES_QUE_ARMAN = ["OWNER", "ADMIN", "EDITOR"] as const;
const ES_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Admisión técnica que deja la obra fuera (como la tienda y los diplomas). Sin admisión cargada, cuenta. */
const ADMISION_FUERA = ["REJECTED", "EXCLUDED", "WITHDRAWN", "REPLACED"] as const;
/** Inscripciones que dejan fuera sus obras. Una obra sin inscripción (concursos viejos) cuenta. */
const INSCRIPCION_FUERA = ["DISQUALIFIED", "CANCELLED"] as const;
/** Concursos que no se llevan a una muestra: borradores y cancelados. */
const CONCURSO_FUERA = ["DRAFT", "CANCELLED"] as const;
const SIN_NOMBRE = "Autor/a sin nombre";
const TOPE_CONCURSOS = 50;

type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

export type MotivoSinResultados = "NO_EXISTE" | "MARATON" | "SIN_RESULTADOS";

const MENSAJES: Record<MotivoSinResultados, string> = {
  NO_EXISTE: "El concurso no existe.",
  MARATON: MARATHON_NOT_SUPPORTED,
  SIN_RESULTADOS:
    "Este concurso todavía no tiene resultados cerrados por el jurado. Cuando el jurado los cierre en FotoRank, vas a poder armar la muestra.",
};
export const mensajeDeResultados = (motivo: MotivoSinResultados): string => MENSAJES[motivo];

const esMaraton = (c: { experienceType: string; distributionChannel: string | null }) =>
  c.experienceType === "MARATHON" || c.distributionChannel === "CLICKATON";

// ── Permiso ─────────────────────────────────────────────────────────────────

/** D2/D3: super admin o miembro ACTIVE con rol OWNER/ADMIN/EDITOR de la organización del concurso. Se lee en cada acción. */
export async function puedeArmarDesdeConcurso(usuario: Quien, contestId: string): Promise<boolean> {
  if (typeof contestId !== "string" || !ES_ID.test(contestId)) return false;
  const c = await prisma.fotorankContest.findUnique({ where: { id: contestId }, select: { organizationId: true, status: true } });
  if (!c || (CONCURSO_FUERA as readonly string[]).includes(c.status)) return false;
  if (usuario.esSuperAdmin) return true;
  const n = await prisma.contestOrganizationMember.count({
    where: { organizationId: c.organizationId, userId: usuario.id, status: "ACTIVE", role: { in: [...ROLES_QUE_ARMAN] } },
  });
  return n > 0;
}

// ── Lectura de resultados ───────────────────────────────────────────────────

const LOTE_SELECT = { id: true, status: true, finalizedAt: true, publishedAt: true, updatedAt: true } as const;
type Lote = { id: string; status: string; finalizedAt: Date | null; publishedAt: Date | null; updatedAt: Date };

/** La fecha que se muestra: cuándo se publicó (si está publicado) o cuándo lo cerró el jurado. */
const fechaDelLote = (l: Lote): Date | null => (l.status === "PUBLISHED" ? (l.publishedAt ?? l.finalizedAt) : (l.finalizedAt ?? l.publishedAt));

/**
 * Resultados con premio (ganadores, menciones y finalistas: FotoRank marca a los finalistas con
 * `awardType = FINALIST`), con la cobertura del jurado completa y nunca descalificados, sin
 * seleccionar ni a revisar. Mismo criterio que las imágenes de ganadores (`design/winners.ts`).
 */
const filtroDeSeleccionadas = {
  awardType: { not: null },
  resultStatus: { notIn: ["NOT_SELECTED" as const, "REVIEW_REQUIRED" as const, "DISQUALIFIED" as const] },
  coverageStatus: "COMPLETE" as const,
};

/**
 * Obras que pueden ir a una muestra: confirmadas y sin retirar (como la tienda de FOTOFFICE), con la
 * admisión técnica sin rechazo y la inscripción sin descalificar ni cancelar.
 */
const obraVigente = {
  status: "CONFIRMED" as const,
  withdrawnAt: null,
  AND: [
    { OR: [{ admissionStatus: null }, { admissionStatus: { notIn: [...ADMISION_FUERA] } }] },
    { OR: [{ registrationId: null }, { registration: { status: { notIn: [...INSCRIPCION_FUERA] } } }] },
  ],
};

type FilaDeResultado = {
  juryEntrySnapshotId: string; categoryId: string; resultStatus: string; awardType: string | null;
  finalPosition: number | null; preliminaryPosition: number | null;
};

/**
 * Las obras vigentes de varios concursos a la vez (dos consultas en total, no dos por concurso):
 * resultado → foto del jurado → obra. Cada foto y cada obra tiene que ser del concurso de su lote.
 */
async function leerObrasVigentes(porConcurso: ReadonlyMap<string, readonly FilaDeResultado[]>) {
  const snapshotIds = [...new Set([...porConcurso.values()].flatMap((filas) => filas.map((f) => f.juryEntrySnapshotId)))];
  const snaps = snapshotIds.length
    ? await prisma.fotorankJuryEntrySnapshot.findMany({
        where: { id: { in: snapshotIds }, contestId: { in: [...porConcurso.keys()] } },
        select: { id: true, entryId: true, contestId: true },
      })
    : [];
  const entryIds = [...new Set(snaps.map((x) => x.entryId))];
  const obras = entryIds.length
    ? await prisma.fotorankContestEntry.findMany({
        where: { id: { in: entryIds }, contestId: { in: [...porConcurso.keys()] }, ...obraVigente },
        select: {
          id: true, contestId: true, title: true, entryNumber: true, authorUserId: true,
          // Las bases que firmó ESTE autor (no las vigentes), como `rightsAcceptedByAuthor` de la tienda.
          registration: { select: { rulesVersion: { select: { configurationVersion: { select: { configurationJson: true } } } } } },
        },
      })
    : [];
  return { snapshot: new Map(snaps.map((x) => [x.id, x])), obra: new Map(obras.map((o) => [o.id, o])) };
}

type ObrasVigentes = Awaited<ReturnType<typeof leerObrasVigentes>>;

/**
 * Por obra, el mejor resultado del lote (una obra en dos categorías sale una vez). Sólo las obras
 * vigentes de ese concurso.
 */
function seleccionadasDe(contestId: string, filas: readonly FilaDeResultado[], vigentes: ObrasVigentes) {
  // Se agrupa por obra (no por foto del jurado): así una obra repetida sale una vez, con su mejor premio.
  return contestSelections(
    filas.flatMap((f) => {
      const snap = vigentes.snapshot.get(f.juryEntrySnapshotId);
      const obra = snap && snap.contestId === contestId ? vigentes.obra.get(snap.entryId) : undefined;
      if (!obra || obra.contestId !== contestId) return [];
      return [{ snapshotId: obra.id, categoryId: f.categoryId, resultStatus: f.resultStatus, awardType: f.awardType, position: f.finalPosition ?? f.preliminaryPosition }];
    }),
  ).map(({ snapshotId, ...resto }) => ({ entryId: snapshotId, ...resto }));
}

/** Nombre del autor como la tienda (`authorNames`): perfil de FotoRank y, si no, la cuenta. Nunca el email. */
async function nombresDeAutores(userIds: readonly number[]): Promise<Map<number, string>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const [perfiles, usuarios] = await Promise.all([
    prisma.fotorankProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, displayName: true } }),
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
  ]);
  const perfil = new Map(perfiles.map((p) => [p.userId, p.displayName?.trim() || null]));
  const cuenta = new Map(usuarios.map((u) => [u.id, u.name?.trim() || null]));
  return new Map(ids.map((id) => [id, perfil.get(id) ?? cuenta.get(id) ?? SIN_NOMBRE]));
}

export type ObraDelConcurso = {
  entryId: string;
  authorUserId: number | null;
  authorName: string;
  title: string;
  tier: ContestTier;
  awardType: string | null;
  categoryId: string;
  categoryName: string;
  distinction: string;
  rank: number;
  exhibitBasis: ExhibitBasis;
  attributionRequired: boolean;
};

export type ResultadosDelConcurso =
  | { ok: false; motivo: MotivoSinResultados }
  | {
      ok: true;
      contest: {
        id: string; title: string; slug: string; shortDescription: string | null;
        organizationId: string; organizationName: string; visibility: string; status: string;
      };
      batch: { id: string; status: string; version: Date; date: Date | null };
      categories: { id: string; name: string; sortOrder: number }[];
      works: ObraDelConcurso[];
    };

/**
 * Los resultados del jurado para armar una muestra. Pide el permiso adentro (D2/D3): quien no organiza
 * el concurso recibe lo mismo que si no existiera.
 */
export async function resultadosDelConcurso(usuario: Quien, contestId: string): Promise<ResultadosDelConcurso> {
  if (typeof contestId !== "string" || !ES_ID.test(contestId)) return { ok: false, motivo: "NO_EXISTE" };
  if (!(await puedeArmarDesdeConcurso(usuario, contestId))) return { ok: false, motivo: "NO_EXISTE" };
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: {
      id: true, title: true, slug: true, shortDescription: true, visibility: true, status: true,
      experienceType: true, distributionChannel: true, organizationId: true,
      organization: { select: { name: true } },
      categories: { select: { id: true, name: true, sortOrder: true } },
    },
  });
  if (!contest || (CONCURSO_FUERA as readonly string[]).includes(contest.status)) return { ok: false, motivo: "NO_EXISTE" };
  if (esMaraton(contest)) return { ok: false, motivo: "MARATON" };

  const lotes = await prisma.fotorankResultBatch.findMany({
    where: { contestId, status: { in: [...USABLE_BATCH_STATUSES] } },
    select: LOTE_SELECT,
  });
  const lote = pickResultBatch(lotes);
  if (!lote) return { ok: false, motivo: "SIN_RESULTADOS" };

  const filas = await prisma.fotorankResultEntry.findMany({
    where: { resultBatchId: lote.id, ...filtroDeSeleccionadas },
    select: { juryEntrySnapshotId: true, categoryId: true, resultStatus: true, awardType: true, finalPosition: true, preliminaryPosition: true },
  });
  const vigentes = await leerObrasVigentes(new Map([[contestId, filas]]));
  const elegidas = seleccionadasDe(contestId, filas, vigentes);
  const obraPorId = vigentes.obra;
  const nombres = await nombresDeAutores(
    elegidas.map((e) => obraPorId.get(e.entryId)?.authorUserId).filter((x): x is number => x != null),
  );

  const categoria = new Map(contest.categories.map((c) => [c.id, c]));
  const unaSola = contest.categories.length === 1;
  const filasObra = elegidas.map((e) => {
    const obra = obraPorId.get(e.entryId)!;
    const derechos = rightsFromConfigurationJson(obra.registration?.rulesVersion?.configurationVersion?.configurationJson ?? null);
    const categoryName = categoria.get(e.categoryId)?.name?.trim() ?? "";
    return {
      entryId: e.entryId,
      authorUserId: obra.authorUserId,
      authorName: obra.authorUserId != null ? (nombres.get(obra.authorUserId) ?? SIN_NOMBRE) : SIN_NOMBRE,
      title: obra.title?.trim() || `Obra ${obra.entryNumber?.trim() || "sin número"}`,
      tier: e.tier,
      awardType: e.awardType,
      categoryId: e.categoryId,
      categoryName,
      distinction: distinctionText({ tier: e.tier, awardType: e.awardType, categoryName, singleCategory: unaSola }),
      position: e.position,
      exhibitBasis: exhibitBasisFromRights(derechos),
      attributionRequired: derechos?.attributionRequired === true,
    };
  });
  const works: ObraDelConcurso[] = rankContestWorks(filasObra, contest.categories).map((w) => ({
    entryId: w.entryId, authorUserId: w.authorUserId, authorName: w.authorName, title: w.title, tier: w.tier,
    awardType: w.awardType, categoryId: w.categoryId, categoryName: w.categoryName, distinction: w.distinction,
    rank: w.rank, exhibitBasis: w.exhibitBasis, attributionRequired: w.attributionRequired,
  }));

  return {
    ok: true,
    contest: {
      id: contest.id, title: contest.title, slug: contest.slug, shortDescription: contest.shortDescription,
      organizationId: contest.organizationId, organizationName: contest.organization.name,
      visibility: contest.visibility, status: contest.status,
    },
    batch: { id: lote.id, status: lote.status, version: lote.updatedAt, date: fechaDelLote(lote) },
    categories: contest.categories,
    works,
  };
}

// ── Concursos para armar ────────────────────────────────────────────────────

export type ConcursoParaArmar = {
  id: string;
  title: string;
  slug: string;
  organizationName: string;
  batchStatus: string;
  batchDate: Date | null;
  counts: Record<ContestTier, number>;
  muestras: { id: string; title: string; reviewStatus: ReviewStatus | string }[];
};

/**
 * Los concursos propios de FotoRank (no maratones) de las organizaciones donde la persona arma, con un
 * lote cerrado por el jurado o publicado. El super admin ve todos los que tienen lote (tope 50).
 */
export async function concursosParaArmar(usuario: Quien): Promise<ConcursoParaArmar[]> {
  let organizaciones: string[] | null = null;
  if (!usuario.esSuperAdmin) {
    const membresias = await prisma.contestOrganizationMember.findMany({
      where: { userId: usuario.id, status: "ACTIVE", role: { in: [...ROLES_QUE_ARMAN] } },
      select: { organizationId: true },
    });
    organizaciones = [...new Set(membresias.map((m) => m.organizationId))];
    if (organizaciones.length === 0) return [];
  }
  const usables = { status: { in: [...USABLE_BATCH_STATUSES] } };
  const concursos = await prisma.fotorankContest.findMany({
    where: {
      ...(organizaciones ? { organizationId: { in: organizaciones } } : {}),
      experienceType: "CONTEST",
      status: { notIn: [...CONCURSO_FUERA] },
      resultBatches: { some: usables },
    },
    orderBy: { updatedAt: "desc" },
    take: TOPE_CONCURSOS,
    select: {
      id: true, title: true, slug: true, experienceType: true, distributionChannel: true,
      organization: { select: { name: true } },
      resultBatches: { where: usables, select: LOTE_SELECT },
    },
  });

  const conLote = concursos.flatMap((c) => {
    const lote = esMaraton(c) ? null : pickResultBatch(c.resultBatches);
    return lote ? [{ c, lote }] : [];
  });
  if (conLote.length === 0) return [];

  const filas = await prisma.fotorankResultEntry.findMany({
    where: { resultBatchId: { in: conLote.map((x) => x.lote.id) }, ...filtroDeSeleccionadas },
    select: { resultBatchId: true, juryEntrySnapshotId: true, categoryId: true, resultStatus: true, awardType: true, finalPosition: true, preliminaryPosition: true },
  });
  const importados = await prisma.culturalContestImport.findMany({
    where: { contestId: { in: conLote.map((x) => x.c.id) }, activity: dondePuede(usuario, "view") },
    select: { contestId: true, activity: { select: { id: true, title: true, reviewStatus: true } } },
  });

  const filasDe = new Map(conLote.map(({ c, lote }) => [c.id, filas.filter((f) => f.resultBatchId === lote.id)]));
  const vigentes = await leerObrasVigentes(filasDe);
  return conLote.map(({ c, lote }): ConcursoParaArmar => {
    const counts: Record<ContestTier, number> = { WINNER: 0, MENTION: 0, FINALIST: 0 };
    for (const e of seleccionadasDe(c.id, filasDe.get(c.id) ?? [], vigentes)) counts[e.tier] += 1;
    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      organizationName: c.organization.name,
      batchStatus: lote.status,
      batchDate: fechaDelLote(lote),
      counts,
      muestras: importados.filter((i) => i.contestId === c.id).map((i) => i.activity),
    };
  });
}

// ── Lote vigente (aviso de "cambió") ────────────────────────────────────────

/**
 * Sólo el lote usable más nuevo (id y versión), para avisar en el panel "Del concurso" si los
 * resultados cambiaron desde el armado (D11). Liviano: no lee obras ni resultados. Nunca rompe la
 * página: ante cualquier error devuelve `undefined` (no se sabe) y el panel no avisa.
 */
export async function loteVigente(contestId: string): Promise<{ id: string; version: Date } | null | undefined> {
  if (typeof contestId !== "string" || !ES_ID.test(contestId)) return null;
  try {
    const lotes = await prisma.fotorankResultBatch.findMany({ where: { contestId, status: { in: [...USABLE_BATCH_STATUSES] } }, select: LOTE_SELECT });
    const lote = pickResultBatch(lotes);
    return lote ? { id: lote.id, version: lote.updatedAt } : null;
  } catch (err) {
    console.error("[muestras] concurso lote vigente:", err instanceof Error ? err.message : String(err));
    return undefined;
  }
}
