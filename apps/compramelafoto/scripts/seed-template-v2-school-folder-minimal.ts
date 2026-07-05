import { Buffer } from "node:buffer";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

/**
 * Seed idempotente: plantilla sistema Template V2 pública para carpeta escolar (minimal, 3 fotos).
 * No modifica templates existentes; si ya existe una con el mismo nombre y owner sistema, solo alinea la publicación.
 *
 * Ejecutar: pnpm bootstrap:template-v2-school-folder-minimal
 */

const TEMPLATE_NAME = "Carpeta escolar 3 fotos (Minimal)";
const SEED_META_ID = "template-v2-school-folder-minimal-v1";

/** 254 dpi → exactamente 10 px por mm (254 / 25.4). Trim 300×200 mm abierto → 3000×2000 px. */
const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2000;

const WAVE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3000 340" preserveAspectRatio="none">
  <path d="M0,150 C375,260 937,80 1500,120 C2062,160 2625,260 3000,150 V340 H0Z" fill="#b8cae0"/>
</svg>`;

const DECOR_BOTTOM_WAVE_DATA_URI =
  `data:image/svg+xml;base64,${Buffer.from(WAVE_SVG).toString("base64")}`;

function typographyBody() {
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

async function main() {
  const owner = await resolveOwner();

  const exists = await prisma.templateV2.findFirst({
    where: { ownerUserId: owner.id, name: TEMPLATE_NAME },
    select: {
      id: true,
      currentVersionId: true,
    },
  });

  if (exists) {
    await prisma.templateV2Publication.upsert({
      where: { templateId: exists.id },
      update: {
        visibility: "PUBLIC",
        reviewStatus: "APPROVED",
        publishedAt: new Date(),
        publishedByUserId: owner.id,
        reviewedAt: new Date(),
        reviewedByUserId: owner.id,
        reviewNotes: "Plantilla sistema (seed): carpeta minimal 3 fotos.",
      },
      create: {
        templateId: exists.id,
        visibility: "PUBLIC",
        reviewStatus: "APPROVED",
        publishedAt: new Date(),
        publishedByUserId: owner.id,
        reviewedAt: new Date(),
        reviewedByUserId: owner.id,
        reviewNotes: "Plantilla sistema (seed): carpeta minimal 3 fotos.",
      },
    });

    console.log("[seed] Plantilla ya existía; solo se alineó publicación (PUBLIC · APPROVED).");
    console.log(`  templateId: ${exists.id}`);
    console.log(`  currentVersionId: ${exists.currentVersionId ?? "(null)"}`);
    return;
  }

  const templateId = crypto.randomUUID();
  const versionId = crypto.randomUUID();

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
    // ─── PAGE 0: exterior tapa + contratapa ───
    {
      id: `schfld-${versionId.slice(0, 8)}-p0-bg`,
      pageIndex: 0,
      type: "BACKGROUND",
      name: "Fondo exterior",
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      zIndex: 0,
      configJson: { backgroundColor: "#fafbfc", src: "", fit: "cover" },
    },
    {
      id: `schfld-${versionId.slice(0, 8)}-p0-wave`,
      pageIndex: 0,
      type: "IMAGE",
      name: "Onda inferior decorativa",
      x: 0,
      y: 1750,
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
      id: `schfld-${versionId.slice(0, 8)}-p0-photo2`,
      pageIndex: 0,
      type: "IMAGE",
      name: "Alumno + docente (contratapa)",
      x: 295,
      y: 355,
      width: 900,
      height: 1290,
      zIndex: 10,
      configJson: {
        src: "",
        fit: "cover",
        borderRadius: 8,
        photoMode: "free",
        maskShape: "rect",
        source: { variableKey: "photo_2" },
      },
    },
    {
      id: `schfld-${versionId.slice(0, 8)}-p0-logo-back`,
      pageIndex: 0,
      type: "IMAGE",
      name: "Logo escuela (contratapa)",
      x: 85,
      y: 1728,
      width: 360,
      height: 216,
      zIndex: 17,
      configJson: {
        src: "",
        fit: "cover",
        borderRadius: 8,
        photoMode: "free",
        maskShape: "rect",
        source: { variableKey: "branding.schoolLogoUrl" },
      },
    },
    {
      id: `schfld-${versionId.slice(0, 8)}-p0-logo-front`,
      pageIndex: 0,
      type: "IMAGE",
      name: "Logo escuela (tapa)",
      x: 2055,
      y: 54,
      width: 448,
      height: 154,
      zIndex: 13,
      configJson: {
        src: "",
        fit: "cover",
        borderRadius: 6,
        photoMode: "free",
        maskShape: "rect",
        source: { variableKey: "branding.schoolLogoUrl" },
      },
    },
    {
      id: `schfld-${versionId.slice(0, 8)}-p0-photo1`,
      pageIndex: 0,
      type: "IMAGE",
      name: "Alumno tapa",
      x: 1835,
      y: 268,
      width: 880,
      height: 1268,
      zIndex: 15,
      configJson: {
        src: "",
        fit: "cover",
        borderRadius: 24,
        photoMode: "single",
        maskShape: "rect",
        source: { variableKey: "photo_1" },
      },
    },
    {
      id: `schfld-${versionId.slice(0, 8)}-p0-name`,
      pageIndex: 0,
      type: "VARIABLE_TEXT",
      name: "Nombre alumno",
      x: 1605,
      y: 1556,
      width: 1250,
      height: 120,
      zIndex: 40,
      configJson: {
        variableKey: "student.fullName",
        fallback: "Nombre alumno",
        fontFamily: typographyBody(),
        fontSize: 52,
        fontWeight: 700,
        lineHeight: 1.08,
        letterSpacing: 0,
        textAlign: "CENTER",
        color: "#0f172a",
      },
    },
    {
      id: `schfld-${versionId.slice(0, 8)}-p0-course`,
      pageIndex: 0,
      type: "VARIABLE_TEXT",
      name: "Curso",
      x: 1605,
      y: 1684,
      width: 1250,
      height: 90,
      zIndex: 41,
      configJson: {
        variableKey: "course.displayName",
        fallback: "Curso · División",
        fontFamily: typographyBody(),
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
      id: `schfld-${versionId.slice(0, 8)}-p1-bg`,
      pageIndex: 1,
      type: "BACKGROUND",
      name: "Fondo interior",
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      zIndex: 0,
      configJson: { backgroundColor: "#ffffff", src: "", fit: "cover" },
    },
    {
      id: `schfld-${versionId.slice(0, 8)}-p1-photo3`,
      pageIndex: 1,
      type: "IMAGE",
      name: "Foto grupal",
      x: 120,
      y: 140,
      width: 2760,
      height: 1420,
      zIndex: 8,
      configJson: {
        src: "",
        fit: "cover",
        borderRadius: 10,
        photoMode: "group",
        maskShape: "rect",
        source: { variableKey: "photo_3" },
      },
    },
    {
      id: `schfld-${versionId.slice(0, 8)}-p1-banner`,
      pageIndex: 1,
      type: "SHAPE",
      name: "Banner inferior fondo",
      x: 0,
      y: 1608,
      width: CANVAS_WIDTH,
      height: 392,
      zIndex: 5,
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
      id: `schfld-${versionId.slice(0, 8)}-p1-logo`,
      pageIndex: 1,
      type: "IMAGE",
      name: "Logo banner",
      x: 130,
      y: 1686,
      width: 300,
      height: 246,
      zIndex: 20,
      configJson: {
        src: "",
        fit: "cover",
        borderRadius: 12,
        photoMode: "free",
        maskShape: "rect",
        source: { variableKey: "branding.schoolLogoUrl" },
      },
    },
    {
      id: `schfld-${versionId.slice(0, 8)}-p1-school`,
      pageIndex: 1,
      type: "VARIABLE_TEXT",
      name: "Nombre escuela",
      x: 480,
      y: 1658,
      width: 2040,
      height: 80,
      zIndex: 22,
      configJson: {
        variableKey: "school.name",
        fallback: "Nombre de la escuela",
        fontFamily: typographyBody(),
        fontSize: 42,
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacing: 0,
        textAlign: "LEFT",
        color: "#0f172a",
      },
    },
    {
      id: `schfld-${versionId.slice(0, 8)}-p1-course`,
      pageIndex: 1,
      type: "VARIABLE_TEXT",
      name: "Curso y división",
      x: 480,
      y: 1732,
      width: 1540,
      height: 64,
      zIndex: 23,
      configJson: {
        variableKey: "course.displayName",
        fallback: "Curso · división",
        fontFamily: typographyBody(),
        fontSize: 30,
        fontWeight: 500,
        lineHeight: 1.08,
        letterSpacing: 0,
        textAlign: "LEFT",
        color: "#334155",
      },
    },
    {
      id: `schfld-${versionId.slice(0, 8)}-p1-year`,
      pageIndex: 1,
      type: "VARIABLE_TEXT",
      name: "Año / evento",
      x: 2100,
      y: 1738,
      width: 758,
      height: 72,
      zIndex: 24,
      configJson: {
        variableKey: "event.dateFormatted",
        fallback: "Año lectivo",
        fontFamily: typographyBody(),
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
          "Carpeta escolar abierta 30×20 cm · tapa/contratapa + interior minimal (3 fotos), sin aletas ni guías visibles.",
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
          physicalTrimMm: { width: 300, height: 200 },
          unitScalePxPerMm: CANVAS_WIDTH / 300,
          foldGuideMmFromLeft: 150,
          foldNoTextHalfWidthMm: 10,
          /** Guía UX: texto en página 1 se mantiene fuera del tubo ±10 mm alrededor de x trim/2. */
          editorGuideNotes: [
            "Línea de pliegue = centro geométrico del lienzo (150 mm desde el lado izquierdo).",
            "No colocar bloques VARIABLE_TEXT dentro de ±10 mm del centro horizontal (no son visibles líneas ni aletas en impresión).",
          ],
          photoInputs: [
            { slotKey: "photo_1", label: "Alumno · tapa (portrait)", pageIndex: 0 },
            { slotKey: "photo_2", label: "Alumno + docente · contratapa", pageIndex: 0 },
            { slotKey: "photo_3", label: "Foto grupal · interior", pageIndex: 1 },
          ],
          variableHints: [
            {
              prose: "{{student_name}}",
              resolvedKey: "student.fullName",
            },
            { prose: "{{course}} {{division}}", resolvedKey: "course.displayName" },
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
        reviewNotes: "Plantilla sistema (seed): carpeta minimal 3 fotos.",
      },
    }),
  ]);

  console.log("[seed] Plantilla creada y publicada (PUBLIC · APPROVED).");
  console.log(`  ownerUserId: ${owner.id}${owner.email ? ` (${owner.email})` : ""}`);
  console.log(`  templateId: ${templateId}`);
  console.log(`  versionId: ${versionId}`);
  console.log(`  bloques: ${blocksData.length}`);
}

main()
  .catch((err) => {
    const code = err?.code as string | undefined;
    if (code === "P2021") {
      console.error("Faltan tablas Template V2 en la DB. Migrá prisma y reintentá.");
    } else {
      console.error("Error en seed school-folder-minimal:", err);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
