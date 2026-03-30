import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser } from "../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../lib/fotorank/dashboard-org-context";

export const dynamic = "force-dynamic";

function publicUrlToAbsoluteFile(publicUrl: string): string | null {
  if (!publicUrl.startsWith("/uploads/diplomas/")) return null;
  const rel = publicUrl.replace(/^\//, "");
  if (rel.includes("..")) return null;
  return path.join(process.cwd(), "public", rel);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ issuedId: string }> }
) {
  const { issuedId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "png" ? "png" : "pdf";

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
    select: { pdfUrl: true, pngUrl: true, contestId: true },
  });

  if (!issued) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const url = format === "png" ? issued.pngUrl : issued.pdfUrl;
  if (!url) {
    return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  }

  const abs = publicUrlToAbsoluteFile(url);
  if (!abs) {
    return NextResponse.json({ error: "Ruta no válida." }, { status: 400 });
  }

  try {
    const buf = await readFile(abs);
    const contentType = format === "png" ? "image/png" : "application/pdf";
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="diploma-${issuedId}.${format}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo leer el archivo." }, { status: 500 });
  }
}
