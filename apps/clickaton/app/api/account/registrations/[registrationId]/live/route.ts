import { NextResponse } from "next/server";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { loadParticipantLiveState } from "@/lib/participant-live/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ registrationId: string }> };

/**
 * GET /api/account/registrations/[registrationId]/live
 *
 * Sondeo liviano desde el teléfono del participante: dice si la acreditación
 * ya quedó registrada (para llevarlo solo a la pantalla de consignas) y cuándo
 * abren las consignas. No devuelve contenido de consignas.
 */
export async function GET(_req: Request, { params }: Params) {
  const user = await getClickatonAuthUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { registrationId } = await params;
  const result = await loadParticipantLiveState({
    registrationId,
    actor: { id: user.id, email: user.email },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 404 });
  }

  return NextResponse.json(result.state, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
