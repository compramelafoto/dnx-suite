/**
 * Almacenamiento de PDF/PNG emitidos (solo servidor).
 * Misma idea que `judgeAvatarStorage`: disco local bajo `public/uploads/diplomas`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export type DiplomaFileKind = "pdf" | "png";

function managedFilename(contestId: string, issuedId: string, kind: DiplomaFileKind): string {
  const safeContest = contestId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "contest";
  const safeIssued = issuedId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "id";
  return `${safeContest}/${safeIssued}.${kind}`;
}

export function diplomaPublicUrl(contestId: string, issuedId: string, kind: DiplomaFileKind): string {
  return `/uploads/diplomas/${managedFilename(contestId, issuedId, kind)}`;
}

function absolutePathForPublicUrl(publicUrl: string): string | null {
  const prefix = "/uploads/diplomas/";
  if (!publicUrl.startsWith(prefix)) return null;
  const rest = publicUrl.slice(prefix.length);
  if (rest.includes("..") || rest.startsWith("/")) return null;
  return path.join(process.cwd(), "public", "uploads", "diplomas", rest);
}

export async function saveDiplomaFile(
  contestId: string,
  issuedId: string,
  kind: DiplomaFileKind,
  buffer: Buffer
): Promise<{ publicUrl: string; bytes: number }> {
  const rel = managedFilename(contestId, issuedId, kind);
  const dir = path.join(process.cwd(), "public", "uploads", "diplomas", path.dirname(rel));
  await fs.mkdir(dir, { recursive: true });
  const full = path.join(process.cwd(), "public", "uploads", "diplomas", rel);
  await fs.writeFile(full, buffer);
  const publicUrl = `/uploads/diplomas/${rel}`;
  return { publicUrl, bytes: buffer.byteLength };
}

export async function deleteDiplomaFileIfManaged(publicUrl: string): Promise<void> {
  const abs = absolutePathForPublicUrl(publicUrl);
  if (!abs) return;
  try {
    await fs.unlink(abs);
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : undefined;
    if (code !== "ENOENT") console.warn("[diplomaStorage] unlink:", publicUrl, e);
  }
}
