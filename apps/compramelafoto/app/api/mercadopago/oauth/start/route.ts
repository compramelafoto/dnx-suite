import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { buildAuthorizeUrl } from "@/lib/mercadopago-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerType = searchParams.get("ownerType");

    if (ownerType !== "USER" && ownerType !== "LAB") {
      return NextResponse.json({ error: "ownerType inválido" }, { status: 400 });
    }

    const { error, user } = await requireAuth();
    if (error || !user) {
      return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
    }

    if (ownerType === "USER") {
      if (!["PHOTOGRAPHER", "LAB_PHOTOGRAPHER", "ADMIN"].includes(user.role)) {
        return NextResponse.json({ error: "No autorizado para conectar usuario" }, { status: 403 });
      }
    } else {
      if (!["LAB", "LAB_PHOTOGRAPHER", "ADMIN"].includes(user.role)) {
        return NextResponse.json({ error: "No autorizado para conectar laboratorio" }, { status: 403 });
      }
    }

    let ownerId: number | null = null;
    if (ownerType === "USER") {
      ownerId = user.id;
    } else {
      if (user.labId) {
        ownerId = user.labId;
      } else {
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
    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error("GET /api/mercadopago/oauth/start ERROR >>>", err);
    return NextResponse.json(
      { error: "Error iniciando OAuth de Mercado Pago", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
