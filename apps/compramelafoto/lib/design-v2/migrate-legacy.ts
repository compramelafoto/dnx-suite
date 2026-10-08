import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { createTemplateV2 } from "@/lib/template-v2/server";

/**
 * Pasa las plantillas del diseñador viejo (`Template` + `TemplateSlot`) al diseñador nuevo.
 *
 * Cada plantilla vieja es una imagen de fondo con recuadros donde van las fotos. En la nueva:
 * - la imagen queda como imagen fija de fondo, a la medida física de la vieja (300 dpi);
 * - cada recuadro pasa a ser un hueco "Foto del cliente n", en el orden en que estaban.
 *
 * Además, lo que apuntaba a la vieja (beneficios de preventa, packs de galería) pasa a apuntar
 * a la nueva. Idempotente: la versión nueva guarda `migratedFromLegacyTemplateId` y una plantilla
 * ya migrada no se vuelve a crear.
 */

const DPI = 300;
const CM_PER_INCH = 2.54;

export type LegacyMigrationRow = {
  legacyTemplateId: number;
  name: string;
  templateV2Id: string | null;
  created: boolean;
  slots: number;
  benefitsRepointed: number;
  packsRepointed: number;
  error: string | null;
};

async function imageSize(url: string): Promise<{ width: number; height: number } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
  } catch {
    return null;
  }
}

function asBbox(raw: unknown): { x: number; y: number; width: number; height: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
  const box = { x: n(b.x), y: n(b.y), width: n(b.width), height: n(b.height) };
  return Object.values(box).some((v) => Number.isNaN(v)) || box.width <= 0 || box.height <= 0 ? null : box;
}

async function findMigrated(legacyTemplateId: number): Promise<string | null> {
  const version = await prisma.templateV2Version.findFirst({
    where: { metaJson: { path: ["migratedFromLegacyTemplateId"], equals: legacyTemplateId } },
    select: { templateId: true },
  });
  return version?.templateId ?? null;
}

async function repoint(legacyTemplateId: number, templateV2Id: string) {
  const benefits = await prisma.benefitDefinition.updateMany({
    where: { templateId: legacyTemplateId },
    data: { templateV2Id, templateId: null },
  });
  const packs = await prisma.albumPack.updateMany({
    where: { templateId: legacyTemplateId },
    data: { templateV2Id, templateId: null },
  });
  return { benefits: benefits.count, packs: packs.count };
}

export async function migrateLegacyTemplatesToV2(adminUserId: number): Promise<LegacyMigrationRow[]> {
  const templates = await prisma.template.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      widthCm: true,
      heightCm: true,
      isSystemTemplate: true,
      album: { select: { userId: true } },
      slots: { select: { index: true, pageIndex: true, bbox: true }, orderBy: [{ pageIndex: "asc" }, { index: "asc" }] },
    },
  });

  const rows: LegacyMigrationRow[] = [];
  for (const t of templates) {
    const row: LegacyMigrationRow = {
      legacyTemplateId: t.id,
      name: t.name,
      templateV2Id: null,
      created: false,
      slots: t.slots.length,
      benefitsRepointed: 0,
      packsRepointed: 0,
      error: null,
    };
    try {
      let templateV2Id = await findMigrated(t.id);
      if (!templateV2Id) {
        const width = Math.round((t.widthCm / CM_PER_INCH) * DPI);
        const height = Math.round((t.heightCm / CM_PER_INCH) * DPI);
        // Los recuadros viejos están en píxeles de la imagen de fondo: se llevan al lienzo nuevo.
        const size = t.imageUrl ? await imageSize(t.imageUrl) : null;
        const sx = size ? width / size.width : 1;
        const sy = size ? height / size.height : 1;
        const layout = (x: number, y: number, w: number, h: number, zIndex: number) => ({
          x,
          y,
          width: w,
          height: h,
          rotation: 0,
          zIndex,
          opacity: 1,
          locked: false,
          visible: true,
        });

        const blocks: unknown[] = [
          {
            id: randomUUID(),
            type: "BACKGROUND",
            pageIndex: 0,
            name: "Fondo",
            layout: { ...layout(0, 0, width, height, 0), locked: true },
            configJson: { backgroundColor: "#ffffff", src: "", fit: "cover" },
          },
        ];
        if (t.imageUrl) {
          blocks.push({
            id: randomUUID(),
            type: "IMAGE",
            pageIndex: 0,
            name: "Imagen de la plantilla",
            layout: layout(0, 0, width, height, 1),
            configJson: { src: t.imageUrl, fit: "cover", source: {}, maskShape: "rect", photoMode: "free", borderRadius: 0 },
          });
        }
        t.slots.forEach((slot, i) => {
          const box = asBbox(slot.bbox);
          if (!box) return;
          blocks.push({
            id: randomUUID(),
            type: "IMAGE",
            pageIndex: slot.pageIndex ?? 0,
            name: `Foto del cliente ${i + 1}`,
            layout: layout(box.x * sx, box.y * sy, box.width * sx, box.height * sy, 10 + i),
            configJson: {
              src: "",
              fit: "cover",
              source: { variableKey: `photo_${i + 1}` },
              maskShape: "rect",
              photoMode: "single",
              borderRadius: 0,
            },
          });
        });
        const pageCount = Math.max(1, ...t.slots.map((s) => (s.pageIndex ?? 0) + 1));

        const ownerUserId = !t.isSystemTemplate && t.album?.userId ? t.album.userId : adminUserId;
        const created = await createTemplateV2({
          user: { id: ownerUserId, role: ownerUserId === adminUserId ? "ADMIN" : "PHOTOGRAPHER" },
          name: t.name,
          description: "Migrada del diseñador viejo.",
          product: "school",
          payload: {
            canvas: { width, height, background: "#ffffff", dpi: DPI, bleedMm: 0, safeAreaMm: 0 },
            blocks,
            variableBindings: [],
            meta: {
              templatePageCount: pageCount,
              migratedFromLegacyTemplateId: t.id,
              photoInputs: t.slots.map((_, i) => ({ slotKey: `photo_${i + 1}`, label: `Foto ${i + 1}` })),
            },
          },
        });
        templateV2Id = (created as { templateId: string }).templateId;
        row.created = true;
      }
      row.templateV2Id = templateV2Id;
      const moved = await repoint(t.id, templateV2Id);
      row.benefitsRepointed = moved.benefits;
      row.packsRepointed = moved.packs;
    } catch (err) {
      row.error = err instanceof Error ? err.message : String(err);
    }
    rows.push(row);
  }
  return rows;
}

/** Estado de la migración sin cambiar nada: qué plantillas viejas hay y cuáles ya pasaron. */
export async function legacyMigrationStatus(): Promise<
  Array<{ legacyTemplateId: number; name: string; imageUrl: string; slots: number; templateV2Id: string | null }>
> {
  const templates = await prisma.template.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, imageUrl: true, _count: { select: { slots: true } } },
  });
  const out = [];
  for (const t of templates) {
    out.push({
      legacyTemplateId: t.id,
      name: t.name,
      imageUrl: t.imageUrl,
      slots: t._count.slots,
      templateV2Id: await findMigrated(t.id),
    });
  }
  return out;
}
