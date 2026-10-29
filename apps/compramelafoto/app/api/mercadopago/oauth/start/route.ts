import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { buildAuthorizeUrl } from "@/lib/mercadopago-oauth";
import { esCorreoDePrueba, MP_TOKEN_DEMO } from "@/lib/demos/identidad";
import { rutaDeVueltaMercadoPago } from "@/lib/mercadopago/ruta-de-vuelta";

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
      if (!["PHOTOGRAPHER", "LAB_PHOTOGRAPHER", "ORGANIZER", "SCHOOL_ORGANIZER", "ADMIN"].includes(user.role)) {
        return NextResponse.json({ error: "No autorizado para conectar usuario" }, { status: 403 });
      }
    } else {
      if (!["LAB", "LAB_PHOTOGRAPHER", "ADMIN"].includes(user.role)) {
        return NextResponse.json({ error: "No autorizado para conectar laboratorio" }, { status: 403 });
      }
    }

    // Usuarios de las demos (correo .test): conexión simulada, sin ir a Mercado Pago.
    if (ownerType === "USER" && esCorreoDePrueba(user.email)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { mpAccessToken: MP_TOKEN_DEMO, mpUserId: "DEMO", mpConnectedAt: new Date() },
      });
      return NextResponse.redirect(new URL(await rutaDeVueltaMercadoPago(user.id, user.role, "USER", { mp_connected: "true" }), req.url));
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
