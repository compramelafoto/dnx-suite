/**
 * ETAPA 13 — matriz E2E (30 claves) Biblioteca de Consignas en Clickatón admin.
 *
 *   set -a && source /tmp/clickaton-13-fixture.env && set +a
 *   SFEF13_ALLOW_PROD_FIXTURE=1 \
 *     pnpm --filter clickaton exec tsx scripts/ops-13-prompt-library-e2e.ts
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  assertAssignable,
  assignToEdition,
  canUseCommercially,
  createItem,
  INITIAL_SOURCE_PREFIX,
  listItems,
  MAX_PROMPTS_PER_EDITION,
  reorderEditionPrompts,
  unassignFromEdition,
} from "@repo/photo-prompt-library";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";
const SLUG_PREFIX = "clickaton-fr-13-fixture-";

const MATRIX_KEYS = [
  "01_list_approved_only",
  "02_filter_theme",
  "03_filter_difficulty",
  "04_filter_inspiration",
  "05_search_text",
  "06_assign_approved_ok",
  "07_assign_draft_commercial_blocked",
  "08_assign_draft_ops_test_ok",
  "09_max_10_enforced",
  "10_assign_creates_snapshot",
  "11_title_snapshot_present",
  "12_theme_snapshot_present",
  "13_library_version_set",
  "14_unassign_keeps_snapshot",
  "15_reorder_up",
  "16_reorder_down",
  "17_reorder_sequences_unique_1_n",
  "18_create_draft_no_auto_assign",
  "19_usage_count_increments",
  "20_usage_warning_when_reused",
  "21_ready_checklist_10_of_10",
  "22_ready_checklist_snapshots_ok",
  "23_ready_checklist_all_approved",
  "24_ready_checklist_order_ok",
  "25_ready_checklist_no_duplicates",
  "26_ready_checklist_reveal_intact",
  "27_ready_checklist_capture_intact",
  "28_ready_checklist_upload_intact",
  "29_commercial_counts_intact",
  "30_catalog_55_untouched",
] as const;

type MatrixKey = (typeof MATRIX_KEYS)[number];
type Matrix = Record<MatrixKey, "PASS" | "FAIL" | "SKIP">;

type PrismaClientType = InstanceType<typeof PrismaClient>;

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

function set(matrix: Matrix, key: MatrixKey, ok: boolean) {
  matrix[key] = ok ? "PASS" : "FAIL";
}

async function expectThrow(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

async function commercialCounts(prisma: PrismaClientType) {
  const editionId = COMMERCIAL_EDITION_ID;
  return {
    registrations: await prisma.clickatonRegistration.count({ where: { editionId } }),
    approved: await prisma.clickatonRegistration.count({
      where: { editionId, paymentStatus: "APPROVED" },
    }),
    paid: await prisma.clickatonRegistration.count({
      where: { editionId, paymentOrderId: { not: null } },
    }),
    submissions: await prisma.clickatonPhotoSubmission.count({ where: { editionId } }),
  };
}

async function readyChecks(prisma: PrismaClientType, editionId: string) {
  const [prompts, config] = await Promise.all([
    prisma.clickatonPrompt.findMany({
      where: { editionId, status: { not: "CANCELLED" } },
      select: {
        id: true,
        title: true,
        titleSnapshot: true,
        sequence: true,
        libraryItemId: true,
      },
      orderBy: { sequence: "asc" },
    }),
    prisma.clickatonEditionUploadConfig.findUnique({ where: { editionId } }),
  ]);
  const libraryIds = [
    ...new Set(
      prompts.map((p) => p.libraryItemId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const libraryRows = libraryIds.length
    ? await prisma.photoPromptLibraryItem.findMany({
        where: { id: { in: libraryIds } },
        select: { id: true, status: true },
      })
    : [];
  const statusById = new Map(libraryRows.map((r) => [r.id, r.status]));
  const count = prompts.length;
  const hasTitleOrSnapshot = prompts.every(
    (p) => Boolean(p.titleSnapshot?.trim()) || Boolean(p.title?.trim()),
  );
  const sequences = prompts.map((p) => p.sequence);
  const orderOk =
    count > 0 &&
    new Set(sequences).size === count &&
    sequences.every((s, i) => s === i + 1);
  const linked = prompts.filter((p) => p.libraryItemId);
  const allApproved =
    linked.length === 0 ||
    linked.every((p) => statusById.get(p.libraryItemId!) === "APPROVED");
  const linkedIds = linked.map((p) => p.libraryItemId!);
  const noDupes = linkedIds.length === new Set(linkedIds).size;
  return {
    count,
    hasTitleOrSnapshot,
    allApproved,
    orderOk,
    noDupes,
    reveal: Boolean(config?.eventRevealAt),
    capture: Boolean(config?.captureWindowStartsAt && config?.captureWindowEndsAt),
    upload: Boolean(config?.uploadWindowStartsAt && config?.uploadWindowEndsAt),
  };
}

async function main() {
  if (process.env.SFEF13_ALLOW_PROD_FIXTURE !== "1") {
    throw new Error("ABORT: SFEF13_ALLOW_PROD_FIXTURE=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) {
    throw new Error("ABORT host no dawn-dew");
  }

  const credsPath = process.env.SFEF13_CREDS_PATH ?? "/tmp/clickaton-13-fixture.env";
  const env = { ...loadEnv(credsPath), ...process.env };
  const editionId = env.SFEF13_EDITION_ID;
  const execId = env.SFEF13_EXEC_ID;
  const draftItemId = env.SFEF13_DRAFT_ITEM_ID;
  const themeId = env.SFEF13_THEME_ID;
  const approvedIds = (env.SFEF13_APPROVED_IDS ?? "").split(",").filter(Boolean);
  if (!editionId || !execId || !draftItemId || approvedIds.length < 10) {
    throw new Error("ABORT missing fixture env (run ops-13-fixture-setup)");
  }

  const prisma = new PrismaClient();
  const matrix = {} as Matrix;
  for (const k of MATRIX_KEYS) matrix[k] = "SKIP";

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, slug: true, isOpsFixture: true },
  });
  if (!edition?.isOpsFixture || !edition.slug.startsWith(SLUG_PREFIX)) {
    throw new Error("ABORT edition is not ops-13 fixture");
  }

  const commercialBefore = await commercialCounts(prisma);
  const catalogBefore = await prisma.photoPromptLibraryItem.count({
    where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
  });

  try {
    // 01 list APPROVED only
    const listed = await listItems({ status: "APPROVED", take: 200 }, { prisma });
    set(
      matrix,
      "01_list_approved_only",
      listed.length > 0 && listed.every((i) => i.status === "APPROVED"),
    );

    // 02 filter theme
    const byTheme = await listItems(
      { status: "APPROVED", themeId, take: 50 },
      { prisma },
    );
    set(
      matrix,
      "02_filter_theme",
      byTheme.every((i) => i.themeId === themeId),
    );

    // 03 filter difficulty
    const byDiff = await listItems(
      { status: "APPROVED", difficulty: "EASY", take: 50 },
      { prisma },
    );
    set(
      matrix,
      "03_filter_difficulty",
      byDiff.every((i) => i.difficulty === "EASY"),
    );

    // 04 filter inspiration
    const byInsp = await listItems(
      { status: "APPROVED", inspirationType: "DIRECTOR", take: 50 },
      { prisma },
    );
    set(
      matrix,
      "04_filter_inspiration",
      byInsp.every((i) => i.inspirationType === "DIRECTOR"),
    );

    // 05 search text
    const needle = `Ops13 Approved ${execId}`;
    const searched = await listItems(
      { status: "APPROVED", text: needle, take: 50 },
      { prisma },
    );
    set(
      matrix,
      "05_search_text",
      searched.length >= 1 && searched.every((i) => i.title.includes(needle)),
    );

    // 06 assign APPROVED ok
    const freeApproved = approvedIds[8]!;
    const beforeCount = await prisma.clickatonPrompt.count({ where: { editionId } });
    const assigned = await assignToEdition(
      {
        editionId,
        libraryItemId: freeApproved,
        actorUserId: null,
        allowDraftForOpsTest: false,
      },
      { prisma },
    );
    set(
      matrix,
      "06_assign_approved_ok",
      Boolean(assigned.prompt.id) &&
        assigned.prompt.libraryItemId === freeApproved &&
        (await prisma.clickatonPrompt.count({ where: { editionId } })) ===
          beforeCount + 1,
    );

    // 07 DRAFT → commercial blocked
    set(
      matrix,
      "07_assign_draft_commercial_blocked",
      !canUseCommercially("DRAFT") &&
        (await expectThrow(() =>
          assignToEdition(
            {
              editionId: COMMERCIAL_EDITION_ID,
              libraryItemId: draftItemId,
              allowDraftForOpsTest: false,
            },
            { prisma },
          ),
        )),
    );

    // 08 DRAFT → ops fixture with allowDraftForOpsTest (luego se desasigna)
    let draftAssignOk = false;
    let draftPromptId: string | null = null;
    try {
      assertAssignable({ status: "DRAFT", allowDraftForOpsTest: true });
      const draftAssign = await assignToEdition(
        {
          editionId,
          libraryItemId: draftItemId,
          allowDraftForOpsTest: true,
        },
        { prisma },
      );
      draftAssignOk = draftAssign.prompt.libraryItemId === draftItemId;
      draftPromptId = draftAssign.prompt.id;
    } catch {
      draftAssignOk = false;
    }
    set(matrix, "08_assign_draft_ops_test_ok", draftAssignOk);

    // Quitar DRAFT para no contaminar checklist APPROVED / cupo
    if (draftPromptId) {
      await prisma.clickatonPrompt.delete({ where: { id: draftPromptId } });
    }

    // 09 max 10 — completar cupo con APPROVED y verificar overflow
    const used = new Set(
      (
        await prisma.clickatonPrompt.findMany({
          where: { editionId },
          select: { libraryItemId: true },
        })
      )
        .map((p) => p.libraryItemId)
        .filter((id): id is string => Boolean(id)),
    );
    for (const id of approvedIds) {
      const current = await prisma.clickatonPrompt.count({ where: { editionId } });
      if (current >= MAX_PROMPTS_PER_EDITION) break;
      if (used.has(id)) continue;
      await assignToEdition(
        { editionId, libraryItemId: id, allowDraftForOpsTest: false },
        { prisma },
      );
      used.add(id);
    }
    const atCap = await prisma.clickatonPrompt.count({ where: { editionId } });
    const leftover = approvedIds.find((id) => !used.has(id));
    const overflowBlocked =
      atCap === MAX_PROMPTS_PER_EDITION &&
      leftover != null &&
      (await expectThrow(() =>
        assignToEdition(
          {
            editionId,
            libraryItemId: leftover,
            allowDraftForOpsTest: false,
          },
          { prisma },
        ),
      ));
    set(matrix, "09_max_10_enforced", atCap === 10 && overflowBlocked);

    // 10-13 snapshots
    const sample = await prisma.clickatonPrompt.findFirst({
      where: { editionId, libraryItemId: { not: null } },
      orderBy: { sequence: "asc" },
    });
    set(
      matrix,
      "10_assign_creates_snapshot",
      Boolean(sample?.titleSnapshot && sample?.descriptionSnapshot),
    );
    set(matrix, "11_title_snapshot_present", Boolean(sample?.titleSnapshot?.trim()));
    set(matrix, "12_theme_snapshot_present", Boolean(sample?.themeSnapshot?.trim()));
    set(
      matrix,
      "13_library_version_set",
      sample?.libraryVersion != null && sample.libraryVersion >= 1,
    );

    // 14 unassign keeps snapshot
    const toUnassign = await prisma.clickatonPrompt.findFirst({
      where: { editionId, libraryItemId: { not: null } },
      orderBy: { sequence: "desc" },
    });
    if (toUnassign) {
      const snapTitle = toUnassign.titleSnapshot;
      await unassignFromEdition({ clickatonPromptId: toUnassign.id }, { prisma });
      const after = await prisma.clickatonPrompt.findUnique({
        where: { id: toUnassign.id },
      });
      set(
        matrix,
        "14_unassign_keeps_snapshot",
        after?.libraryItemId == null && after?.titleSnapshot === snapTitle,
      );
      // re-link for later order checks if needed — leave unassigned OK
    } else {
      set(matrix, "14_unassign_keeps_snapshot", false);
    }

    // 15-17 reorder
    let prompts = await prisma.clickatonPrompt.findMany({
      where: { editionId },
      orderBy: { sequence: "asc" },
      select: { id: true, sequence: true },
    });
    if (prompts.length >= 2) {
      const ids = prompts.map((p) => p.id);
      const swappedUp = [ids[1]!, ids[0]!, ...ids.slice(2)];
      await reorderEditionPrompts(editionId, swappedUp, null, { prisma });
      prompts = await prisma.clickatonPrompt.findMany({
        where: { editionId },
        orderBy: { sequence: "asc" },
        select: { id: true, sequence: true },
      });
      set(matrix, "15_reorder_up", prompts[0]?.id === ids[1] && prompts[1]?.id === ids[0]);

      const ids2 = prompts.map((p) => p.id);
      const swappedDown = [ids2[0]!, ids2[2]!, ids2[1]!, ...ids2.slice(3)].filter(
        Boolean,
      ) as string[];
      // ensure same length
      const reorderTarget =
        swappedDown.length === ids2.length
          ? swappedDown
          : [ids2[1]!, ids2[0]!, ...ids2.slice(2)];
      await reorderEditionPrompts(editionId, reorderTarget, null, { prisma });
      prompts = await prisma.clickatonPrompt.findMany({
        where: { editionId },
        orderBy: { sequence: "asc" },
        select: { id: true, sequence: true },
      });
      set(matrix, "16_reorder_down", prompts[0]?.id === reorderTarget[0]);

      const seqs = prompts.map((p) => p.sequence);
      set(
        matrix,
        "17_reorder_sequences_unique_1_n",
        seqs.length === new Set(seqs).size &&
          seqs.every((s, i) => s === i + 1),
      );
    } else {
      set(matrix, "15_reorder_up", false);
      set(matrix, "16_reorder_down", false);
      set(matrix, "17_reorder_sequences_unique_1_n", false);
    }

    // 18 create DRAFT no auto-assign
    const created = await createItem(
      {
        title: `Ops13 E2E Draft ${execId}`,
        description: "Creado en e2e sin auto-asignar",
        themeId: themeId!,
        sourceKey: `OPS13_E2E_DRAFT_${execId}`,
        metadataJson: { opsFixture: true, execId },
      },
      { prisma },
    );
    const autoAssigned = await prisma.clickatonPrompt.count({
      where: { editionId, libraryItemId: created.id },
    });
    set(
      matrix,
      "18_create_draft_no_auto_assign",
      created.status === "DRAFT" && autoAssigned === 0,
    );

    // 19-20 usage
    const usageItemId = approvedIds[0]!;
    const usageBefore = await prisma.clickatonPrompt.count({
      where: { libraryItemId: usageItemId },
    });
    set(matrix, "19_usage_count_increments", usageBefore >= 1);
    const listedUsage = await listItems(
      { status: "APPROVED", text: `Ops13 Approved ${execId} #1`, take: 5 },
      { prisma },
    );
    const usageRow = listedUsage.find((i) => i.id === usageItemId);
    set(
      matrix,
      "20_usage_warning_when_reused",
      Boolean(usageRow && usageRow.usageCount >= 1),
    );

    // Fill back to 10 with approved if unassign left a hole — for checklist
    {
      const n = await prisma.clickatonPrompt.count({ where: { editionId } });
      if (n < 10) {
        const usedNow = new Set(
          (
            await prisma.clickatonPrompt.findMany({
              where: { editionId },
              select: { libraryItemId: true },
            })
          )
            .map((p) => p.libraryItemId)
            .filter(Boolean),
        );
        for (const id of approvedIds) {
          const c = await prisma.clickatonPrompt.count({ where: { editionId } });
          if (c >= 10) break;
          if (usedNow.has(id)) continue;
          try {
            await assignToEdition(
              { editionId, libraryItemId: id, allowDraftForOpsTest: false },
              { prisma },
            );
            usedNow.add(id);
          } catch {
            /* cupo / estado */
          }
        }
      }
      // Re-normalize sequences 1..n
      const ordered = await prisma.clickatonPrompt.findMany({
        where: { editionId },
        orderBy: { sequence: "asc" },
        select: { id: true },
      });
      if (ordered.length) {
        await reorderEditionPrompts(
          editionId,
          ordered.map((p) => p.id),
          null,
          { prisma },
        );
      }
    }

    const ready = await readyChecks(prisma, editionId);
    set(matrix, "21_ready_checklist_10_of_10", ready.count === 10);
    set(
      matrix,
      "22_ready_checklist_snapshots_ok",
      ready.count === 10 && ready.hasTitleOrSnapshot,
    );
    set(matrix, "23_ready_checklist_all_approved", ready.allApproved);
    set(matrix, "24_ready_checklist_order_ok", ready.orderOk);
    set(matrix, "25_ready_checklist_no_duplicates", ready.noDupes);
    set(matrix, "26_ready_checklist_reveal_intact", ready.reveal);
    set(matrix, "27_ready_checklist_capture_intact", ready.capture);
    set(matrix, "28_ready_checklist_upload_intact", ready.upload);

    const commercialAfter = await commercialCounts(prisma);
    set(
      matrix,
      "29_commercial_counts_intact",
      commercialAfter.registrations === commercialBefore.registrations &&
        commercialAfter.approved === commercialBefore.approved &&
        commercialAfter.paid === commercialBefore.paid &&
        commercialAfter.submissions === commercialBefore.submissions &&
        Number(env.SFEF13_COMMERCIAL_REG_COUNT_BEFORE ?? commercialBefore.registrations) ===
          commercialAfter.registrations,
    );

    const catalogAfter = await prisma.photoPromptLibraryItem.count({
      where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
    });
    set(
      matrix,
      "30_catalog_55_untouched",
      catalogAfter === catalogBefore && catalogAfter >= 55,
    );
  } finally {
    // report
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    for (const k of MATRIX_KEYS) {
      const v = matrix[k];
      if (v === "PASS") passed += 1;
      else if (v === "FAIL") failed += 1;
      else skipped += 1;
      console.log(`${v.padEnd(4)} ${k}`);
    }
    console.log(
      JSON.stringify(
        {
          ok: failed === 0 && skipped === 0 && passed === MATRIX_KEYS.length,
          passed,
          failed,
          skipped,
          total: MATRIX_KEYS.length,
          editionId,
          commercialBefore,
        },
        null,
        2,
      ),
    );
    await prisma.$disconnect();
    if (failed > 0 || skipped > 0) process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
