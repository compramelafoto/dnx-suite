import type { Prisma } from "@/lib/prisma";

export const ALBUM_PHOTO_LIST_DEFAULT_LIMIT = 100;
export const ALBUM_PHOTO_LIST_MAX_LIMIT = 500;

export type AlbumPhotoListCursor = {
  createdAt: Date;
  id: number;
};

export type ParsedAlbumPhotoListQuery = {
  limit: number | null;
  cursor: AlbumPhotoListCursor | null;
};

export type AlbumPhotoListPageMeta = {
  totalCount: number;
  limit: number | null;
  cursor: string | null;
  nextCursor: string | null;
};

export function encodeAlbumPhotoListCursor(createdAt: Date, id: number): string {
  return `${createdAt.toISOString()}|${id}`;
}

export function parseAlbumPhotoListCursor(raw: string | null): AlbumPhotoListCursor | null {
  if (raw == null || raw.trim() === "") return null;
  const sep = raw.lastIndexOf("|");
  if (sep <= 0) return null;
  const createdAtRaw = raw.slice(0, sep);
  const idRaw = raw.slice(sep + 1);
  const id = parseInt(idRaw, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  const createdAt = new Date(createdAtRaw);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}

export function parseAlbumPhotoListQuery(searchParams: {
  get(name: string): string | null;
}): ParsedAlbumPhotoListQuery | { error: string } {
  const limitRaw = searchParams.get("limit");
  const cursorRaw = searchParams.get("cursor");

  if (limitRaw == null || limitRaw.trim() === "") {
    if (cursorRaw != null && cursorRaw.trim() !== "") {
      return { error: "El parámetro cursor requiere limit." };
    }
    return { limit: null, cursor: null };
  }

  const limit = parseInt(limitRaw, 10);
  if (!Number.isFinite(limit) || limit <= 0) {
    return { error: "limit debe ser un entero positivo." };
  }
  if (limit > ALBUM_PHOTO_LIST_MAX_LIMIT) {
    return {
      error: `limit no puede superar ${ALBUM_PHOTO_LIST_MAX_LIMIT}.`,
    };
  }

  const cursor = parseAlbumPhotoListCursor(cursorRaw);
  if (cursorRaw != null && cursorRaw.trim() !== "" && cursor == null) {
    return { error: "cursor inválido." };
  }

  return { limit, cursor };
}

/** Condición para la página siguiente (orden createdAt desc, id desc). */
export function albumPhotoCursorWhere(
  cursor: AlbumPhotoListCursor
): Prisma.PhotoWhereInput {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

export function paginatePhotoRows<T extends { createdAt: Date; id: number }>(
  rows: T[],
  opts: { limit: number | null; cursor: AlbumPhotoListCursor | null }
): { page: T[]; nextCursor: string | null } {
  let slice = rows;

  if (opts.cursor) {
    const { createdAt, id } = opts.cursor;
    slice = slice.filter(
      (p) =>
        p.createdAt.getTime() < createdAt.getTime() ||
        (p.createdAt.getTime() === createdAt.getTime() && p.id < id)
    );
  }

  if (opts.limit == null) {
    return { page: slice, nextCursor: null };
  }

  const hasMore = slice.length > opts.limit;
  const page = hasMore ? slice.slice(0, opts.limit) : slice;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last != null ? encodeAlbumPhotoListCursor(last.createdAt, last.id) : null;
  return { page, nextCursor };
}

export function buildAlbumPhotoListPageMeta(params: {
  totalCount: number;
  limit: number | null;
  cursor: string | null;
  nextCursor: string | null;
}): AlbumPhotoListPageMeta {
  return {
    totalCount: params.totalCount,
    limit: params.limit,
    cursor: params.cursor,
    nextCursor: params.nextCursor,
  };
}
