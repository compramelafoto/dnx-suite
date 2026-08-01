/**
 * 10G.3 — Apply Schedule V2 to clickaton-argentina-2026 (additive, no sales open).
 *
 * Updates: edition start/end + rulesConfig, prompt capture/upload windows,
 * new DRAFT timeline (or refresh DRAFT) with V2 events, optionally activate.
 *
 * Usage:
 *   CLICKATON_OPS_10G3=1 DATABASE_URL=… pnpm exec tsx scripts/ops-10g3-apply-schedule-v2.ts
 *   CLICKATON_OPS_10G3_ACTIVATE_TIMELINE=1  → activate new DRAFT
 *
 * Does NOT: open registration, enable LIVE, mutate pricing/MP/allocation.
 */
import { prisma } from "@repo/db";
import {
  ARGENTINA_2026_RULES,
  ARGENTINA_2026_SCHEDULE,
  ARGENTINA_2026_TIMEZONE,
  argentina2026EventEndAt,
  argentina2026EventStartAt,
  CLICKATON_TERMS_VERSION,
} from "../config/editions/argentina-2026";

const SLUG = "clickaton-argentina-2026";
const S = ARGENTINA_2026_SCHEDULE;

const TIMELINE_EVENTS = [
  { eventType: "REGISTRATION_OPEN" as const, name: "Apertura de inscripciones", sequence: 10, isCritical: true, startsAt: null as string | null, endsAt: null as string | null },
  { eventType: "REGISTRATION_CLOSE" as const, name: "Cierre de inscripciones", sequence: 20, isCritical: true, startsAt: null, endsAt: null },
  { eventType: "ACCREDITATION_OPEN" as const, name: "Apertura de acreditación", sequence: 30, isCritical: true, startsAt: S.accreditationOpenIso, endsAt: S.accreditationCloseIso },
  { eventType: "ACCREDITATION_CLOSE" as const, name: "Cierre de acreditación", sequence: 35, isCritical: true, startsAt: S.accreditationCloseIso, endsAt: S.accreditationCloseIso },
  { eventType: "CUSTOM" as const, name: "Charla introductoria", sequence: 37, isCritical: false, startsAt: S.talkOpenIso, endsAt: S.talkCloseIso },
  { eventType: "MARATHON_START" as const, name: "Inicio oficial · captura y carga", sequence: 40, isCritical: true, startsAt: S.marathonStartIso, endsAt: S.marathonEndIso },
  { eventType: "PROMPT_RELEASE" as const, name: "Reveal de las 10 consignas", sequence: 50, isCritical: true, startsAt: S.promptsRevealIso, endsAt: S.uploadCloseIso },
  { eventType: "UPLOAD_WINDOW_OPEN" as const, name: "Apertura de subida (16:00)", sequence: 70, isCritical: true, startsAt: S.uploadOpenIso, endsAt: S.uploadCloseIso },
  { eventType: "CAPTURE_WINDOW_CLOSE" as const, name: "Cierre de captura (20:00 exclusive)", sequence: 75, isCritical: false, startsAt: S.captureCloseIso, endsAt: S.captureCloseIso },
  { eventType: "UPLOAD_WINDOW_CLOSE" as const, name: "Cierre de entrega (22:00 exclusive)", sequence: 80, isCritical: true, startsAt: S.uploadCloseIso, endsAt: S.uploadCloseIso },
  { eventType: "MARATHON_END" as const, name: "Fin del período de entrega", sequence: 90, isCritical: true, startsAt: S.marathonEndIso, endsAt: S.marathonEndIso },
  { eventType: "JUDGING_OPEN" as const, name: "Apertura de jurado", sequence: 95, isCritical: true, startsAt: null, endsAt: null },
  { eventType: "JUDGING_CLOSE" as const, name: "Cierre de jurado", sequence: 98, isCritical: true, startsAt: null, endsAt: null },
  { eventType: "RESULTS_RELEASE" as const, name: "Resultados", sequence: 100, isCritical: false, startsAt: null, endsAt: null },
];

async function main() {
  if (process.env.CLICKATON_OPS_10G3 !== "1") {
    console.error("Set CLICKATON_OPS_10G3=1");
    process.exit(1);
  }

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: SLUG },
    select: {
      id: true,
      registrationEnabled: true,
      status: true,
      timezone: true,
      startAt: true,
      endAt: true,
    },
  });
  if (!edition) throw new Error("edition missing");

  // Additive: ensure rulesConfig exists (some staging DBs lag schema).
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ClickatonEdition" ADD COLUMN IF NOT EXISTS "rulesConfig" JSONB`,
  );

  const rulesConfig = {
    termsVersion: CLICKATON_TERMS_VERSION,
    schedule: ARGENTINA_2026_SCHEDULE,
    rules: ARGENTINA_2026_RULES,
    cameraClockWarningEs: ARGENTINA_2026_RULES.cameraClockWarningEs,
    scheduleVersion: "V2_10G3",
  };
  await prisma.clickatonEdition.update({
    where: { id: edition.id },
    data: {
      timezone: ARGENTINA_2026_TIMEZONE,
      startAt: argentina2026EventStartAt(),
      endAt: argentina2026EventEndAt(),
      rulesConfig,
      // Never open sales here
      registrationEnabled: false,
    },
  });
  const rulesConfigPersisted = true;

  const captureOpen = new Date(S.captureOpenIso);
  const captureClose = new Date(S.captureCloseIso);
  const uploadOpen = new Date(S.uploadOpenIso);
  const uploadClose = new Date(S.uploadCloseIso);

  let promptsUpdated = 0;
  for (let i = 1; i <= ARGENTINA_2026_RULES.totalPrompts; i += 1) {
    await prisma.clickatonPrompt.upsert({
      where: { editionId_sequence: { editionId: edition.id, sequence: i } },
      create: {
        editionId: edition.id,
        sequence: i,
        internalName: `argentina-2026-prompt-${i}`,
        title: null,
        instructions: null,
        status: "DRAFT",
        releaseMode: "SCHEDULED",
        minEntries: 0,
        maxEntries: 1,
        allowReplacement: true,
        required: i <= ARGENTINA_2026_RULES.competitiveMinValidPrompts,
        gpsMode: "OPTIONAL",
        captureStartsAt: captureOpen,
        captureEndsAt: captureClose,
        uploadStartsAt: uploadOpen,
        uploadEndsAt: uploadClose,
      },
      update: {
        captureStartsAt: captureOpen,
        captureEndsAt: captureClose,
        uploadStartsAt: uploadOpen,
        uploadEndsAt: uploadClose,
        maxEntries: 1,
      },
    });
    promptsUpdated += 1;
  }

  await prisma.clickatonEditionUploadConfig.upsert({
    where: { editionId: edition.id },
    create: {
      editionId: edition.id,
      uploadsEnabled: false,
      captureClockToleranceMinutes: 5,
      defaultGpsMode: "OPTIONAL",
      allowCrossPromptDuplicate: false,
      reviewCrossParticipantDuplicate: true,
      rulesDeclarationVersion: CLICKATON_TERMS_VERSION,
    },
    update: {
      rulesDeclarationVersion: CLICKATON_TERMS_VERSION,
      // keep uploadsEnabled as-is (do not enable)
    },
  });

  let draft = await prisma.clickatonEditionTimeline.findFirst({
    where: { editionId: edition.id, status: "DRAFT" },
  });
  if (!draft) {
    const last = await prisma.clickatonEditionTimeline.findFirst({
      where: { editionId: edition.id },
      orderBy: { version: "desc" },
    });
    draft = await prisma.clickatonEditionTimeline.create({
      data: {
        editionId: edition.id,
        version: (last?.version ?? 0) + 1,
        status: "DRAFT",
        timezone: ARGENTINA_2026_TIMEZONE,
        events: {
          create: TIMELINE_EVENTS.map((e) => ({
            eventType: e.eventType,
            name: e.name,
            sequence: e.sequence,
            isCritical: e.isCritical,
            startsAt: e.startsAt ? new Date(e.startsAt) : null,
            endsAt: e.endsAt ? new Date(e.endsAt) : null,
            visibilityPolicy: "PUBLIC_SAFE",
            triggerMode: "SCHEDULED",
          })),
        },
      },
    });
  } else {
    await prisma.clickatonEditionTimeline.update({
      where: { id: draft.id },
      data: { timezone: ARGENTINA_2026_TIMEZONE },
    });
    for (const e of TIMELINE_EVENTS) {
      const existing = await prisma.clickatonTimelineEvent.findFirst({
        where: { timelineId: draft.id, sequence: e.sequence },
      });
      if (existing) {
        await prisma.clickatonTimelineEvent.update({
          where: { id: existing.id },
          data: {
            eventType: e.eventType,
            name: e.name,
            isCritical: e.isCritical,
            startsAt: e.startsAt ? new Date(e.startsAt) : null,
            endsAt: e.endsAt ? new Date(e.endsAt) : null,
          },
        });
      } else {
        await prisma.clickatonTimelineEvent.create({
          data: {
            timelineId: draft.id,
            eventType: e.eventType,
            name: e.name,
            sequence: e.sequence,
            isCritical: e.isCritical,
            startsAt: e.startsAt ? new Date(e.startsAt) : null,
            endsAt: e.endsAt ? new Date(e.endsAt) : null,
            visibilityPolicy: "PUBLIC_SAFE",
            triggerMode: "SCHEDULED",
          },
        });
      }
    }
  }

  let activated = false;
  if (process.env.CLICKATON_OPS_10G3_ACTIVATE_TIMELINE === "1") {
    const active = await prisma.clickatonEditionTimeline.findFirst({
      where: { editionId: edition.id, status: "ACTIVE" },
    });
    if (active && active.id !== draft.id) {
      await prisma.clickatonEditionTimeline.update({
        where: { id: active.id },
        data: { status: "SUPERSEDED" },
      });
    }
    await prisma.clickatonEditionTimeline.update({
      where: { id: draft.id },
      data: { status: "ACTIVE", activatedAt: new Date() },
    });
    activated = true;
  }

  let e2eReservation: Record<string, unknown> | null = null;
  try {
    const e2e = await prisma.clickatonRegistration.findUnique({
      where: { id: "cms8rrnwa0001jp04tvw37s6n" },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        termsVersion: true,
        termsAcceptedAt: true,
      },
    });
    e2eReservation = e2e
      ? {
          id: e2e.id,
          status: e2e.status,
          paymentStatus: e2e.paymentStatus,
          termsVersion: e2e.termsVersion,
          handling:
            e2e.termsVersion === "CLICKATON_TERMS_2026_09_19_v1"
              ? "KEEP_AUDIT — discard for next E2E; create new reservation accepting v2"
              : "OK_OR_REVIEW",
        }
      : null;
  } catch {
    e2eReservation = { note: "E2E audit skipped (schema lag / not present)" };
  }

  const samplePrompt = await prisma.clickatonPrompt.findFirst({
    where: { editionId: edition.id },
    select: {
      captureStartsAt: true,
      captureEndsAt: true,
      uploadStartsAt: true,
      uploadEndsAt: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        stage: "10G.3",
        editionId: edition.id,
        registrationEnabled: false,
        termsVersion: CLICKATON_TERMS_VERSION,
        schedule: {
          accreditation: "14:00–16:00",
          intro: "16:00–16:30",
          capture: "[16:00, 20:00)",
          upload: "[16:00, 22:00)",
        },
        promptsUpdated,
        rulesConfigPersisted,
        timelineDraftId: draft.id,
        timelineDraftVersion: draft.version,
        timelineActivated: activated,
        samplePromptWindows: samplePrompt,
        e2eReservation,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
