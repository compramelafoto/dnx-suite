import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { legacyMigrationStatus, migrateLegacyTemplatesToV2 } from "@/lib/design-v2/migrate-legacy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET — plantillas del diseñador viejo y si ya pasaron al nuevo. */
export async function GET() {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ ok: true, templates: await legacyMigrationStatus() });
}

/** POST — migra las que falten y repunta beneficios y packs. Se puede repetir sin duplicar. */
export async function POST() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  try {
    const results = await migrateLegacyTemplatesToV2(user.id);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[design_v2] migración de plantillas viejas", err);
    return NextResponse.json({ ok: false, error: "La migración falló." }, { status: 500 });
  }
}
