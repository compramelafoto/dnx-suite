import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  getFinancialProfileByUserId,
  upsertFinancialProfile,
} from "@/lib/cuantocobro/financial-profile-db";
import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

type PutBody = {
  profile?: unknown;
};

function isProfileBody(value: unknown): value is CuantoCobroProfileInput {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** GET /api/cuantocobro/profile — perfil financiero del usuario autenticado. */
export async function GET() {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const profile = await getFinancialProfileByUserId(user.id);

  return NextResponse.json({ profile });
}

/** PUT /api/cuantocobro/profile — guarda el perfil financiero del usuario autenticado. */
export async function PUT(request: Request) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isProfileBody(body.profile)) {
    return NextResponse.json({ error: "profile requerido" }, { status: 400 });
  }

  const profile = await upsertFinancialProfile(user.id, body.profile);

  return NextResponse.json({ ok: true, profile });
}
