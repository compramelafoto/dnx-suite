import { Buffer } from "node:buffer";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Nueva plantilla sistema Template V2 — carpeta escolar 30×20 cm (3 fotos, minimal producción).
 * Idempotente por `metaJson.seedId`; no modifica otras plantillas ni el script `seed-template-v2-school-folder-minimal.ts`.
 *
 * Ejecutar: pnpm bootstrap:template-v2-school-folder-minimal-production
 */

const TEMPLATE_NAME = "Carpeta escolar 3 fotos (Minimal)";
const SEED_META_ID = "template-v2-school-folder-minimal-prod-v1";

/** 254 dpi → 10 px/mm. Trim abierto 300×200 mm → 3000×2000 px (bleed solo export vía canvasJson). */
const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2000;

const WAVE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3000 340" preserveAspectRatio="none">
  <path d="M0,150 C375,260 937,80 1500,120 C2062,160 2625,260 3000,150 V340 H0Z" fill="#c7d4e8"/>
</svg>`;

const DECOR_BOTTOM_WAVE_DATA_URI =
  `data:image/svg+xml;base64,${Buffer.from(WAVE_SVG).toString("base64")}`;

function typographySans() {
  return "Inter,Poppins,sans-serif";
}

async function resolveOwner(): Promise<{ id: number; email: string | null }> {
  let owner = await prisma.user.findFirst({
    where: { role: Role.ADMIN, isBlocked: false },
    select: { id: true, email: true },
    orderBy: { id: "asc" },
  });
  if (!owner) {
    owner = await prisma.user.findFirst({
      where: {
        role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
        isBlocked: false,
      },
      select: { id: true, email: true },
      orderBy: { id: "asc" },
    });
  }
  if (!owner) throw new Error("No hay ADMIN ni fotógrafos disponibles como owner.");
  return owner;
}

async function findExistingBySeedId(): Promise<{ versionId: string; templateId: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; templateId: string }>>(
    Prisma.sql`
      SELECT v.id, v."templateId"
      FROM "TemplateV2Version" v
      WHERE v."metaJson"::jsonb ->> 'seedId' = ${SEED_META_ID}
      LIMIT 1
    `
  );
  if (!rows.length) return null;
  return { versionId: rows[0].id, templateId: rows[0].templateId };
}

async function main() {
  const owner = await resolveOwner();

  const existing = await findExistingBySeedId();
  if (existing) {
    await prisma.templateV2Publication.upsert({
      where: { templateId: existing.templateId },
      update: {
        visibility: "PUBLIC",
        reviewStatus: "APPROVED",
        publishedAt: new Date(),
        publishedByUserId: owner.id,
        reviewedAt: new Date(),
        reviewedByUserId: owner.id,
        reviewNotes: "Plantilla sistema (seed producción): carpeta minimal 3 fotos.",
      },
      create: {
        templateId: existing.templateId,
        visibility: "PUBLIC",
        reviewStatus: "APPROVED",
        publishedAt: new Date(),
        publishedByUserId: owner.id,
        reviewedAt: new Date(),
        reviewedByUserId: owner.id,
        reviewNotes: "Plantilla sistema (seed producción): carpeta minimal 3 fotos.",
      },
    });
    console.log("[seed-prod] Plantilla ya existía (mismo seedId); publicación alineada a PUBLIC · APPROVED.");
    console.log(`  templateId: ${existing.templateId}`);
    console.log(`  versionId: ${existing.versionId}`);
    return;
  }

  const templateId = crypto.randomUUID();
  const versionId = crypto.randomUUID();

  const px = CANVAS_WIDTH / 300;
  const SAFE = 50; // 5 mm
  /** Evitar contenido crítico en tubo ±10 mm alrededor del pliegue (x = 1500 px). */
  const FOLD_X = CANVAS_WIDTH / 2;
  const NO_GO_LOW = FOLD_X - 10 * px;
  const NO_GO_HIGH = FOLD_X + 10 * px;

  /** Contratapa: imagen ~120 mm ancho, contenido terminando antes del tubo */
  const p2Left = SAFE;
  const p2Right = NO_GO_LOW - SAFE;
  const p2Center = (p2Left + p2Right) / 2;
  const photo2W = 120 * px;
  const photo2H = Math.min(1540, CANVAS_HEIGHT - 2 * SAFE - 260);
  const photo2X = Math.round(Math.max(SAFE, p2Center - photo2W / 2));
  const photo2Y = Math.round((CANVAS_HEIGHT - photo2H) / 2);

  /** Tapa: todo a la derecha de NO_GO_HIGH */
  const coverContentLeft = NO_GO_HIGH + SAFE;
  const coverContentW = CANVAS_WIDTH - coverContentLeft - SAFE;
  const photo1W = Math.min(880, coverContentW - 100);
  const photo1H = 1268;
  const photo1X = Math.round(coverContentLeft + (coverContentW - photo1W) / 2);
  const photo1Y = 280;

  const blockDefs: Array<{
    id: string;
    pageIndex: number;
    type: "BACKGROUND" | "IMAGE" | "SHAPE" | "VARIABLE_TEXT";
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    configJson: Record<string, unknown>;
  }> = [
    // ─── PAGE 0: exterior (izq contratapa · der tapa) ───
    {
      id: `schprd-${versionId.slice(0, 8)}-p0-bg-shape`,
      pageIndex: 0,
      type: "SHAPE",
      name: "Fondo general (exterior)",
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      zIndex: 0,
      configJson: {
        variant: "rectangle",
        fill: "#ffffff",
        stroke: "transparent",
        strokeWidth: 0,
        radius: 0,
        opacity: 1,
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p0-wave`,
      pageIndex: 0,
      type: "IMAGE",
      name: "Onda inferior decorativa",
      x: 0,
      y: 1740,
      width: CANVAS_WIDTH,
      height: 260,
      zIndex: 2,
      configJson: {
        src: DECOR_BOTTOM_WAVE_DATA_URI,
        fit: "cover",
        borderRadius: 0,
        photoMode: "free",
        maskShape: "rect",
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p0-photo2`,
      pageIndex: 0,
      type: "IMAGE",
      name: "Alumno + docente (contratapa, photo_2)",
      x: photo2X,
      y: photo2Y,
      width: photo2W,
      height: photo2H,
      zIndex: 10,
      configJson: {
        src: "",
        fit: "cover",
        borderRadius: 10,
        photoMode: "free",
        maskShape: "rect",
        source: { variableKey: "photo_2" },
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p0-logo-back`,
      pageIndex: 0,
      type: "IMAGE",
      name: "Logo escuela · contratapa ({{school_logo}})",
      x: Math.round(p2Center - 180),
      y: CANVAS_HEIGHT - SAFE - 200,
      width: 360,
      height: 200,
      zIndex: 16,
      configJson: {
        src: "",
        fit: "contain",
        borderRadius: 8,
        photoMode: "free",
        maskShape: "rect",
        source: { variableKey: "branding.schoolLogoUrl" },
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p0-logo-front`,
      pageIndex: 0,
      type: "IMAGE",
      name: "Logo escuela · tapa superior ({{school_logo}})",
      x: Math.round(coverContentLeft + coverContentW / 2 - 224),
      y: SAFE,
      width: 448,
      height: 150,
      zIndex: 13,
      configJson: {
        src: "",
        fit: "contain",
        borderRadius: 6,
        photoMode: "free",
        maskShape: "rect",
        source: { variableKey: "branding.schoolLogoUrl" },
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p0-photo1`,
      pageIndex: 0,
      type: "IMAGE",
      name: "Alumno tapa vertical (photo_1)",
      x: photo1X,
      y: photo1Y,
      width: photo1W,
      height: photo1H,
      zIndex: 15,
      configJson: {
        src: "",
        fit: "cover",
        borderRadius: 28,
        photoMode: "single",
        maskShape: "rect",
        source: { variableKey: "photo_1" },
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p0-name`,
      pageIndex: 0,
      type: "VARIABLE_TEXT",
      name: "Nombre alumno ({{student_name}})",
      x: Math.round(coverContentLeft + 80),
      y: 1540,
      width: Math.round(coverContentW - 160),
      height: 120,
      zIndex: 40,
      configJson: {
        variableKey: "student.fullName",
        fallback: "Nombre del alumno",
        fontFamily: typographySans(),
        fontSize: 52,
        fontWeight: 700,
        lineHeight: 1.08,
        letterSpacing: 0,
        textAlign: "CENTER",
        color: "#0f172a",
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p0-course`,
      pageIndex: 0,
      type: "VARIABLE_TEXT",
      name: "Curso ({{course}})",
      x: Math.round(coverContentLeft + 80),
      y: 1672,
      width: Math.round(coverContentW - 160),
      height: 88,
      zIndex: 41,
      configJson: {
        variableKey: "course.displayName",
        fallback: "Curso · División",
        fontFamily: typographySans(),
        fontSize: 30,
        fontWeight: 500,
        lineHeight: 1.12,
        letterSpacing: 0,
        textAlign: "CENTER",
        color: "#475569",
      },
    },

    // ─── PAGE 1: interior ───
    {
      id: `schprd-${versionId.slice(0, 8)}-p1-bg-shape`,
      pageIndex: 1,
      type: "SHAPE",
      name: "Fondo general (interior)",
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      zIndex: 0,
      configJson: {
        variant: "rectangle",
        fill: "#ffffff",
        stroke: "transparent",
        strokeWidth: 0,
        radius: 0,
        opacity: 1,
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p1-banner`,
      pageIndex: 1,
      type: "SHAPE",
      name: "Banner inferior · fondo (grupo)",
      x: 0,
      y: 1600,
      width: CANVAS_WIDTH,
      height: 400,
      zIndex: 4,
      configJson: {
        variant: "rectangle",
        fill: "#e8eef7",
        stroke: "transparent",
        strokeWidth: 0,
        radius: 0,
        opacity: 1,
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p1-photo3`,
      pageIndex: 1,
      type: "IMAGE",
      name: "Foto grupal (photo_3), ~70% superior",
      x: 150,
      y: 70,
      width: 2700,
      height: 1400,
      zIndex: 10,
      configJson: {
        src: "",
        fit: "cover",
        borderRadius: 12,
        photoMode: "group",
        maskShape: "rect",
        source: { variableKey: "photo_3" },
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p1-logo`,
      pageIndex: 1,
      type: "IMAGE",
      name: "Banner · logo ({{school_logo}})",
      x: SAFE + 36,
      y: 1684,
      width: 280,
      height: 246,
      zIndex: 20,
      configJson: {
        src: "",
        fit: "contain",
        borderRadius: 10,
        photoMode: "free",
        maskShape: "rect",
        source: { variableKey: "branding.schoolLogoUrl" },
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p1-school`,
      pageIndex: 1,
      type: "VARIABLE_TEXT",
      name: "Banner · nombre escuela ({{school_name}})",
      x: 450,
      y: 1648,
      width: 2000,
      height: 74,
      zIndex: 22,
      configJson: {
        variableKey: "school.name",
        fallback: "Nombre de la escuela",
        fontFamily: typographySans(),
        fontSize: 42,
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacing: 0,
        textAlign: "LEFT",
        color: "#0f172a",
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p1-course`,
      pageIndex: 1,
      type: "VARIABLE_TEXT",
      name: "Banner · curso + división ({{course}} {{division}})",
      x: 450,
      y: 1722,
      width: 1600,
      height: 64,
      zIndex: 23,
      configJson: {
        variableKey: "course.displayName",
        fallback: "Curso · División",
        fontFamily: typographySans(),
        fontSize: 30,
        fontWeight: 500,
        lineHeight: 1.08,
        letterSpacing: 0,
        textAlign: "LEFT",
        color: "#334155",
      },
    },
    {
      id: `schprd-${versionId.slice(0, 8)}-p1-year`,
      pageIndex: 1,
      type: "VARIABLE_TEXT",
      name: "Banner · año / fecha ({{year}})",
      x: 2260,
      y: 1726,
      width: 616,
      height: 68,
      zIndex: 24,
      configJson: {
        variableKey: "event.dateFormatted",
        fallback: "Año lectivo",
        fontFamily: typographySans(),
        fontSize: 28,
        fontWeight: 500,
        lineHeight: 1.06,
        letterSpacing: 0,
        textAlign: "RIGHT",
        color: "#334155",
      },
    },
  ];

  const blocksData = blockDefs.map(
    (b): Prisma.TemplateV2BlockCreateManyInput => ({
      id: b.id,
      templateVersionId: versionId,
      pageIndex: b.pageIndex,
      type: b.type,
      name: b.name,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      rotation: 0,
      zIndex: b.zIndex,
      opacity: 1,
      locked: false,
      visible: true,
      configJson: b.configJson as Prisma.InputJsonValue,
    })
  );

  await prisma.$transaction([
    prisma.templateV2.create({
      data: {
        id: templateId,
        ownerUserId: owner.id,
        name: TEMPLATE_NAME,
        description:
          "Carpeta escolar 30×20 cm · 2 páginas (exterior tapa/contratapa + interior). Variables y photo_1/2/3. Sin aletas ni guías visibles; pliegue x=150 mm solo en meta.",
        status: "ACTIVE",
        currentVersionId: versionId,
      },
    }),
    prisma.templateV2Version.create({
      data: {
        id: versionId,
        templateId,
        versionNumber: 1,
        canvasJson: {
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          background: "#ffffff",
          dpi: 254,
          bleedMm: 5,
          safeAreaMm: 5,
        },
        metaJson: {
          seedId: SEED_META_ID,
          system: true,
          version: "v2",
          /** En `Template` legacy sería `version: v2`; aquí la fila es siempre Template V2. */
          legacyStyleFlags: { system: true, version: "v2" },
          templatePageCount: 2,
          physicalTrimMm: { width: 300, height: 200 },
          unitScalePxPerMm: px,
          foldGuideMmFromLeft: 150,
          foldNoTextHalfWidthMm: 10,
          safeMarginMm: 5,
          editorGuideNotes: [
            "Pliegue lógico en el centro del lienzo (150 mm desde la izquierda). No dibujar línea en arte: solo guía de maquetación.",
            "Respetar márgenes seguros ≥5 mm desde el borde de corte.",
            `Mantener texto y fotos fuera del tubo ±10 mm alrededor de x=${FOLD_X}px (${1500}px = ${300 / 2} mm).`,
            "Bleed 5 mm solo aplica en export; lienzo edición = trim 300×200 mm.",
          ],
          pageLabels: ["Exterior (contratapa + tapa)", "Interior"],
          photoInputs: [
            { slotKey: "photo_1", label: "Alumno (tapa)", pageIndex: 0, role: "single" },
            { slotKey: "photo_2", label: "Alumno + docente (contratapa)", pageIndex: 0, role: "free" },
            { slotKey: "photo_3", label: "Foto grupal (interior)", pageIndex: 1, role: "group" },
          ],
          variableHints: [
            { prose: "{{student_name}}", resolvedKey: "student.fullName" },
            { prose: "{{course}}", resolvedKey: "course.displayName" },
            { prose: "{{division}}", note: "Incluido en course.displayName si aplica en datos" },
            { prose: "{{school_name}}", resolvedKey: "school.name" },
            { prose: "{{year}}", resolvedKey: "event.dateFormatted" },
            { prose: "{{school_logo}}", resolvedKey: "branding.schoolLogoUrl", type: "IMAGE" },
          ],
        },
        revision: 0,
        isLocked: false,
        createdByUserId: owner.id,
      },
    }),
    prisma.templateV2Block.createMany({ data: blocksData }),
    prisma.templateV2Publication.create({
      data: {
        templateId,
        visibility: "PUBLIC",
        reviewStatus: "APPROVED",
        publishedAt: new Date(),
        publishedByUserId: owner.id,
        reviewedAt: new Date(),
        reviewedByUserId: owner.id,
        reviewNotes: "Plantilla sistema (seed producción): carpeta minimal 3 fotos.",
      },
    }),
  ]);

  console.log("[seed-prod] Plantilla creada y publicada (PUBLIC · APPROVED).");
  console.log(`  ownerUserId: ${owner.id}${owner.email ? ` (${owner.email})` : ""}`);
  console.log(`  templateId: ${templateId}`);
  console.log(`  versionId: ${versionId}`);
  console.log(`  bloques: ${blocksData.length}`);
  console.log(`  páginas: 2 (pageIndex 0 exterior, 1 interior)`);
  console.log(`  seedId meta: ${SEED_META_ID}`);
}

main()
  .catch((err) => {
    const code = err?.code as string | undefined;
    if (code === "P2021") {
      console.error("Faltan tablas Template V2 en la DB. Migrá prisma y reintentá.");
    } else {
      console.error("Error en seed school-folder-minimal-production:", err);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
