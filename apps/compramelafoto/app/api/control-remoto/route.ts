import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { puedeAdministrarDemos } from "@/lib/demos/identidad";
import { getDemoActiva } from "@/lib/demos/sesion-demo";
import { responderSesionNueva } from "@/lib/control-remoto/rutas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AMBITOS = new Set(["presentacion-escolar", "demo-guia"]);

/**
 * POST /api/control-remoto — abre un control remoto para la presentación o la demo en vivo.
 * Sólo quien ya maneja esas pantallas: el admin de las demos, o una demo activa (que también
 * verifica al admin, ver `getDemoActiva`).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { ambito?: unknown } | null;
  const ambito = typeof body?.ambito === "string" ? body.ambito : "";
  if (!AMBITOS.has(ambito)) return NextResponse.json({ error: "Pantalla desconocida." }, { status: 400 });

  const user = await getAuthUser();
  const autorizado =
    puedeAdministrarDemos(user ? { id: user.id, role: String(user.role) } : null) || Boolean(await getDemoActiva());
  if (!autorizado) return NextResponse.json({ error: "No tenés permiso para manejar esta pantalla." }, { status: 403 });

  return responderSesionNueva(req, ambito, "");
}
