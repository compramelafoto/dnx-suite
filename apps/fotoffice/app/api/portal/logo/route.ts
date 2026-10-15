import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { IMAGE_PRESETS } from "@/lib/images/presets";
import { uploadFotofficeImage } from "@/lib/images/upload";

export const runtime = "nodejs";

/**
 * Subida del logo de la empresa del socio, desde su propio portal.
 *
 * Mismo criterio que `/api/portal/foto`: la ficha sale **de la sesión**, nunca de lo que mande
 * el cliente, así que cada socio solo puede tocar su propio logo. El preset es fijo.
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
    return NextResponse.json({ error: "Elegí una imagen." }, { status: 400 });
  }

  const preset = IMAGE_PRESETS.memberBusinessLogo;
  if (file.size > preset.maxFileSizeBytes) {
    return NextResponse.json(
      { error: `El logo no puede pesar más de ${Math.round(preset.maxFileSizeBytes / 1024 / 1024)} MB.` },
      { status: 400 },
    );
  }

  const result = await uploadFotofficeImage({
    presetKey: "memberBusinessLogo",
    bytes: new Uint8Array(await file.arrayBuffer()),
    originalFilename: file.name,
    scopeSegment: context.workspace.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await prisma.member.update({
    where: { id: context.member.id },
    data: { businessLogoUrl: result.url },
  });
  return NextResponse.json({ url: result.url });
}

/** Quita el logo. Sin logo, el portal muestra solo el nombre de la empresa. */
export async function DELETE() {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) {
    return NextResponse.json({ error: "No encontramos tu ficha de socio." }, { status: 403 });
  }

  await prisma.member.update({
    where: { id: context.member.id },
    data: { businessLogoUrl: null },
  });
  return NextResponse.json({ ok: true });
}
