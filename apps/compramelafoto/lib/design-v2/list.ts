import "server-only";
import type { PrismaClient } from "@prisma/client";
import { parseDesignV2Data } from "./design-data";
import { designPhotoDisplayUrl, type DesignActor } from "./projects";

export type DesignListItem = {
  id: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  albumId: number | null;
  albumTitle: string | null;
  templateName: string | null;
  buyerLabel: string | null;
  /** Primera foto elegida, para reconocer el diseño de un vistazo. */
  thumbnailUrl: string | null;
  source: "PACK" | "PREVENTA";
};

/** Estados que el fotógrafo tiene que mirar primero. */
export const DESIGN_STATUSES_TO_REVIEW = ["PENDING_PHOTOGRAPHER_APPROVAL", "APPROVED_FOR_EXPORT"];

export async function listDesignProjectsForActor(db: PrismaClient, actor: DesignActor): Promise<DesignListItem[]> {
  const projects = await db.designProject.findMany({
    where: {
      templateV2Id: { not: null },
      ...(actor.role === "ADMIN" ? {} : { photographerUserId: actor.id }),
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      albumId: true,
      albumOrderId: true,
      orderItemId: true,
      templateV2Id: true,
      currentRevision: { select: { dataJson: true } },
    },
  });

  const albumIds = [...new Set(projects.map((p) => p.albumId).filter((id): id is number => id != null))];
  const templateIds = [...new Set(projects.map((p) => p.templateV2Id).filter((id): id is string => id != null))];
  const orderIds = [...new Set(projects.map((p) => p.albumOrderId).filter((id): id is number => id != null))];
  const itemIds = [...new Set(projects.map((p) => p.orderItemId).filter((id): id is number => id != null))];
  const firstPhotoIds = new Map<number, number>();
  for (const p of projects) {
    const data = parseDesignV2Data(p.currentRevision?.dataJson);
    const first = data?.photoIds[0];
    if (first != null) firstPhotoIds.set(p.id, first);
  }

  const [albums, templates, orders, items, photos] = await Promise.all([
    albumIds.length ? db.album.findMany({ where: { id: { in: albumIds } }, select: { id: true, title: true } }) : [],
    templateIds.length
      ? db.templateV2.findMany({ where: { id: { in: templateIds } }, select: { id: true, name: true } })
      : [],
    orderIds.length
      ? db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, buyerName: true, buyerEmail: true } })
      : [],
    itemIds.length
      ? db.preCompraOrderItem.findMany({
          where: { id: { in: itemIds } },
          select: {
            id: true,
            order: { select: { buyerName: true, buyerEmail: true, studentFirstName: true, studentLastName: true } },
          },
        })
      : [],
    firstPhotoIds.size
      ? db.photo.findMany({
          where: { id: { in: [...firstPhotoIds.values()] } },
          select: { id: true, previewUrl: true, originalKey: true },
        })
      : [],
  ]);

  const albumById = new Map(albums.map((a) => [a.id, a.title]));
  const templateById = new Map(templates.map((t) => [t.id, t.name]));
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const photoById = new Map(photos.map((p) => [p.id, p]));

  return projects.map((p) => {
    const order = p.albumOrderId ? orderById.get(p.albumOrderId) : undefined;
    const item = p.orderItemId ? itemById.get(p.orderItemId) : undefined;
    const student = item
      ? [item.order.studentFirstName, item.order.studentLastName].filter(Boolean).join(" ").trim()
      : "";
    const buyerLabel =
      student ||
      order?.buyerName?.trim() ||
      order?.buyerEmail ||
      item?.order.buyerName?.trim() ||
      item?.order.buyerEmail ||
      null;
    const photoId = firstPhotoIds.get(p.id);
    const photo = photoId != null ? photoById.get(photoId) : undefined;
    return {
      id: p.id,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      albumId: p.albumId,
      albumTitle: p.albumId ? (albumById.get(p.albumId) ?? null) : null,
      templateName: p.templateV2Id ? (templateById.get(p.templateV2Id) ?? null) : null,
      buyerLabel,
      thumbnailUrl: photo ? designPhotoDisplayUrl(photo) : null,
      source: p.orderItemId ? "PREVENTA" : "PACK",
    };
  });
}
