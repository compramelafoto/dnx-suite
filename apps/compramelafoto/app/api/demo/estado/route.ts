import { NextResponse } from "next/server";
import { getDemoActiva } from "@/lib/demos/sesion-demo";
import { getContextoDemoEscolar } from "@/lib/demos/escolar/contexto";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/demo/estado — si hay una demo activa, el contexto del guion y la sesión actual. */
export async function GET() {
  const demo = await getDemoActiva();
  if (!demo) return NextResponse.json({ activa: false });
  const [ctx, user] = await Promise.all([getContextoDemoEscolar(), getAuthUser()]);
  return NextResponse.json({
    activa: true,
    guion: demo.demo,
    ctx: ctx
      ? {
          albumId: ctx.albumId,
          albumSlug: ctx.albumSlug,
          schoolId: ctx.schoolId,
          handler: ctx.handler,
          ultimoPedidoId: ctx.ultimoPedidoId,
          plantillaId: ctx.plantillaId,
        }
      : null,
    sesion: user ? (String(user.role) === "SCHOOL_ORGANIZER" ? "colegio" : "fotografo") : null,
  });
}
