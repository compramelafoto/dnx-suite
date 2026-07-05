import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/lib/prisma";
import {
  executePreventaPackRedeemV1,
  PreventaPackRedeemValidationError,
} from "@/lib/preventa-canjeable/redeem-preventa-pack-order-v1";
import { getOrderIdForPackAccessToken } from "@/lib/preventa-canjeable/pack-access-tokens";

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
});

type RouteParams = {
  params: { token: string } | Promise<{ token: string }>;
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

  try {
    const result = await executePreventaPackRedeemV1(lookup.orderId, parsed.data.selections);
    return NextResponse.json({ redemptionOrderId: result.redemptionOrderId }, { status: 201 });
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
