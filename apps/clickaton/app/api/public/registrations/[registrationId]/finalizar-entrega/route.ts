import { NextResponse } from "next/server";

import { getClickatonAuthUser, hasClickatonAdminAccess } from "@/lib/admin/auth";
import {
  FinalizarEntregaError,
  finalizarEntregaDelParticipante,
} from "@/lib/participant-support/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ registrationId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await getClickatonAuthUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { registrationId } = await ctx.params;

  try {
    const data = await finalizarEntregaDelParticipante({
      registrationId,
      actor: {
        actorId: user.id,
        actorEmail: user.email,
        esAdmin: hasClickatonAdminAccess(user),
      },
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof FinalizarEntregaError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}
