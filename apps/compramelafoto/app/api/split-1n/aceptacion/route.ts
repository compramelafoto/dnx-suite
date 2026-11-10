import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { resolveAceptacionConfig } from "@/lib/split-1n-aceptacion/config";
import { ROLES_ACEPTACION } from "@/lib/split-1n-aceptacion/regla";
import { decisionPara, registrarAceptacionAnexo } from "@/lib/split-1n-aceptacion/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function correspondeRol(role: string): boolean {
  return (ROLES_ACEPTACION as readonly string[]).includes(role);
}

/** ¿Hay que mostrar el cartel del cobro dividido? Sin sesión o con la función apagada: no. */
export async function GET() {
  if (!resolveAceptacionConfig().enabled) return NextResponse.json({ mostrar: false });
  const user = await getAuthUser();
  if (!user || !correspondeRol(user.role)) return NextResponse.json({ mostrar: false });
  return NextResponse.json(await decisionPara(user));
}

/** Acepta el anexo de los términos (el paso de Mercado Pago se hace aparte). */
export async function POST(req: Request) {
  if (!resolveAceptacionConfig().enabled) return NextResponse.json({ error: "No disponible" }, { status: 404 });
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!correspondeRol(user.role)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { acepto?: unknown };
  if (body.acepto !== true) {
    return NextResponse.json({ error: "Tenés que marcar que aceptás el anexo." }, { status: 400 });
  }
  try {
    await registrarAceptacionAnexo({
      userId: user.id,
      role: user.role as Role,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent"),
    });
  } catch (err: unknown) {
    console.error("[split-1n-aceptacion] aceptar_fallido", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "No pudimos guardar tu aceptación. Probá de nuevo en unos minutos." }, { status: 500 });
  }
  return NextResponse.json(await decisionPara(user));
}
