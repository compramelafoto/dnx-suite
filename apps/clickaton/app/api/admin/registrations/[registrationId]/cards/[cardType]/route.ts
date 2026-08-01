import { getClickatonAuthUser } from "@/lib/admin/auth";
import { hasClickatonAdminAccess } from "@/lib/admin/access";
import { runParticipantCardHttp } from "@/lib/participant-cards/participant-card-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = {
  params: Promise<{ registrationId: string; cardType: string }>;
};

/**
 * GET /api/admin/registrations/[registrationId]/cards/[cardType]
 * Preview/descarga/diagnóstico admin. Accept: application/json → diagnóstico.
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

  if (
    !hasClickatonAdminAccess({
      email: user.email,
      globalRole: user.globalRole,
    })
  ) {
    return Response.json(
      {
        ok: false,
        error: "Sin permisos administrativos",
        code: "CLICKATON_CARD_FORBIDDEN",
      },
      { status: 403 }
    );
  }

  const { registrationId, cardType } = await params;
  return runParticipantCardHttp({
    registrationId,
    cardTypeRaw: cardType,
    actor: {
      kind: "admin",
      userId: user.id,
      email: user.email,
      globalRole: user.globalRole,
    },
    req,
    defaultMode: "preview",
    defaultDisposition: "inline",
  });
}
