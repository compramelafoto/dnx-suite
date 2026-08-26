import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import { RegistrationError } from "../../../../../../lib/fotorank/registration";
import {
  acceptCurrentPublishedRules,
  getRulesReacceptanceStatus,
} from "../../../../../../lib/fotorank/registration/rules-reacceptance";

type Ctx = { params: Promise<{ contestId: string }> };

function clientMeta(req: Request): { ip: string | null; ua: string | null } {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const ua = req.headers.get("user-agent");
  return { ip, ua };
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } },
      { status: 401 },
    );
  }
  const { contestId } = await ctx.params;
  const status = await getRulesReacceptanceStatus({
    contestId,
    participantUserId: user.id,
  });
  if (!status) {
    return NextResponse.json(
      { error: { code: "REGISTRATION_NOT_FOUND", message: "Inscripción no encontrada." } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: status });
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } },
      { status: 401 },
    );
  }

  const { contestId } = await ctx.params;
  let body: {
    rulesVersionId?: string;
    rulesAccepted?: boolean;
    licenseAccepted?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "JSON inválido." } },
      { status: 400 },
    );
  }

  const rulesVersionId = typeof body.rulesVersionId === "string" ? body.rulesVersionId.trim() : "";
  if (!rulesVersionId) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "rulesVersionId es obligatorio." } },
      { status: 400 },
    );
  }

  const { ip, ua } = clientMeta(req);

  try {
    const result = await acceptCurrentPublishedRules({
      contestId,
      participantUserId: user.id,
      rulesVersionId,
      rulesAccepted: body.rulesAccepted === true,
      licenseAccepted: body.licenseAccepted === true,
      acceptanceIp: ip,
      acceptanceUserAgent: ua,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    throw err;
  }
}
