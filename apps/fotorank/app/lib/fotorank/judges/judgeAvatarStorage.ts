/**
 * Almacenamiento de avatares de jurado (solo servidor).
 *
 * Ver README en esta carpeta: migración a R2/S3/Vercel Blob.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { managedJudgeAvatarFilenameFromPublicUrl } from "./judgeAvatar";

export type JudgeAvatarExtension = "jpg" | "png" | "webp";

/** Resultado de guardar: URL pública que se persiste en `FotorankJudgeProfile.avatarUrl`. */
export type JudgeAvatarSaveResult = {
  publicUrl: string;
};

/**
 * Contrato para guardar / borrar avatares subidos por el sistema.
 * Implementación local = disco bajo `public/uploads/judges`.
 * En cloud: implementar misma firma apuntando a S3/R2/Blob y devolver URL pública absoluta.
 */
export interface JudgeAvatarStorageAdapter {
  save(buffer: Buffer, ext: JudgeAvatarExtension): Promise<JudgeAvatarSaveResult>;
  /**
   * Elimina solo si `publicUrl` coincide con el patrón de archivos gestionados por este adapter.
   * No debe borrar URLs externas ni rutas ajenas.
   */
  deleteIfManagedPublicUrl(publicUrl: string): Promise<void>;
}

function absolutePathForManagedPublicUrl(publicUrl: string): string | null {
  const filename = managedJudgeAvatarFilenameFromPublicUrl(publicUrl);
  if (!filename) return null;
  return path.join(process.cwd(), "public", "uploads", "judges", filename);
}

/**
 * Implementación actual: escritura en `public/uploads/judges` (adecuado para dev / Node persistente).
 * No usar en Vercel serverless sin volumen compartido: reemplazar por adapter cloud.
 */
export function createLocalFilesystemJudgeAvatarStorage(): JudgeAvatarStorageAdapter {
  return {
    async save(buffer: Buffer, ext: JudgeAvatarExtension): Promise<JudgeAvatarSaveResult> {
      const id = randomBytes(16).toString("hex");
      const filename = `${id}.${ext}`;
      const dir = path.join(process.cwd(), "public", "uploads", "judges");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), buffer);
      return { publicUrl: `/uploads/judges/${filename}` };
    },

    async deleteIfManagedPublicUrl(publicUrl: string): Promise<void> {
      const abs = absolutePathForManagedPublicUrl(publicUrl);
      if (!abs) return;
      try {
        await fs.unlink(abs);
      } catch (e: unknown) {
        const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : undefined;
        if (code !== "ENOENT") {
          console.warn("[judgeAvatarStorage] unlink:", publicUrl, e);
        }
      }
    },
  };
}

let singleton: JudgeAvatarStorageAdapter | null = null;

/** Por ahora siempre filesystem local; más adelante: leer env y devolver adapter S3/R2/Blob. */
export function getJudgeAvatarStorage(): JudgeAvatarStorageAdapter {
  if (!singleton) {
    singleton = createLocalFilesystemJudgeAvatarStorage();
  }
  return singleton;
}

/** Test / futuro: inyectar otro adapter sin singleton. */
export function setJudgeAvatarStorageForTests(adapter: JudgeAvatarStorageAdapter | null): void {
  singleton = adapter;
}
