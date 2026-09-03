import { NextResponse } from "next/server";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { listParticipantNotes } from "@/lib/participant-notes/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ registrationId: string }> };

/**
 * GET /api/account/registrations/[registrationId]/notes
 *
 * Todas las anotaciones de esa inscripción, para hidratar la pantalla al abrir.
 * Solo las devuelve al dueño de la inscripción.
 */
export async function GET(_req: Request, { params }: Params) {
  const user = await getClickatonAuthUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { registrationId } = await params;
  const result = await listParticipantNotes({
    registrationId,
    actor: { id: user.id, email: user.email },
  });

  if (!result.ok) {
    // Sin tabla todavía: la pantalla sigue con lo guardado en el dispositivo.
    if (result.reason === "STORAGE_UNAVAILABLE") {
      return NextResponse.json(
        { notes: [], storage: "unavailable" },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }
    return NextResponse.json({ error: result.reason }, { status: 404 });
  }

  return NextResponse.json(
    { notes: result.data, storage: "ok" },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
