import { NextResponse } from "next/server";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { AccreditationError } from "@/lib/accreditation/errors";
import { deliverKitItem } from "@/lib/accreditation/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ editionId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireClickatonAdmin();
  const { editionId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    registrationId?: string;
    itemId?: string;
    notes?: string;
    deviceId?: string;
  };

  if (!body.registrationId || !body.itemId) {
    return NextResponse.json({ error: "ITEM_REQUIRED" }, { status: 400 });
  }

  try {
    const data = await deliverKitItem({
      editionId,
      registrationId: body.registrationId,
      itemId: body.itemId,
      actor: { id: user.id, email: user.email, globalRole: user.globalRole },
      notes: body.notes ?? null,
      deviceId: body.deviceId ?? null,
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AccreditationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    throw error;
  }
}
