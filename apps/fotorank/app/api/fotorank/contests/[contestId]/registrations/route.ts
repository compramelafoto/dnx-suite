import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../lib/auth";
import {
  RegistrationError,
  createContestRegistration,
} from "../../../../../lib/fotorank/registration";

type Ctx = { params: Promise<{ contestId: string }> };

function clientMeta(req: Request): { ip: string | null; ua: string | null } {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const ua = req.headers.get("user-agent");
  return { ip, ua };
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }

  const { contestId } = await ctx.params;
  let body: {
    categoryId?: string;
    rulesVersionId?: string;
    rulesAccepted?: boolean;
    licenseAccepted?: boolean;
    declaredAgeYears?: number;
    promotionalOptIn?: boolean;
    argraMembershipNumber?: string;
    minorAuthorization?: {
      guardianName?: string;
      relationship?: string;
      declarationAccepted?: boolean;
    };
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_BODY", message: "JSON inválido." } }, { status: 400 });
  }

  const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
  const rulesVersionId = typeof body.rulesVersionId === "string" ? body.rulesVersionId.trim() : "";
  const rulesAccepted = body.rulesAccepted === true;
  const licenseAccepted = body.licenseAccepted === true;

  if (!categoryId || !rulesVersionId) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "categoryId y rulesVersionId son obligatorios." } },
      { status: 400 },
    );
  }

  const { ip, ua } = clientMeta(req);

  try {
    const result = await createContestRegistration({
      contestId,
      participantUserId: user.id,
      categoryId,
      rulesVersionId,
      rulesAccepted,
      licenseAccepted,
      declaredAgeYears:
        typeof body.declaredAgeYears === "number" && Number.isFinite(body.declaredAgeYears)
          ? Math.floor(body.declaredAgeYears)
          : null,
      promotionalOptIn: body.promotionalOptIn === true,
      argraMembershipNumber:
        typeof body.argraMembershipNumber === "string" ? body.argraMembershipNumber : null,
      minorAuthorization: body.minorAuthorization?.declarationAccepted
        ? {
            guardianName: String(body.minorAuthorization.guardianName ?? ""),
            relationship: String(body.minorAuthorization.relationship ?? ""),
            declarationAccepted: true,
          }
        : null,
      rulesAcceptanceIp: ip,
      rulesAcceptanceUserAgent: ua,
    });

    return NextResponse.json(
      {
        ok: true,
        created: result.created,
        idempotentReplay: result.idempotentReplay,
        registration: {
          id: result.registration.id,
          status: result.registration.status,
          paymentStatus: result.registration.paymentStatus,
          registrationNumber: result.registration.registrationNumber,
          categoryId: result.registration.categoryId,
          categoryName: result.registration.categoryName,
          paymentModeSnapshot: result.registration.paymentModeSnapshot,
          registrationPriceSnapshot: result.registration.registrationPriceSnapshot,
          currencySnapshot: result.registration.currencySnapshot,
          platformFeeBpsSnapshot: result.registration.platformFeeBpsSnapshot,
          paymentRequired: result.registration.paymentRequired,
          checkoutUrl: result.registration.checkoutUrl,
          photoUploadStatus: result.registration.photoUploadStatus,
          confirmedAt: result.registration.confirmedAt?.toISOString() ?? null,
        },
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    console.error("[fotorank registrations POST]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo crear la inscripción." } },
      { status: 500 },
    );
  }
}
