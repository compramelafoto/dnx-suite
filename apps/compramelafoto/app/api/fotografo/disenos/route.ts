import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { designErrorResponse, requireDesignActor } from "@/lib/design-v2/http";
import { listDesignProjectsForActor } from "@/lib/design-v2/list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/fotografo/disenos — los diseños del fotógrafo (todos, si es admin). */
export async function GET() {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const designs = await listDesignProjectsForActor(prisma, actor);
    return NextResponse.json({ ok: true, designs });
  } catch (err) {
    return designErrorResponse(err, "listar diseños");
  }
}
