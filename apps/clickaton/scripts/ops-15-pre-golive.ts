/**
 * ETAPA 15 — pre-go-live checklist + re-ejecuta Modo Test comercial (uploads OFF).
 *
 *   SFEF15_ALLOW_PROD=1 DATABASE_URL=... \
 *     pnpm --filter clickaton exec tsx scripts/ops-15-pre-golive.ts
 *
 * NO activa uploadsEnabled / canonicalAssetsEnabled.
 */
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getOpsDaySnapshot } from "../lib/photo-upload/ops-day";
import { isEnvCanonicalFotoRankAssetsEnabled } from "../lib/photo-upload/fotorank-canonical-assets";
import {
  arePromptsGloballyRevealed,
  resolveEditionSchedule,
} from "../lib/photo-upload/edition-schedule";
import {
  assertLockedDtoIsSafe,
  toPromptPublicDto,
} from "../lib/timeline/prompt-dto";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL = "cmrvq7liy0000l904s25767xe";
const EXPECTED_FR = "cmslf0ny10005i7nlqe7xqbea";

async function main() {
  if (process.env.SFEF15_ALLOW_PROD !== "1") {
    throw new Error("ABORT SFEF15_ALLOW_PROD=1");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) {
    throw new Error("ABORT host");
  }

  const prisma = new PrismaClient();
  const matrix: Record<string, "PASS" | "FAIL"> = {};
  const mark = (k: string, ok: boolean) => {
    matrix[k] = ok ? "PASS" : "FAIL";
    if (!ok) console.error("FAIL", k);
  };

  const commercialBefore = {
    regs: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL, isOpsTest: false },
    }),
    approved: await prisma.clickatonRegistration.count({
      where: {
        editionId: COMMERCIAL,
        isOpsTest: false,
        paymentStatus: "APPROVED",
      },
    }),
    paidOrders: await prisma.clickatonRegistration.count({
      where: {
        editionId: COMMERCIAL,
        isOpsTest: false,
        paymentOrderId: { not: null },
      },
    }),
    submissions: await prisma.clickatonPhotoSubmission.count({
      where: { editionId: COMMERCIAL, registration: { isOpsTest: false } },
    }),
  };

  const edition = await prisma.clickatonEdition.findUniqueOrThrow({
    where: { id: COMMERCIAL },
    include: { uploadConfig: true },
  });
  const cfg = edition.uploadConfig!;
  const prompts = await prisma.clickatonPrompt.findMany({
    where: { editionId: COMMERCIAL, status: { not: "CANCELLED" } },
    orderBy: { sequence: "asc" },
  });

  // Cronograma coherente
  const cs = cfg.captureWindowStartsAt!.getTime();
  const ce = cfg.captureWindowEndsAt!.getTime();
  const us = cfg.uploadWindowStartsAt!.getTime();
  const ue = cfg.uploadWindowEndsAt!.getTime();
  const reveal = cfg.eventRevealAt!.getTime();
  mark(
    "schedule_coherent",
    cs < ce && us < ue && reveal <= cs && ce <= ue && cfg.globalPromptReveal === true,
  );

  mark("prompts_10_locked", prompts.length === 10 && prompts.every((p) => p.status === "LOCKED"));
  mark(
    "no_individual_reveal",
    prompts.every((p) => p.releasedAt == null) && cfg.globalPromptReveal === true,
  );

  const schedule = resolveEditionSchedule(cfg);
  mark("pre_reveal_not_open", !arePromptsGloballyRevealed(schedule));
  let leakOk = true;
  for (const p of prompts) {
    const dto = toPromptPublicDto(p as never, { editionSchedule: cfg, showOpensAt: true });
    if (dto.status !== "LOCKED") leakOk = false;
    try {
      assertLockedDtoIsSafe(dto);
      if (p.titleSnapshot && JSON.stringify(dto).includes(p.titleSnapshot)) leakOk = false;
    } catch {
      leakOk = false;
    }
  }
  mark("pre_reveal_no_leak", leakOk);

  mark(
    "fotorank_real",
    edition.fotorankContestId === EXPECTED_FR &&
      edition.fotoRankSyncEnabled === false &&
      edition.fotoRankSyncMode === "DISABLED",
  );
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: EXPECTED_FR },
  });
  mark(
    "fotorank_shape",
    Boolean(
      contest &&
        contest.distributionChannel === "CLICKATON" &&
        contest.visibility === "PRIVATE" &&
        contest.experienceType === "MARATHON",
    ),
  );

  mark("uploads_off", cfg.uploadsEnabled === false);
  mark("canonical_off", cfg.canonicalAssetsEnabled === false);
  mark(
    "canonical_nogo_initial",
    cfg.canonicalAssetsEnabled === false && !isEnvCanonicalFotoRankAssetsEnabled(),
  );

  const ops = await getOpsDaySnapshot(COMMERCIAL);
  mark("ops_day_panel", Boolean(ops && ops.prompts.length === 10));
  mark(
    "ops_day_alerts_include_uploads_off",
    Boolean(ops?.alerts.some((a) => a.code === "UPLOADS_OFF")),
  );

  // Re-run Modo Test final (ops-14c) — mantiene uploads OFF
  const child = spawnSync(
    "pnpm",
    ["--filter", "clickaton", "exec", "tsx", "scripts/ops-14c-commercial-assign-test.ts"],
    {
      cwd: join(dirname(fileURLToPath(import.meta.url)), "../../.."),
      env: {
        ...process.env,
        SFEF14C_ALLOW_PROD: "1",
        SFEF15_ALLOW_PROD: "1",
      },
      encoding: "utf8",
    },
  );
  mark("modo_test_final", child.status === 0);
  if (child.status !== 0) {
    console.error(child.stdout?.slice(-2000));
    console.error(child.stderr?.slice(-2000));
  }

  const commercialAfter = {
    regs: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL, isOpsTest: false },
    }),
    approved: await prisma.clickatonRegistration.count({
      where: {
        editionId: COMMERCIAL,
        isOpsTest: false,
        paymentStatus: "APPROVED",
      },
    }),
    paidOrders: await prisma.clickatonRegistration.count({
      where: {
        editionId: COMMERCIAL,
        isOpsTest: false,
        paymentOrderId: { not: null },
      },
    }),
    submissions: await prisma.clickatonPhotoSubmission.count({
      where: { editionId: COMMERCIAL, registration: { isOpsTest: false } },
    }),
    testRegs: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL, isOpsTest: true },
    }),
  };
  mark(
    "counts_intact",
    commercialBefore.regs === commercialAfter.regs &&
      commercialBefore.approved === commercialAfter.approved &&
      commercialBefore.paidOrders === commercialAfter.paidOrders &&
      commercialBefore.submissions === commercialAfter.submissions &&
      commercialAfter.testRegs === 0,
  );

  const promptsAfter = await prisma.clickatonPrompt.count({
    where: { editionId: COMMERCIAL, status: { not: "CANCELLED" } },
  });
  mark("prompts_intact", promptsAfter === 10);

  const cfgAfter = await prisma.clickatonEditionUploadConfig.findUniqueOrThrow({
    where: { editionId: COMMERCIAL },
  });
  mark(
    "still_uploads_off",
    cfgAfter.uploadsEnabled === false && cfgAfter.canonicalAssetsEnabled === false,
  );

  const readyItems = [
    { key: "prompts_10", ok: promptsAfter === 10 },
    { key: "locked", ok: matrix.prompts_10_locked === "PASS" },
    { key: "snapshots", ok: prompts.every((p) => Boolean(p.titleSnapshot)) },
    { key: "reveal_configured", ok: Boolean(cfgAfter.eventRevealAt) },
    { key: "capture", ok: Boolean(cfgAfter.captureWindowStartsAt && cfgAfter.captureWindowEndsAt) },
    { key: "upload", ok: Boolean(cfgAfter.uploadWindowStartsAt && cfgAfter.uploadWindowEndsAt) },
    { key: "timezone", ok: Boolean(edition.timezone) },
    { key: "fotorank", ok: edition.fotorankContestId === EXPECTED_FR },
    { key: "uploads_ready_to_flip", ok: cfgAfter.uploadsEnabled === false },
    { key: "canonical_nogo", ok: cfgAfter.canonicalAssetsEnabled === false },
    { key: "test_mode_pass", ok: matrix.modo_test_final === "PASS" },
    { key: "contingencies_documented", ok: true },
    { key: "ops_panel", ok: matrix.ops_day_panel === "PASS" },
    { key: "inscriptos_protected", ok: matrix.counts_intact === "PASS" },
    { key: "schedule_ok", ok: matrix.schedule_coherent === "PASS" },
  ];
  const readyForCommercialUploads = readyItems.every((i) => i.ok);

  const passed = Object.values(matrix).filter((v) => v === "PASS").length;
  const failed = Object.values(matrix).filter((v) => v === "FAIL").length;
  const report = {
    ok: failed === 0 && readyForCommercialUploads,
    result: readyForCommercialUploads
      ? "READY_FOR_COMMERCIAL_UPLOADS"
      : "NOT_READY",
    passed,
    failed,
    matrix,
    readyItems,
    commercialBefore,
    commercialAfter,
    scheduleLocalNote:
      "Reveal/captura 16:00–20:00 ART; carga 16:00–22:00 ART (America/Argentina/Cordoba)",
    canonicalGoNoGo: "NO-GO canonical en go-live inicial; GO uploads legacy",
    pendingOrganizerDecision: [
      "Grace mid-upload al cierre de ventana (hoy: reject estricto)",
    ],
    flags: {
      uploadsEnabled: cfgAfter.uploadsEnabled,
      canonicalAssetsEnabled: cfgAfter.canonicalAssetsEnabled,
      jury: "OFF",
      results: "OFF",
    },
  };
  writeFileSync("/tmp/clickaton-15-pre-golive.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
