import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { buildAuthorizeUrl } from "@/lib/mercadopago-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: Iniciar flujo OAuth de Mercado Pago (compatibilidad)
export async function POST(req: Request) {
  try {
    const { error, user } = await requireAuth(["PHOTOGRAPHER", "LAB", "LAB_PHOTOGRAPHER", "ADMIN"]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado" },
        { status: 401 }
      );
    }

    const ownerType = user.role === "LAB" || user.role === "LAB_PHOTOGRAPHER" ? "LAB" : "USER";
    let ownerId: number | null = null;

    if (ownerType === "USER") {
      ownerId = user.id;
    } else {
      ownerId = user.labId ?? null;
      if (!ownerId) {
        const lab = await prisma.lab.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });
        ownerId = lab?.id ?? null;
      }
    }

    if (!ownerId) {
      return NextResponse.json({ error: "No se encontró laboratorio asociado" }, { status: 404 });
    }

    const state = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.mercadoPagoOAuthState.create({
      data: {
        state,
        ownerType,
        ownerId,
        expiresAt,
      },
    });

    const authUrl = buildAuthorizeUrl({ state });
    return NextResponse.json({ authUrl, state });
  } catch (err: any) {
    console.error("GET /api/mercadopago/oauth/connect ERROR >>>", err);
    return NextResponse.json(
      { error: "Error iniciando conexión con Mercado Pago", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
