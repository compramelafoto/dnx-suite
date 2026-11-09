import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { completeAgencyWebUpload } from "@/lib/agencies/web-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Subida web al álbum de una agencia (miembro desde su sesión, o dueño indicando el autor). Ver `lib/agencies/web-uploads.ts`. */
export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Los datos no son válidos." }, { status: 400 });
  try {
    const r = await completeAgencyWebUpload({ id: user.id, role: user.role }, body as Record<string, unknown>);
    return NextResponse.json(r.body, { status: r.status });
  } catch (err) {
    console.error("POST agencias/subida-web/complete ERROR >>>", err);
    return NextResponse.json({ error: "No se pudo subir la foto. Probá de nuevo." }, { status: 500 });
  }
}
