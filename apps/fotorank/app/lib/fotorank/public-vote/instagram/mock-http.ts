/**
 * ETAPA 17B — Mock HTTP contract Meta/Instagram (E2E + dev). Cero writes reales salvo probe explícito.
 */
import { createHash } from "node:crypto";

type MockMedia = {
  id: string;
  likeCount: number;
  likesHidden: boolean;
  deleted: boolean;
  permalink: string;
};

const mediaStore = new Map<string, MockMedia>();
const publishByKey = new Map<string, MockMedia>();
let forceThrottle = false;

export function resetMockInstagramHttp() {
  mediaStore.clear();
  publishByKey.clear();
  forceThrottle = false;
}

export function mockForceThrottle(active: boolean) {
  forceThrottle = active;
}

export function mockSetLikes(mediaId: string, likeCount: number) {
  const m = mediaStore.get(mediaId);
  if (m) m.likeCount = likeCount;
}

export function mockHideLikes(mediaId: string, hidden = true) {
  const m = mediaStore.get(mediaId);
  if (m) m.likesHidden = hidden;
}

export function mockDeleteMedia(mediaId: string) {
  const m = mediaStore.get(mediaId);
  if (m) m.deleted = true;
}

export async function mockGetMediaLikeCount(input: {
  mediaId: string;
  tokenReference: string;
}): Promise<{ like_count: number | null; error?: string }> {
  if (forceThrottle) {
    return { like_count: null, error: "RATE_LIMITED" };
  }
  const m = mediaStore.get(input.mediaId);
  if (!m || m.deleted) {
    return { like_count: null, error: m?.deleted ? "PUBLICATION_DELETED" : "NOT_FOUND" };
  }
  if (m.likesHidden) {
    return { like_count: null, error: "LIKE_COUNT_HIDDEN" };
  }
  if (input.tokenReference.includes("expired")) {
    return { like_count: null, error: "TOKEN_EXPIRED" };
  }
  return { like_count: m.likeCount };
}

export async function mockPublishImage(input: {
  idempotencyKey: string;
  caption: string;
  imageUrl: string;
  accountId: string;
}): Promise<{
  externalMediaId: string;
  externalContainerId: string;
  permalink: string;
  idempotent: boolean;
}> {
  const existing = publishByKey.get(input.idempotencyKey);
  if (existing) {
    return {
      externalMediaId: existing.id,
      externalContainerId: `container_${existing.id}`,
      permalink: existing.permalink,
      idempotent: true,
    };
  }
  const id = `ig_${createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 16)}`;
  const media: MockMedia = {
    id,
    likeCount: 0,
    likesHidden: false,
    deleted: false,
    permalink: `https://www.instagram.com/p/${id}/`,
  };
  mediaStore.set(id, media);
  publishByKey.set(input.idempotencyKey, media);
  return {
    externalMediaId: id,
    externalContainerId: `container_${id}`,
    permalink: media.permalink,
    idempotent: false,
  };
}

export function registerMockMedia(mediaId: string, likeCount = 0) {
  mediaStore.set(mediaId, {
    id: mediaId,
    likeCount,
    likesHidden: false,
    deleted: false,
    permalink: `https://www.instagram.com/p/${mediaId}/`,
  });
}

export function getMockMediaStoreSize() {
  return mediaStore.size;
}
