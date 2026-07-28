import { NextResponse } from "next/server";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { AccreditationError } from "@/lib/accreditation/errors";
import { performCheckIn } from "@/lib/accreditation/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ editionId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireClickatonAdmin();
  const { editionId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    registrationId?: string;
    requestId?: string;
    exceptionReason?: string;
    deviceId?: string;
    identityStatus?: "VERIFIED" | "PENDING" | "EXCEPTION_GRANTED";
    lat?: number;
    lng?: number;
    onlineMode?: boolean;
  };

  if (!body.registrationId) {
    return NextResponse.json({ error: "REGISTRATION_REQUIRED" }, { status: 400 });
  }

  try {
    const data = await performCheckIn({
      editionId,
      registrationId: body.registrationId,
      actor: { id: user.id, email: user.email, globalRole: user.globalRole },
      requestId: body.requestId ?? crypto.randomUUID(),
      source: "QR_SCAN",
      exceptionReason: body.exceptionReason ?? null,
      deviceId: body.deviceId ?? null,
      identityStatus: body.identityStatus ?? "VERIFIED",
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      onlineMode: body.onlineMode ?? true,
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AccreditationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    throw error;
  }
}
