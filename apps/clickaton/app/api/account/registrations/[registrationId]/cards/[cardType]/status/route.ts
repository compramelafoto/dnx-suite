import { getClickatonAuthUser } from "@/lib/admin/auth";
import { runParticipantCardStatusHttp } from "@/lib/participant-cards/participant-card-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ registrationId: string; cardType: string }>;
};

/**
 * GET /api/account/registrations/[registrationId]/cards/[cardType]/status
 */
export async function GET(_req: Request, { params }: Params) {
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
  return runParticipantCardStatusHttp({
    registrationId,
    cardTypeRaw: cardType,
    actor: {
      kind: "participant",
      userId: user.id,
      email: user.email,
      globalRole: user.globalRole,
    },
  });
}
