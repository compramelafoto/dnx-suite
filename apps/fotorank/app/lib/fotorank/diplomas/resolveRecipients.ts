import { prisma } from "@repo/db";
import { getFotorankCategoryJudgeResults } from "../judgeResultsForCategory";
import type {
  DiplomaIssuanceMode,
  PlanRow,
  DiplomaPlanResult,
  FotorankDiplomaRecipientType,
} from "./issuanceTypes";

function emptyPlan(): DiplomaPlanResult {
  return {
    rows: [],
    errorRowCount: 0,
    warningRowCount: 0,
    okRowCount: 0,
    globalWarnings: [],
  };
}

function summarizePlan(rows: PlanRow[], globalWarnings: string[]): DiplomaPlanResult {
  const errorRowCount = rows.filter((r) => r.errors.length > 0).length;
  const warningRowCount = rows.filter((r) => r.warnings.length > 0 && r.errors.length === 0).length;
  const okRowCount = rows.filter((r) => r.errors.length === 0).length;
  return { rows, errorRowCount, warningRowCount, okRowCount, globalWarnings };
}

async function loadEntriesWithAuthors(contestId: string) {
  return prisma.fotorankContestEntry.findMany({
    where: { contestId },
    select: {
      id: true,
      title: true,
      categoryId: true,
      authorUserId: true,
      author: { select: { id: true, name: true, email: true } },
      category: { select: { id: true, name: true } },
    },
  });
}

export async function resolveDiplomaPlanRows(params: {
  contestId: string;
  mode: DiplomaIssuanceMode;
  categoryId?: string | null;
  /** Finalistas: top N por categoría (default 3). Ganadores: se fuerza 1. */
  topN?: number;
  manualEntryIds?: string[];
  collaboratorNames?: string[];
  singleEntryId?: string | null;
  singleJudgeAccountId?: string | null;
  singleParticipantUserId?: number | null;
  singleCollaboratorName?: string | null;
  stampPrizeLabel?: string | null;
}): Promise<DiplomaPlanResult> {
  const {
    contestId,
    mode,
    categoryId,
    topN = 3,
    manualEntryIds,
    collaboratorNames,
    singleEntryId,
    singleJudgeAccountId,
    singleParticipantUserId,
    singleCollaboratorName,
    stampPrizeLabel,
  } = params;

  const globalWarnings: string[] = [];
  const stamp = stampPrizeLabel?.trim() || null;

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, slug: true },
  });
  if (!contest) return emptyPlan();

  const entries = await loadEntriesWithAuthors(contestId);

  const pushRow = (rows: PlanRow[], r: PlanRow) => {
    rows.push(r);
  };

  if (mode === "SINGLE_COLLABORATOR") {
    const name = singleCollaboratorName?.trim();
    if (!name) {
      return summarizePlan(
        [
          {
            key: "single-collab",
            recipientType: "COLLABORATOR",
            recipientName: "",
            recipientUserId: null,
            entryId: null,
            judgeAccountId: null,
            contestCategoryId: null,
            prizeLabel: stamp,
            entryTitle: null,
            errors: ["Falta el nombre del colaborador."],
            warnings: [],
          },
        ],
        globalWarnings
      );
    }
    return summarizePlan(
      [
        {
          key: `collab:${name}`,
          recipientType: "COLLABORATOR",
          recipientName: name,
          recipientUserId: null,
          entryId: null,
          judgeAccountId: null,
          contestCategoryId: null,
          prizeLabel: stamp,
          entryTitle: null,
          errors: [],
          warnings: [],
        },
      ],
      globalWarnings
    );
  }

  if (mode === "SINGLE_PARTICIPANT") {
    const uid = singleParticipantUserId;
    if (uid == null) {
      return summarizePlan(
        [
          {
            key: "single-user",
            recipientType: "PARTICIPANT",
            recipientName: "",
            recipientUserId: null,
            entryId: null,
            judgeAccountId: null,
            contestCategoryId: null,
            prizeLabel: stamp,
            entryTitle: null,
            errors: ["Falta el participante."],
            warnings: [],
          },
        ],
        globalWarnings
      );
    }
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, name: true, email: true },
    });
    const name = user?.name?.trim() || user?.email || `Usuario #${uid}`;
    const hasEntry = entries.some((e) => e.authorUserId === uid);
    const warnings: string[] = [];
    if (!hasEntry) warnings.push("Este usuario no tiene obras en el concurso.");
    return summarizePlan(
      [
        {
          key: `user:${uid}`,
          recipientType: "PARTICIPANT",
          recipientName: name,
          recipientUserId: uid,
          entryId: null,
          judgeAccountId: null,
          contestCategoryId: null,
          prizeLabel: stamp,
          entryTitle: null,
          errors: [],
          warnings,
        },
      ],
      globalWarnings
    );
  }

  if (mode === "SINGLE_JUDGE") {
    const jid = singleJudgeAccountId?.trim();
    if (!jid) {
      return summarizePlan(
        [
          {
            key: "single-judge",
            recipientType: "JUDGE",
            recipientName: "",
            recipientUserId: null,
            entryId: null,
            judgeAccountId: null,
            contestCategoryId: null,
            prizeLabel: stamp,
            entryTitle: null,
            errors: ["Falta el jurado."],
            warnings: [],
          },
        ],
        globalWarnings
      );
    }
    const ja = await prisma.fotorankJudgeAccount.findUnique({
      where: { id: jid },
      select: {
        id: true,
        profile: { select: { firstName: true, lastName: true } },
        email: true,
      },
    });
    const assigned = await prisma.fotorankJudgeAssignment.findFirst({
      where: { contestId, judgeAccountId: jid },
      select: { id: true },
    });
    const name = ja
      ? `${ja.profile?.firstName ?? ""} ${ja.profile?.lastName ?? ""}`.trim() || ja.email
      : "";
    const errors: string[] = [];
    if (!ja) errors.push("Jurado no encontrado.");
    else if (!assigned) errors.push("El jurado no tiene asignación en este concurso.");
    const warnings: string[] = [];
    return summarizePlan(
      [
        {
          key: `judge:${jid}`,
          recipientType: "JUDGE",
          recipientName: name || "—",
          recipientUserId: null,
          entryId: null,
          judgeAccountId: jid,
          contestCategoryId: null,
          prizeLabel: stamp,
          entryTitle: null,
          errors,
          warnings,
        },
      ],
      globalWarnings
    );
  }

  if (mode === "SINGLE_ENTRY") {
    const eid = singleEntryId?.trim();
    if (!eid) {
      return summarizePlan(
        [
          {
            key: "single-entry",
            recipientType: "ENTRY",
            recipientName: "",
            recipientUserId: null,
            entryId: null,
            judgeAccountId: null,
            contestCategoryId: null,
            prizeLabel: stamp,
            entryTitle: null,
            errors: ["Falta la obra."],
            warnings: [],
          },
        ],
        globalWarnings
      );
    }
    const e = entries.find((x) => x.id === eid);
    if (!e) {
      return summarizePlan(
        [
          {
            key: `entry:${eid}`,
            recipientType: "ENTRY",
            recipientName: "",
            recipientUserId: null,
            entryId: eid,
            judgeAccountId: null,
            contestCategoryId: null,
            prizeLabel: stamp,
            entryTitle: null,
            errors: ["La obra no pertenece a este concurso."],
            warnings: [],
          },
        ],
        globalWarnings
      );
    }
    const name =
      e.title?.trim() ||
      e.author?.name?.trim() ||
      e.author?.email ||
      `Obra ${e.id.slice(-6)}`;
    return summarizePlan(
      [
        {
          key: `entry:${e.id}`,
          recipientType: "ENTRY",
          recipientName: name,
          recipientUserId: e.authorUserId,
          entryId: e.id,
          judgeAccountId: null,
          contestCategoryId: e.categoryId,
          prizeLabel: stamp,
          entryTitle: e.title?.trim() || null,
          errors: [],
          warnings: [],
        },
      ],
      globalWarnings
    );
  }

  if (mode === "COLLABORATOR_NAMES") {
    const names = (collaboratorNames ?? []).map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) {
      globalWarnings.push("No hay nombres de colaboradores en el lote.");
      return summarizePlan([], globalWarnings);
    }
    const rows: PlanRow[] = names.map((name) => ({
      key: `collab:${name}`,
      recipientType: "COLLABORATOR" as const,
      recipientName: name,
      recipientUserId: null,
      entryId: null,
      judgeAccountId: null,
      contestCategoryId: null,
      prizeLabel: stamp,
      entryTitle: null,
      errors: [],
      warnings: [],
    }));
    return summarizePlan(rows, globalWarnings);
  }

  if (mode === "MANUAL_ENTRY_IDS") {
    const ids = manualEntryIds ?? [];
    if (ids.length === 0) {
      globalWarnings.push("No seleccionaste obras.");
      return summarizePlan([], globalWarnings);
    }
    const rows: PlanRow[] = [];
    for (const eid of ids) {
      const e = entries.find((x) => x.id === eid);
      if (!e) {
        pushRow(rows, {
          key: `entry:${eid}`,
          recipientType: "ENTRY",
          recipientName: "",
          recipientUserId: null,
          entryId: eid,
          judgeAccountId: null,
          contestCategoryId: null,
          prizeLabel: stamp,
          entryTitle: null,
          errors: ["Obra no encontrada en el concurso."],
          warnings: [],
        });
        continue;
      }
      const name =
        e.title?.trim() ||
        e.author?.name?.trim() ||
        e.author?.email ||
        `Obra ${e.id.slice(-6)}`;
      pushRow(rows, {
        key: `entry:${e.id}`,
        recipientType: "ENTRY",
        recipientName: name,
        recipientUserId: e.authorUserId,
        entryId: e.id,
        judgeAccountId: null,
        contestCategoryId: e.categoryId,
        prizeLabel: stamp,
        entryTitle: e.title?.trim() || null,
        errors: [],
        warnings: [],
      });
    }
    return summarizePlan(rows, globalWarnings);
  }

  if (mode === "ALL_JUDGES") {
    const assignments = await prisma.fotorankJudgeAssignment.findMany({
      where: { contestId },
      select: { judgeAccountId: true },
    });
    const judgeIds = [...new Set(assignments.map((a) => a.judgeAccountId))];
    if (judgeIds.length === 0) {
      globalWarnings.push("No hay jurados asignados a este concurso.");
      return summarizePlan([], globalWarnings);
    }
    const judges = await prisma.fotorankJudgeAccount.findMany({
      where: { id: { in: judgeIds } },
      select: {
        id: true,
        email: true,
        profile: { select: { firstName: true, lastName: true } },
      },
    });
    const rows: PlanRow[] = judges.map((ja) => {
      const name =
        `${ja.profile?.firstName ?? ""} ${ja.profile?.lastName ?? ""}`.trim() || ja.email;
      return {
        key: `judge:${ja.id}`,
        recipientType: "JUDGE" as const,
        recipientName: name,
        recipientUserId: null,
        entryId: null,
        judgeAccountId: ja.id,
        contestCategoryId: null,
        prizeLabel: stamp,
        entryTitle: null,
        errors: [],
        warnings: [],
      };
    });
    return summarizePlan(rows, globalWarnings);
  }

  const needCategory =
    mode === "BY_CATEGORY_ENTRIES" || mode === "BY_CATEGORY_PARTICIPANTS";
  if (needCategory && !categoryId?.trim()) {
    globalWarnings.push("Elegí una categoría para este modo de emisión.");
    return summarizePlan([], globalWarnings);
  }

  const filteredEntries = categoryId?.trim()
    ? entries.filter((e) => e.categoryId === categoryId)
    : entries;

  if (mode === "BY_CATEGORY_ENTRIES") {
    if (filteredEntries.length === 0) {
      globalWarnings.push("No hay obras en la categoría seleccionada.");
      return summarizePlan([], globalWarnings);
    }
    const rows: PlanRow[] = filteredEntries.map((e) => ({
      key: `entry:${e.id}`,
      recipientType: "ENTRY" as const,
      recipientName:
        e.title?.trim() ||
        e.author?.name?.trim() ||
        e.author?.email ||
        `Obra ${e.id.slice(-6)}`,
      recipientUserId: e.authorUserId,
      entryId: e.id,
      judgeAccountId: null,
      contestCategoryId: e.categoryId,
      prizeLabel: stamp,
      entryTitle: e.title?.trim() || null,
      errors: [],
      warnings: [],
    }));
    return summarizePlan(rows, globalWarnings);
  }

  if (mode === "BY_CATEGORY_PARTICIPANTS") {
    const byUser = new Map<number, (typeof entries)[0]>();
    for (const e of filteredEntries) {
      if (e.authorUserId != null && !byUser.has(e.authorUserId)) byUser.set(e.authorUserId, e);
    }
    if (byUser.size === 0) {
      globalWarnings.push("No hay autores con usuario en esa categoría.");
      return summarizePlan([], globalWarnings);
    }
    const rows: PlanRow[] = [];
    for (const e of byUser.values()) {
      const uid = e.authorUserId!;
      const name = e.author?.name?.trim() || e.author?.email || `Usuario #${uid}`;
      rows.push({
        key: `user:${uid}:cat:${categoryId}`,
        recipientType: "PARTICIPANT",
        recipientName: name,
        recipientUserId: uid,
        entryId: null,
        judgeAccountId: null,
        contestCategoryId: categoryId!.trim(),
        prizeLabel: stamp,
        entryTitle: e.title?.trim() || null,
        errors: [],
        warnings: [],
      });
    }
    return summarizePlan(rows, globalWarnings);
  }

  if (mode === "ALL_ENTRIES") {
    if (entries.length === 0) {
      globalWarnings.push("El concurso no tiene obras.");
      return summarizePlan([], globalWarnings);
    }
    const rows: PlanRow[] = entries.map((e) => ({
      key: `entry:${e.id}`,
      recipientType: "ENTRY" as const,
      recipientName:
        e.title?.trim() ||
        e.author?.name?.trim() ||
        e.author?.email ||
        `Obra ${e.id.slice(-6)}`,
      recipientUserId: e.authorUserId,
      entryId: e.id,
      judgeAccountId: null,
      contestCategoryId: e.categoryId,
      prizeLabel: stamp,
      entryTitle: e.title?.trim() || null,
      errors: [],
      warnings: !e.authorUserId ? ["La obra no tiene autor vinculado a usuario."] : [],
    }));
    return summarizePlan(rows, globalWarnings);
  }

  if (mode === "ALL_PARTICIPANTS") {
    const byUser = new Map<number, (typeof entries)[0]>();
    for (const e of entries) {
      if (e.authorUserId != null && !byUser.has(e.authorUserId)) byUser.set(e.authorUserId, e);
    }
    if (byUser.size === 0) {
      globalWarnings.push("Ninguna obra tiene autor con usuario.");
      return summarizePlan([], globalWarnings);
    }
    const rows: PlanRow[] = [];
    for (const e of byUser.values()) {
      const uid = e.authorUserId!;
      const name = e.author?.name?.trim() || e.author?.email || `Usuario #${uid}`;
      rows.push({
        key: `user:${uid}`,
        recipientType: "PARTICIPANT",
        recipientName: name,
        recipientUserId: uid,
        entryId: null,
        judgeAccountId: null,
        contestCategoryId: null,
        prizeLabel: stamp,
        entryTitle: e.title?.trim() || null,
        errors: [],
        warnings: [],
      });
    }
    return summarizePlan(rows, globalWarnings);
  }

  if (mode === "FINALISTS" || mode === "WINNERS") {
    const n = mode === "WINNERS" ? 1 : Math.max(1, topN);
    const categories = await prisma.fotorankContestCategory.findMany({
      where: { contestId },
      select: { id: true, name: true },
    });
    if (categories.length === 0) {
      globalWarnings.push("El concurso no tiene categorías.");
      return summarizePlan([], globalWarnings);
    }
    const picked = new Map<string, PlanRow>();
    for (const cat of categories) {
      const res = await getFotorankCategoryJudgeResults({ contestId, categoryId: cat.id });
      if (!res.ok) {
        globalWarnings.push(
          `Categoría «${cat.name}»: no se pudo calcular ranking (${res.code === "AMBIGUOUS_METHOD" ? "métodos de evaluación mezclados" : "sin datos"}).`
        );
        continue;
      }
      if (res.variant === "NO_ASSIGNMENTS") {
        globalWarnings.push(
          `Categoría «${cat.name}»: sin asignaciones de jurado; no hay finalistas calculados.`
        );
        continue;
      }
      const slice = res.ranked.slice(0, n);
      for (const r of slice) {
        const e = entries.find((x) => x.id === r.entryId);
        const name =
          e?.title?.trim() ||
          r.title?.trim() ||
          e?.author?.name?.trim() ||
          e?.author?.email ||
          `Obra ${r.entryId.slice(-6)}`;
        const rt: FotorankDiplomaRecipientType = mode === "WINNERS" ? "ENTRY" : "ENTRY";
        const prize =
          mode === "WINNERS"
            ? stamp || `Ganador — ${cat.name}`
            : stamp || `Finalista — ${cat.name}`;
        picked.set(r.entryId, {
          key: `entry:${r.entryId}`,
          recipientType: rt,
          recipientName: name,
          recipientUserId: e?.authorUserId ?? null,
          entryId: r.entryId,
          judgeAccountId: null,
          contestCategoryId: cat.id,
          prizeLabel: prize,
          entryTitle: e?.title?.trim() || r.title?.trim() || null,
          errors: [],
          warnings:
            mode === "FINALISTS"
              ? [`Puesto ${r.rankPosition} en «${cat.name}» (según votación).`]
              : [`Ganador por ranking en «${cat.name}».`],
        });
      }
    }
    const rows = [...picked.values()];
    if (rows.length === 0 && globalWarnings.length === 0) {
      globalWarnings.push("No se pudo armar el lote: revisá categorías y jurado.");
    }
    return summarizePlan(rows, globalWarnings);
  }

  globalWarnings.push("Modo de emisión no reconocido.");
  return summarizePlan([], globalWarnings);
}
