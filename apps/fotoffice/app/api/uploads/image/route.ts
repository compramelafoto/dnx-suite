import { NextResponse } from "next/server";
import { requireImageUploadContext } from "@/lib/images/access";
import { isImagePresetKey } from "@/lib/images/presets";
import { uploadFotofficeImage } from "@/lib/images/upload";

export const runtime = "nodejs";

/**
 * Endpoint único de upload de imágenes institucionales de FotoOffice.
 * Reutilizable por cualquier pantalla: recibe `file` + `preset` (una key de
 * IMAGE_PRESETS) y devuelve `{ url }`. El workspace SIEMPRE se resuelve acá
 * desde la sesión — nunca se confía en un workspaceId enviado por el cliente,
 * así es estructuralmente imposible que un usuario del Workspace A escriba
 * en el namespace de storage del Workspace B.
 */
export async function POST(request: Request) {
  const ctx = await requireImageUploadContext();
  if (!ctx) {
    return NextResponse.json(
      { error: "No tenés permiso para subir imágenes en este workspace." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido." }, { status: 400 });
  }

  const presetKey = String(formData.get("preset") ?? "");
  if (!isImagePresetKey(presetKey)) {
    return NextResponse.json({ error: "Preset de imagen inválido." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadFotofficeImage({
    presetKey,
    bytes,
    originalFilename: file.name,
    scopeSegment: ctx.workspace.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ url: result.url }, { status: 201 });
}
