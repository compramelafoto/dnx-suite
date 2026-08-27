import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { IMAGE_PRESETS } from "@/lib/images/presets";
import { uploadFotofficeImage } from "@/lib/images/upload";

export const runtime = "nodejs";

/**
 * Subida de la foto del socio, desde su propio portal.
 *
 * Existe aparte de `/api/uploads/image` porque aquel exige ser `OWNER` o `ADMIN` del workspace,
 * y un socio no es parte del equipo que administra la institución. Acá la ficha se resuelve
 * **desde la sesión**, nunca de lo que mande el cliente: cada socio solo puede tocar su propia
 * foto, y no hay forma de nombrar la ficha de otro.
 *
 * El preset es fijo: `memberAvatar`, con el mínimo de 472×472 que exige la credencial impresa.
 * No se acepta un preset por parámetro — sería una forma de escribir en otros namespaces.
 */
export async function POST(request: Request) {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) {
    return NextResponse.json({ error: "No encontramos tu ficha de socio." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Elegí una foto." }, { status: 400 });
  }

  const preset = IMAGE_PRESETS.memberAvatar;
  if (file.size > preset.maxFileSizeBytes) {
    return NextResponse.json(
      { error: `La foto no puede pesar más de ${Math.round(preset.maxFileSizeBytes / 1024 / 1024)} MB.` },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadFotofficeImage({
    presetKey: "memberAvatar",
    bytes,
    originalFilename: file.name,
    scopeSegment: context.workspace.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await prisma.member.update({
    where: { id: context.member.id },
    data: { avatarUrl: result.url },
  });

  return NextResponse.json({ url: result.url });
}
