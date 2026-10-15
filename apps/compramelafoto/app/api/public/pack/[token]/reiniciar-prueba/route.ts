import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { reiniciarPackDePrueba } from "@/lib/canje-externo/reiniciar-pack-de-prueba";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deja listo otra vez un pack de prueba ya canjeado (ver `reiniciarPackDePrueba`). */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const viewer = await getAuthUser().catch(() => null);
  if (!viewer) return NextResponse.json({ error: "Iniciá sesión con tu cuenta." }, { status: 401 });
  const r = await reiniciarPackDePrueba(token, viewer);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
