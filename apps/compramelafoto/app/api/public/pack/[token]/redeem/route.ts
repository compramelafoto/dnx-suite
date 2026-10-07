import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/lib/prisma";
import {
  executePreventaPackRedeemV1,
  PreventaPackRedeemValidationError,
} from "@/lib/preventa-canjeable/redeem-preventa-pack-order-v1";
import { getOrderIdForPackAccessToken } from "@/lib/preventa-canjeable/pack-access-tokens";
import { completePreventaRedemption } from "@/lib/preventa-canjeable/complete-preventa-redemption";
import { prisma } from "@/lib/prisma";
import { getCheckoutEmailValidationError } from "@/lib/email-validation";
import { digitsOnly, isValidPhoneForPurchase } from "@/lib/phone-validation";
import { isPlaceholderEmail } from "@/lib/canje-externo/external-preventa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  selections: z
    .array(
      z.object({
        benefitStableKey: z.string().min(1),
        units: z.array(z.array(z.number().int().positive())),
      })
    )
    .min(1),
  /** Pack cobrado por fuera: la familia carga sus datos al canjear (ver `external-preventa`). */
  contacto: z
    .object({
      nombre: z.string().trim().min(1).max(120),
      email: z.string().trim().min(3).max(200),
      telefono: z.string().trim().min(6).max(40),
    })
    .optional(),
});

type RouteParams = {
  params: Promise<{ token: string }>;
};

export async function POST(req: Request, { params }: RouteParams) {
  const { token } = await params;
  const lookup = await getOrderIdForPackAccessToken(token);
  if (!lookup.ok) {
    const status = lookup.error === "invalid" ? 404 : 410;
    return NextResponse.json({ error: "token_invalid" }, { status });
  }

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Sin email real no hay a dónde mandar los digitales: el pack cargado por fuera los pide acá.
  const pack = await prisma.order.findUnique({
    where: { id: lookup.orderId },
    select: { buyerEmail: true, redemptionOrderId: true },
  });
  if (pack && pack.redemptionOrderId == null && isPlaceholderEmail(pack.buyerEmail)) {
    const c = parsed.data.contacto;
    if (!c) {
      return NextResponse.json({ error: "Completá tu nombre, email y WhatsApp." }, { status: 400 });
    }
    const errEmail = getCheckoutEmailValidationError(c.email);
    if (errEmail) return NextResponse.json({ error: errEmail }, { status: 400 });
    if (!isValidPhoneForPurchase(c.telefono)) {
      return NextResponse.json({ error: "Revisá el WhatsApp: tiene que llevar código de área." }, { status: 400 });
    }
    await prisma.order.update({
      where: { id: lookup.orderId },
      data: { buyerEmail: c.email.toLowerCase(), buyerName: c.nombre, buyerPhone: digitsOnly(c.telefono) },
    });
  }

  try {
    const result = await executePreventaPackRedeemV1(lookup.orderId, parsed.data.selections);
    const baseUrl = (process.env.APP_URL || new URL(req.url).origin).replace(/\/+$/, "");
    const { downloadUrl } = await completePreventaRedemption(
      result.redemptionOrderId,
      lookup.orderId,
      baseUrl
    );
    return NextResponse.json(
      { redemptionOrderId: result.redemptionOrderId, downloadUrl },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof PreventaPackRedeemValidationError) {
      return NextResponse.json(
        {
          error: err.message,
          ...(err.code ? { code: err.code } : {}),
        },
        { status: err.httpStatus ?? 400 }
      );
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2034") {
        return NextResponse.json(
          { error: "Conflicto al canjear; reintentá en unos segundos" },
          { status: 409 }
        );
      }
    }
    console.error("POST /api/public/pack/[token]/redeem", err);
    return NextResponse.json({ error: "Error al procesar el canje" }, { status: 500 });
  }
}
