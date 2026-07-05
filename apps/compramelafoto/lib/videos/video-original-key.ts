import crypto from "crypto";
import { extensionForVideoMime } from "@/lib/videos/video-validation";

export function buildVideoOriginalR2Key(albumId: number, contentType: string): string {
  const ext = extensionForVideoMime(contentType);
  return `albums/${albumId}/videos/original/${crypto.randomUUID()}${ext}`;
}

export function isValidVideoOriginalKeyForAlbum(albumId: number, key: string): boolean {
  const prefix = `albums/${albumId}/videos/original/`;
  return key.startsWith(prefix) && key.length > prefix.length;
}
