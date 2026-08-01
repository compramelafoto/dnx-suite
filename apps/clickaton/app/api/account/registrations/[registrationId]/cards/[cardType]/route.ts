import { getClickatonAuthUser } from "@/lib/admin/auth";
import { runParticipantCardHttp } from "@/lib/participant-cards/participant-card-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = {
  params: Promise<{ registrationId: string; cardType: string }>;
};

/**
 * GET /api/account/registrations/[registrationId]/cards/[cardType]
 * cardType: welcome | member
 * Requiere sesión + ownership. PNG get-or-generate con persistencia.
 */
export async function GET(req: Request, { params }: Params) {
  const user = await getClickatonAuthUser();
  if (!user) {
    return Response.json(
      {
        ok: false,
        error: "No autenticado",
        code: "CLICKATON_CARD_UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  const { registrationId, cardType } = await params;
  return runParticipantCardHttp({
    registrationId,
    cardTypeRaw: cardType,
    actor: {
      kind: "participant",
      userId: user.id,
      email: user.email,
      globalRole: user.globalRole,
    },
    req,
    defaultMode: "final",
    defaultDisposition: "attachment",
  });
}
