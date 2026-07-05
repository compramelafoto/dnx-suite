import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { isLikelyValidEmail, normalizeEmail } from "@/lib/email-validation";
import {
  CC_FOTOOFFICE_INTEREST_SUCCESS_MESSAGE,
  FOTOOFFICE_INTEREST_SOURCE_CUANTO_COBRO_RESULT,
  FOTOOFFICE_INTEREST_TYPE_NEWS_AND_ADVICE,
  registerFotoOfficeInterest,
  sanitizeInterestString,
  type FotoOfficeInterestMetadataInput,
} from "@/lib/cuantocobro/fotooffice-interest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostBody = {
  email?: unknown;
  name?: unknown;
  metadata?: unknown;
};

function isMetadataBody(value: unknown): value is FotoOfficeInterestMetadataInput {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** POST /api/cuantocobro/fotooffice-interest — registra interés en FotoOffice. */
export async function POST(request: Request) {
  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const authUser = await getAuthUser();
  const bodyEmail = sanitizeInterestString(body.email, 200);
  const normalizedBodyEmail = bodyEmail ? normalizeEmail(bodyEmail) : null;
  const email =
    authUser?.email ??
    (normalizedBodyEmail && isLikelyValidEmail(normalizedBodyEmail) ? normalizedBodyEmail : null);

  if (!authUser && !email) {
    return NextResponse.json(
      { error: "Necesitamos un email para avisarte sobre FotoOffice." },
      { status: 400 },
    );
  }

  const bodyName = sanitizeInterestString(body.name, 120);
  const name = authUser?.name ?? bodyName;

  try {
    const result = await registerFotoOfficeInterest({
      userId: authUser?.id ?? null,
      email,
      name,
      source: FOTOOFFICE_INTEREST_SOURCE_CUANTO_COBRO_RESULT,
      interestType: FOTOOFFICE_INTEREST_TYPE_NEWS_AND_ADVICE,
      metadata: isMetadataBody(body.metadata) ? body.metadata : null,
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      message: CC_FOTOOFFICE_INTEREST_SUCCESS_MESSAGE,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_REQUIRED") {
      return NextResponse.json(
        { error: "Necesitamos un email para avisarte sobre FotoOffice." },
        { status: 400 },
      );
    }

    console.error("POST /api/cuantocobro/fotooffice-interest", error);
    return NextResponse.json(
      { error: "No pudimos registrar tu interés. Intentá de nuevo en unos minutos." },
      { status: 500 },
    );
  }
}
