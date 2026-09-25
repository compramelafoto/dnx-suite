/**
 * La aceptación de los términos del jurado.
 *
 * Se guarda en el `methodConfigJson` de sus asignaciones, más un evento de
 * auditoría: no hay tabla propia y no hace falta, porque lo que importa es
 * poder demostrar quién aceptó qué versión y cuándo.
 *
 * Lee y escribe en la base del concurso. Para una maratón de Clickatón eso es
 * la base de Clickatón, y preguntando en casa daba "concurso no encontrado"
 * justo cuando el jurado quería empezar.
 */
import { baseDelConcurso } from "./baseDelConcurso";
import { JuryError } from "./errors";
import { versionDeTerminos } from "./terminosDelJurado";

export type JuryTermsAcceptance = {
  juryTermsVersion: string;
  acceptedAt: string;
  contestId: string;
  source: string;
  locale: string;
};

function asConfig(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return { ...(raw as object) };
  return {};
}

export async function hasAcceptedJuryTerms(input: {
  judgeAccountId: string;
  contestId: string;
  termsVersion?: string;
}): Promise<boolean> {
  const { db, esDeClickaton } = await baseDelConcurso(input.contestId);
  const version = input.termsVersion ?? versionDeTerminos(esDeClickaton);
  const assignments = await db.fotorankJudgeAssignment.findMany({
    where: { judgeAccountId: input.judgeAccountId, contestId: input.contestId },
    select: { methodConfigJson: true },
    take: 20,
  });
  return assignments.some((a) => {
    const cfg = asConfig(a.methodConfigJson);
    const acc = cfg.juryTermsAcceptance as JuryTermsAcceptance | undefined;
    return acc?.juryTermsVersion === version && Boolean(acc.acceptedAt);
  });
}

export async function acceptJuryTerms(input: {
  judgeAccountId: string;
  contestId: string;
  source?: string;
  locale?: string;
  termsVersion?: string;
}) {
  const { db, esDeClickaton } = await baseDelConcurso(input.contestId);
  const version = input.termsVersion ?? versionDeTerminos(esDeClickaton);
  const contest = await db.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { id: true, organizationId: true, slug: true },
  });
  if (!contest) throw new JuryError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);

  const assignments = await db.fotorankJudgeAssignment.findMany({
    where: {
      judgeAccountId: input.judgeAccountId,
      contestId: input.contestId,
      assignmentStatus: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "EXTENDED"] },
    },
  });
  if (assignments.length === 0) {
    throw new JuryError("NO_ASSIGNMENT", "No tenés asignaciones en este concurso.", 403);
  }

  const acceptance: JuryTermsAcceptance = {
    juryTermsVersion: version,
    acceptedAt: new Date().toISOString(),
    contestId: input.contestId,
    source: input.source ?? "jury_panel",
    locale: input.locale ?? "es-AR",
  };

  for (const a of assignments) {
    const cfg = asConfig(a.methodConfigJson);
    await db.fotorankJudgeAssignment.update({
      where: { id: a.id },
      data: {
        methodConfigJson: {
          ...cfg,
          juryTermsAcceptance: acceptance,
        },
      },
    });
  }

  await db.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: contest.id,
      actorType: "JUDGE",
      actorJudgeId: input.judgeAccountId,
      eventType: "JURY_TERMS_ACCEPTED",
      entityType: "FotorankContest",
      entityId: contest.id,
      payloadJson: {
        juryTermsVersion: version,
        locale: acceptance.locale,
        source: acceptance.source,
        // sin PII
      },
    },
  });

  return { ok: true as const, acceptance };
}
