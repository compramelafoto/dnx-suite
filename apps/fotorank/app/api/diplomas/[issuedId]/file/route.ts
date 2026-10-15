import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser } from "../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../lib/fotorank/dashboard-org-context";
import { readDiplomaFile } from "../../../../lib/fotorank/diplomas/diplomaStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Descarga de un diploma emitido, sólo para la organización que lo emitió. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ issuedId: string }> }
) {
  const { issuedId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "png" ? "png" : "pdf";
  const inline = searchParams.get("inline") === "1";

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) {
    return NextResponse.json({ error: org.error }, { status: 403 });
  }

  const issued = await prisma.fotorankDiplomaIssued.findFirst({
    where: { id: issuedId, organizationId: org.org.id },
    select: { pdfUrl: true, pngUrl: true, contestId: true, diplomaCode: true },
  });

  if (!issued) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const url = format === "png" ? issued.pngUrl : issued.pdfUrl;
  if (!url) {
    return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  }

  const bytes = await readDiplomaFile(issued.contestId, issuedId, format);
  if (!bytes) {
    return NextResponse.json({ error: "No se pudo leer el archivo." }, { status: 404 });
  }

  const nombre = `diploma-${issued.diplomaCode.replace(/[^A-Za-z0-9_-]/g, "") || issuedId}.${format}`;
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": format === "png" ? "image/png" : "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
