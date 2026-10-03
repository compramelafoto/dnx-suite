/**
 * Vista previa del diploma: el admin la mira antes de largar el lote.
 *
 * Toma el primer acreditado (por fecha de acreditación) de la edición y
 * llama a `renderDiplomaPreview`, que dibuja sin persistir — ni la pieza
 * (`ClickatonParticipantCard`) ni el emisor (`ClickatonDiplomaIssue`). No
 * gasta un código ni un token de verdad.
 */
import { hasClickatonAdminAccess } from "@/lib/admin/access";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { DIPLOMA_CANDIDATE_QUERY, selectDiplomaCandidates } from "@/lib/diplomas/diploma-eligibility";
import { renderDiplomaPreview } from "@/lib/diplomas/diploma-service";
import { DIPLOMA_ERROR_MESSAGES } from "@/lib/diplomas/diploma-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ editionId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getClickatonAuthUser();
  if (!user) {
    return Response.json(
      { ok: false, error: "No autenticado", code: "CLICKATON_CARD_UNAUTHORIZED" },
      { status: 401 },
    );
  }
  if (!hasClickatonAdminAccess({ email: user.email, globalRole: user.globalRole })) {
    return Response.json(
      { ok: false, error: "Sin permisos administrativos", code: "CLICKATON_CARD_FORBIDDEN" },
      { status: 403 },
    );
  }

  const { editionId } = await params;

  const rows = await prisma.clickatonRegistration.findMany({
    where: { editionId },
    ...DIPLOMA_CANDIDATE_QUERY,
  });
  const candidates = selectDiplomaCandidates(rows).sort(
    (a, b) => a.accreditedAt.getTime() - b.accreditedAt.getTime(),
  );
  const sample = candidates[0];
  if (!sample) {
    return Response.json(
      {
        ok: false,
        error: "Todavía no hay nadie acreditado en esta edición para mostrar un ejemplo.",
      },
      { status: 404 },
    );
  }

  const preview = await renderDiplomaPreview({
    registrationId: sample.registrationId,
    actor: { kind: "admin", userId: user.id, email: user.email, globalRole: user.globalRole },
  });

  if (!preview.ok) {
    return Response.json(
      { ok: false, error: DIPLOMA_ERROR_MESSAGES[preview.code], code: preview.code },
      { status: 422 },
    );
  }

  return new Response(new Uint8Array(preview.png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
