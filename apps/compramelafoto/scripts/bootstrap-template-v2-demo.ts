import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const owner = await prisma.user.findFirst({
    where: {
      role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN] },
      isBlocked: false,
    },
    select: { id: true, email: true, name: true, role: true },
    orderBy: { id: "asc" },
  });

  if (!owner) {
    throw new Error(
      "No se encontró usuario apto para ownerUserId (PHOTOGRAPHER/LAB_PHOTOGRAPHER/ADMIN)."
    );
  }

  const template = await prisma.templateV2.create({
    data: {
      ownerUserId: owner.id,
      name: "Template V2 Demo",
      description: "Plantilla demo para pruebas locales del editor V2.",
      status: "DRAFT",
    },
    select: { id: true },
  });

  const version = await prisma.templateV2Version.create({
    data: {
      templateId: template.id,
      versionNumber: 1,
      canvasJson: {
        width: 1200,
        height: 1800,
        background: "#f8fafc",
      },
      metaJson: {
        source: "bootstrap-template-v2-demo",
      },
      revision: 0,
      isLocked: false,
      createdByUserId: owner.id,
    },
    select: { id: true },
  });

  await prisma.templateV2.update({
    where: { id: template.id },
    data: { currentVersionId: version.id },
  });

  await prisma.templateV2Block.createMany({
    data: [
      {
        id: `blk-text-${version.id}`,
        templateVersionId: version.id,
        pageIndex: 0,
        type: "TEXT",
        name: "Titulo",
        x: 120,
        y: 140,
        width: 960,
        height: 120,
        rotation: 0,
        zIndex: 1,
        opacity: 1,
        locked: false,
        visible: true,
        configJson: {
          content: "Editor Template V2",
          fontFamily: "Helvetica",
          fontSize: 58,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: 0,
          textAlign: "CENTER",
          color: "#0f172a",
        },
      },
      {
        id: `blk-variable-${version.id}`,
        templateVersionId: version.id,
        pageIndex: 0,
        type: "VARIABLE_TEXT",
        name: "Nombre alumno",
        x: 180,
        y: 310,
        width: 840,
        height: 90,
        rotation: 0,
        zIndex: 2,
        opacity: 1,
        locked: false,
        visible: true,
        configJson: {
          variableKey: "student.fullName",
          fallback: "Nombre del Alumno",
          fontFamily: "Helvetica",
          fontSize: 40,
          fontWeight: 500,
          lineHeight: 1.2,
          letterSpacing: 0,
          textAlign: "CENTER",
          color: "#334155",
        },
      },
      {
        id: `blk-shape-${version.id}`,
        templateVersionId: version.id,
        pageIndex: 0,
        type: "SHAPE",
        name: "Franja inferior",
        x: 140,
        y: 1500,
        width: 920,
        height: 180,
        rotation: 0,
        zIndex: 0,
        opacity: 1,
        locked: false,
        visible: true,
        configJson: {
          fill: "#e2e8f0",
          stroke: "#94a3b8",
          strokeWidth: 2,
          radius: 18,
          opacity: 1,
        },
      },
      {
        id: `blk-image-${version.id}`,
        templateVersionId: version.id,
        pageIndex: 0,
        type: "IMAGE",
        name: "Logo placeholder",
        x: 500,
        y: 520,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 3,
        opacity: 1,
        locked: false,
        visible: true,
        configJson: {
          src: "",
          fit: "CONTAIN",
          borderRadius: 12,
          opacity: 1,
        },
      },
    ],
  });

  await prisma.templateV2Publication.upsert({
    where: { templateId: template.id },
    update: { visibility: "PRIVATE", reviewStatus: "DRAFT" },
    create: {
      templateId: template.id,
      visibility: "PRIVATE",
      reviewStatus: "DRAFT",
    },
  });

  const url = `${baseUrl}/fotografo/diseno/plantillas/v2/${template.id}/${version.id}`;

  console.log("Template V2 demo creado correctamente.");
  console.log(`ownerUserId: ${owner.id} (${owner.email})`);
  console.log(`templateId: ${template.id}`);
  console.log(`versionId: ${version.id}`);
  console.log(`URL editor: ${url}`);
}

main()
  .catch((err) => {
    const code = err?.code as string | undefined;
    if (code === "P2021") {
      console.error("Error en bootstrap-template-v2-demo: faltan tablas de TemplateV2 en la DB local.");
      console.error("Ejecutá primero:");
      console.error("  npx prisma migrate deploy");
      console.error("o si no hay migraciones para esta rama, alineá schema local con:");
      console.error("  npx prisma db push  # revisar advertencias antes de ejecutarlo");
      console.error("y luego reintentá:");
      console.error("  npm run bootstrap:template-v2-demo");
    } else {
      console.error("Error en bootstrap-template-v2-demo:", err);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
