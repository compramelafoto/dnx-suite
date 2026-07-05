import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/photobook-projects
 * Guarda un proyecto de fotolibro (PhotobookDocument). Solo admin.
 * Body: { document, images, title? }
 * - document: AlbumDocument (spec, spreads)
 * - images: ImageAsset[] (id, url, name)
 */
export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const document = body.document ?? null;
    const images = Array.isArray(body.images) ? body.images : [];
    const title = typeof body.title === "string" ? body.title.trim() || null : null;

    if (!document || typeof document !== "object") {
      return NextResponse.json({ error: "Falta document" }, { status: 400 });
    }
    if (!document.spec || !Array.isArray(document.spreads)) {
      return NextResponse.json({ error: "document inválido (spec, spreads)" }, { status: 400 });
    }

    const id = `proj_${randomBytes(12).toString("base64url")}`;
    const data = { document, images };
    const doc = await prisma.photobookDocument.create({
      data: { id, title: title ?? `Proyecto ${new Date().toLocaleDateString("es-AR")}`, data },
    });

    return NextResponse.json({
      id: doc.id,
      title: doc.title,
      createdAt: doc.createdAt,
      message: "Proyecto guardado correctamente. Podés retomarlo cuando quieras.",
    });
  } catch (e) {
    console.error("POST /api/admin/photobook-projects error:", e);
    return NextResponse.json({ error: "Error al guardar proyecto" }, { status: 500 });
  }
}
