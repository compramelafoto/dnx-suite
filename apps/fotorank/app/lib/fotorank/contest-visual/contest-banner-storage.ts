/**
 * Almacenamiento de banners de página pública de concursos (solo servidor).
 * Patrón alineado a judgeAvatarStorage: filesystem local bajo public/uploads.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export type ContestBannerExtension = "jpg" | "png" | "webp";

export type ContestBannerSaveResult = {
  publicUrl: string;
};

export interface ContestBannerStorageAdapter {
  save(contestId: string, buffer: Buffer, ext: ContestBannerExtension): Promise<ContestBannerSaveResult>;
  deleteIfManagedPublicUrl(publicUrl: string): Promise<void>;
}

const MANAGED_RE = /^\/uploads\/contests\/([a-zA-Z0-9_-]+)\/banner-([a-f0-9]{32})\.(jpg|png|webp)$/;

export function managedContestBannerFilenameFromPublicUrl(publicUrl: string): {
  contestId: string;
  filename: string;
} | null {
  try {
    const pathname = publicUrl.startsWith("http")
      ? new URL(publicUrl).pathname
      : publicUrl.split("?")[0] ?? "";
    const m = MANAGED_RE.exec(pathname);
    if (!m) return null;
    return { contestId: m[1]!, filename: `banner-${m[2]!}.${m[3]!}` };
  } catch {
    return null;
  }
}

export function createLocalFilesystemContestBannerStorage(): ContestBannerStorageAdapter {
  return {
    async save(contestId, buffer, ext) {
      const safeId = contestId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
      if (!safeId) throw new Error("contestId inválido para storage de banner.");
      const id = randomBytes(16).toString("hex");
      const filename = `banner-${id}.${ext}`;
      const dir = path.join(process.cwd(), "public", "uploads", "contests", safeId);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), buffer);
      return { publicUrl: `/uploads/contests/${safeId}/${filename}` };
    },

    async deleteIfManagedPublicUrl(publicUrl) {
      const managed = managedContestBannerFilenameFromPublicUrl(publicUrl);
      if (!managed) return;
      const abs = path.join(
        process.cwd(),
        "public",
        "uploads",
        "contests",
        managed.contestId,
        managed.filename,
      );
      try {
        await fs.unlink(abs);
      } catch (e: unknown) {
        const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : undefined;
        if (code !== "ENOENT") {
          console.warn("[contestBannerStorage] unlink:", publicUrl, e);
        }
      }
    },
  };
}

let singleton: ContestBannerStorageAdapter | null = null;

export function getContestBannerStorage(): ContestBannerStorageAdapter {
  if (!singleton) singleton = createLocalFilesystemContestBannerStorage();
  return singleton;
}

export function setContestBannerStorageForTests(adapter: ContestBannerStorageAdapter | null): void {
  singleton = adapter;
}
