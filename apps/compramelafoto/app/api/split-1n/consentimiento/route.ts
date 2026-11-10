import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { resolveConsentimientoConfig } from "@/lib/split-1n-consentimiento/config";
import { crearDepsConsentimiento } from "@/lib/split-1n-consentimiento/deps";
import { actualizarEstado, pedirInvitacion } from "@/lib/split-1n-consentimiento/servicio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quienes pueden cobrar una parte de una venta: fotógrafos, organizadores (y sus referidores). */
const ROLES = [
  Role.PHOTOGRAPHER,
  Role.LAB_PHOTOGRAPHER,
  Role.ORGANIZER,
  Role.SCHOOL_ORGANIZER,
  Role.ADMIN,
  Role.SUPER_ADMIN,
];

const NO_DISPONIBLE = "El cobro dividido no está disponible en este momento. Probá más tarde.";

/** Si el interruptor está apagado, la ruta no existe (y el panel no muestra la tarjeta). */
function apagado() {
  return NextResponse.json({ error: "No disponible" }, { status: 404 });
}

function deps() {
  try {
    return crearDepsConsentimiento();
  } catch (err: unknown) {
    console.error("[split-1n-consentimiento] sin_configuracion", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Estado del consentimiento de quien está en el panel. `?refrescar=1` consulta a Mercado Pago. */
export async function GET(req: Request) {
  if (!resolveConsentimientoConfig().enabled) return apagado();
  const { error, user } = await requireAuth(ROLES);
  if (error || !user) return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  const d = deps();
  if (!d) return NextResponse.json({ error: NO_DISPONIBLE }, { status: 503 });

  const refrescar = new URL(req.url).searchParams.get("refrescar") === "1";
  const vista = await actualizarEstado(d, { userId: user.id, forzar: refrescar });
  return NextResponse.json({ ...vista, correoSugerido: user.email ?? null });
}

/** Pide (o vuelve a pedir) la invitación de Mercado Pago para el correo indicado. */
export async function POST(req: Request) {
  if (!resolveConsentimientoConfig().enabled) return apagado();
  const { error, user } = await requireAuth(ROLES);
  if (error || !user) return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  const d = deps();
  if (!d) return NextResponse.json({ error: NO_DISPONIBLE }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { correo?: unknown };
  const correo = typeof body.correo === "string" ? body.correo : "";
  const cuenta = await prisma.user.findUnique({ where: { id: user.id }, select: { mpUserId: true } });
  const r = await pedirInvitacion(d, { userId: user.id, correo, mpUserId: cuenta?.mpUserId ?? null });
  if (!r.ok) return NextResponse.json({ error: r.mensaje, code: r.codigo }, { status: 400 });
  return NextResponse.json(r.vista);
}
