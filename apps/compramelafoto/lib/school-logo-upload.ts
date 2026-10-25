import { randomUUID } from "crypto";
import { uploadToR2, generateR2Key, getR2PublicUrl } from "@/lib/r2-client";
import { validateSchoolLogoFile } from "@/lib/school-logo-logic";

export type SchoolLogoUploadResult =
  | { ok: true; logoUrl: string }
  | { ok: false; status: number; error: string };

/**
 * Lee el campo `file` del FormData, lo valida y lo sube a R2 bajo `prefix`.
 * Devuelve la URL pública del logo. No toca la base de datos.
 */
export async function uploadSchoolLogoFromFormData(
  formData: FormData,
  options: { prefix: string; metadata: Record<string, string> }
): Promise<SchoolLogoUploadResult> {
  const file = formData.get("file") as File | null;
  if (!file?.arrayBuffer) {
    return { ok: false, status: 400, error: "Falta el archivo (file)" };
  }

  const check = validateSchoolLogoFile(file);
  if (!check.ok) {
    return { ok: false, status: 400, error: check.error };
  }

  const name = `logo_${randomUUID()}.${check.extension}`;
  const key = generateR2Key(name, options.prefix);

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadToR2(buffer, key, check.contentType, {
    type: "school_logo",
    ...options.metadata,
  });

  return { ok: true, logoUrl: getR2PublicUrl(key) };
}
