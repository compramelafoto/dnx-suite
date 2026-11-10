/**
 * Rehace diseños ya exportados para que la foto que quedó de costado en su hueco (una grupal
 * apaisada en un hueco vertical) salga entera, con bordes blancos, en lugar de cortada.
 *
 * Caso: carpeta escolar de Claudia Valenti (álbum 1075), noviembre de 2026. Sirve para otros
 * álbumes pasando los ids de diseño.
 *
 * - Sólo toca huecos con la foto «de costado» (`photoOrientationMismatch`) que no fueron
 *   acomodados a mano (zoom 1, centrada).
 * - Vuelve a generar PDF y JPG con `approveDesignProject`, a nombre del mismo fotógrafo que lo
 *   aprobó. **No** le manda correo a la familia (la ruta de aprobar sí lo hace).
 * - Saltea los diseños cuyo pedido ya pasó a producción física o se mandó a imprimir.
 * - Sin `--aplicar` sólo muestra lo que haría.
 *
 *   ../../packages/payments/node_modules/.bin/tsx --env-file=<env de producción> --conditions=react-server \
 *     --tsconfig ./tsconfig.json scripts/escolar/rehacer-grupal-entera.ts 70 35 … [--aplicar]
 */

import sharp from "sharp";
import type { Prisma } from "@prisma/client";
import { containPhotoZoom, photoOrientationMismatch } from "@repo/template-editor-core";
import { prisma } from "@/lib/prisma";
import { parseDesignV2Data } from "@/lib/design-v2/design-data";
import { approveDesignProject, loadDesignPhotoBytes, loadTemplateForDesign } from "@/lib/design-v2/projects";

const aplicar = process.argv.includes("--aplicar");
const ids = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);

async function main() {
  if (!ids.length) throw new Error("Pasá los ids de diseño.");
  const resultado: Record<string, number[]> = { rehecho: [], sinCambios: [], salteado: [], fallo: [] };
  for (const id of ids) {
    const project = await prisma.designProject.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        sentToPrintAt: true,
        photographerUserId: true,
        approvedByUserId: true,
        currentRevisionId: true,
        currentRevision: { select: { dataJson: true } },
        orderItem: { select: { status: true } },
      },
    });
    const data = parseDesignV2Data(project?.currentRevision?.dataJson);
    if (!project || !data || !project.currentRevisionId) {
      console.log(`#${id}: no se encontró o está incompleto`);
      resultado.fallo.push(id);
      continue;
    }
    if (project.status !== "EXPORTED" || project.sentToPrintAt || (project.orderItem && project.orderItem.status !== "EXPORTED")) {
      console.log(`#${id}: salteado (diseño ${project.status}, pedido ${project.orderItem?.status ?? "-"}, imprenta ${project.sentToPrintAt ? "sí" : "no"})`);
      resultado.salteado.push(id);
      continue;
    }
    const template = await loadTemplateForDesign(data);
    const blockById = new Map(template.legacy.blocks.map((b) => [b.id, b]));
    const slots = { ...data.slots };
    const cambios: string[] = [];
    for (const [blockId, slot] of Object.entries(data.slots)) {
      if (slot.photoId == null) continue;
      const c = slot.crop;
      if (c.zoom !== 1 || c.x !== 0 || c.y !== 0) continue;
      const block = blockById.get(blockId) as { width?: number; height?: number; layout?: { width?: number; height?: number } } | undefined;
      const slotWidth = Number(block?.layout?.width ?? block?.width ?? 0);
      const slotHeight = Number(block?.layout?.height ?? block?.height ?? 0);
      if (!slotWidth || !slotHeight) continue;
      const bytes = await loadDesignPhotoBytes(slot.photoId);
      if (!bytes) continue;
      const meta = await sharp(bytes).rotate().metadata();
      const girada = (meta.orientation ?? 1) >= 5;
      const srcWidth = girada ? meta.height! : meta.width!;
      const srcHeight = girada ? meta.width! : meta.height!;
      const sizes = { srcWidth, srcHeight, slotWidth, slotHeight };
      if (!photoOrientationMismatch(sizes)) continue;
      const zoom = containPhotoZoom(sizes);
      slots[blockId] = { ...slot, crop: { zoom, x: 0, y: 0 } };
      cambios.push(`foto ${slot.photoId} ${srcWidth}×${srcHeight} → zoom ${zoom}`);
    }
    if (!cambios.length) {
      console.log(`#${id}: sin fotos de costado`);
      resultado.sinCambios.push(id);
      continue;
    }
    console.log(`#${id}: ${cambios.join("; ")}`);
    if (!aplicar) continue;
    await prisma.designRevision.update({
      where: { id: project.currentRevisionId },
      data: { dataJson: { ...data, slots } as unknown as Prisma.InputJsonValue },
    });
    const actorId = project.approvedByUserId ?? project.photographerUserId;
    if (actorId == null) throw new Error(`#${id}: sin fotógrafo`);
    const r = await approveDesignProject(id, { id: actorId, role: "PHOTOGRAPHER" }, null);
    if (r.status === "EXPORTED") {
      console.log(`   ✓ exportado ${r.data.export?.jpgUrls?.[0] ?? ""}`);
      resultado.rehecho.push(id);
    } else {
      console.log(`   ✗ ${r.error}`);
      resultado.fallo.push(id);
    }
  }
  console.log(JSON.stringify(resultado));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
