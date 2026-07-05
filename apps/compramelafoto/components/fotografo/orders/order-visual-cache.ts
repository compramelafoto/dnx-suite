"use client";

import type { PhotographerOrderRow } from "./photographer-order-types";
import { rowKey } from "./photographer-order-types";
import { buildPhotoThumbViewUrl, parsePrintOrderFileKey } from "./order-visual-urls";
import {
  createInitialVisual,
  getOrderPlaceholderKind,
  type OrderVisualData,
} from "./order-visual-types";

const cache = new Map<string, OrderVisualData>();
const inflight = new Map<string, Promise<OrderVisualData>>();

function finalizeVisual(
  order: PhotographerOrderRow,
  partial: Partial<OrderVisualData>
): OrderVisualData {
  const placeholder = partial.placeholder ?? getOrderPlaceholderKind(order);
  const galleryUrls = partial.galleryUrls ?? [];
  const thumbUrl = partial.thumbUrl ?? galleryUrls[0] ?? null;

  return {
    thumbUrl,
    galleryUrls,
    placeholder,
    initials: partial.initials ?? createInitialVisual(order).initials,
    loading: false,
    loaded: true,
  };
}

async function fetchPrintOrderVisual(order: PhotographerOrderRow): Promise<OrderVisualData> {
  if (order._dataProtected) {
    return finalizeVisual(order, { placeholder: "protected", galleryUrls: [], thumbUrl: null });
  }

  try {
    const res = await fetch(`/api/print-orders/${order.id}`, { credentials: "include" });
    if (!res.ok) {
      return finalizeVisual(order, {});
    }

    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    const galleryUrls: string[] = [];

    for (const item of items) {
      const fileKey = typeof item?.fileKey === "string" ? item.fileKey : "";
      if (!fileKey || fileKey === "[Protegido]") continue;
      const parsed = parsePrintOrderFileKey(fileKey);
      if (!parsed) continue;
      if (parsed.kind === "photo") {
        galleryUrls.push(buildPhotoThumbViewUrl(parsed.photoId));
      } else {
        galleryUrls.push(parsed.url);
      }
    }

    const unique = [...new Set(galleryUrls)];
    return finalizeVisual(order, {
      galleryUrls: unique.slice(0, 8),
      thumbUrl: unique[0] ?? null,
      placeholder: unique.length > 0 ? getOrderPlaceholderKind(order) : "print",
    });
  } catch {
    return finalizeVisual(order, {});
  }
}

function resolveEventCoverVisual(
  order: PhotographerOrderRow,
  eventCovers: Map<number, string>
): OrderVisualData | null {
  const eventId = order.albumEventId;
  if (!eventId || order._dataProtected) return null;
  const cover = eventCovers.get(eventId);
  if (!cover) return null;
  return finalizeVisual(order, {
    thumbUrl: cover,
    galleryUrls: [cover],
    placeholder: getOrderPlaceholderKind(order),
  });
}

export async function loadOrderVisual(
  order: PhotographerOrderRow,
  eventCovers: Map<number, string>
): Promise<OrderVisualData> {
  const key = rowKey(order);

  const cached = cache.get(key);
  if (cached?.loaded) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    if (order.source === "PRINT_ORDER") {
      const visual = await fetchPrintOrderVisual(order);
      cache.set(key, visual);
      return visual;
    }

    const eventVisual = resolveEventCoverVisual(order, eventCovers);
    if (eventVisual) {
      cache.set(key, eventVisual);
      return eventVisual;
    }

    const fallback = finalizeVisual(order, {});
    cache.set(key, fallback);
    return fallback;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

export function peekOrderVisual(order: PhotographerOrderRow): OrderVisualData {
  return cache.get(rowKey(order)) ?? createInitialVisual(order);
}

export function primeOrderVisual(order: PhotographerOrderRow, data: OrderVisualData) {
  cache.set(rowKey(order), data);
}
