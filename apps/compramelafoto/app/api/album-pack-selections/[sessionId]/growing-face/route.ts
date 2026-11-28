import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  GrowingPackFaceError,
  saveGrowingPackFace,
} from "@/lib/album-packs/growing-pack/save-growing-pack-face";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = Promise<{ sessionId: string }>;

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

/**
 * Guarda la selfie del comprador de un pack «Todas mis fotos» que se va sumando.
 * Requiere el permiso explícito (`consent=1`) y la misma llave de la selección que usa mark-ready.
 */
export async function POST(req: NextRequest, { params }: { params: RouteParams }) {
  try {
    const sessionId = String((await params).sessionId ?? "").trim();
    if (!sessionId) {
      return NextResponse.json({ error: "Selección inválida." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rate = checkRateLimit({ key: `growing-face:${ip}`, limit: 10, windowMs: 60 * 1000 });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intentá de nuevo en un minuto." },
        { status: 429 }
      );
    }

    const session = await prisma.albumPackSelectionSession.findUnique({
      where: { id: sessionId },
      select: { guestToken: true, buyerEmail: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Selección no encontrada." }, { status: 404 });
    }
    const authUser = await getAuthUser();
    const guestToken = req.headers.get("x-guest-token")?.trim() || null;
    const ownerByEmail =
      !!authUser?.email &&
      !!normalizeEmail(session.buyerEmail) &&
      normalizeEmail(authUser.email) === normalizeEmail(session.buyerEmail);
    if (session.guestToken && session.guestToken !== guestToken && !ownerByEmail) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const form = await req.formData();
    if (String(form.get("consent") ?? "") !== "1") {
      return NextResponse.json(
        { error: "Falta tu permiso para guardar la selfie." },
        { status: 400 }
      );
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta la selfie." }, { status: 400 });
    }

    const result = await saveGrowingPackFace({ sessionId, file });
    return NextResponse.json({ ok: true, created: result.created });
  } catch (err) {
    if (err instanceof GrowingPackFaceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[growing-face] error", err);
    return NextResponse.json(
      { error: "No pudimos guardar tu selfie. Intentá de nuevo." },
      { status: 500 }
    );
  }
}
