import { NextResponse } from "next/server";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { saveParticipantNote } from "@/lib/participant-notes/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ registrationId: string; promptId: string }> };

/**
 * PUT /api/account/registrations/[registrationId]/notes/[promptId]
 *
 * Guarda el texto y/o el check "Ya la tengo". Idempotente: el guardado
 * automático manda la misma nota varias veces y los reintentos de la cola
 * offline repiten el envío.
 */
export async function PUT(req: Request, { params }: Params) {
  const user = await getClickatonAuthUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { registrationId, promptId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    body?: unknown;
    solved?: unknown;
    clientUpdatedAt?: unknown;
  };

  const marca =
    typeof body.clientUpdatedAt === "string" ? new Date(body.clientUpdatedAt) : null;

  const result = await saveParticipantNote({
    registrationId,
    promptId,
    actor: { id: user.id, email: user.email },
    body: typeof body.body === "string" ? body.body : undefined,
    solved: typeof body.solved === "boolean" ? body.solved : undefined,
    clientUpdatedAt: marca && !Number.isNaN(marca.getTime()) ? marca : null,
  });

  if (!result.ok) {
    if (result.reason === "STORAGE_UNAVAILABLE") {
      return NextResponse.json(
        {
          error: "STORAGE_UNAVAILABLE",
          message: "Todavía no podemos guardar tus anotaciones en el servidor.",
        },
        { status: 503 },
      );
    }
    if (result.reason === "CLOSED") {
      return NextResponse.json(
        { error: "CLOSED", message: "La entrega ya cerró: las anotaciones quedaron fijas." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: result.reason }, { status: 404 });
  }

  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
