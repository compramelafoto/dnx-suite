import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { puedeAdministrarDemos } from "@/lib/demos/identidad";
import { prepararDemoEscolar } from "@/lib/demos/escolar/preparar";
import { reiniciarDemoEscolar } from "@/lib/demos/escolar/reiniciar";
import { getContextoDemoEscolar } from "@/lib/demos/escolar/contexto";
import { entrarADemo } from "@/lib/demos/sesion-demo";
import { runAnalysisPipeline } from "@/lib/analysis/analysis-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ accion: string }> };

/** POST /api/admin/demos/escolar/{preparar|reiniciar|analizar|entrar} — solo el admin de demos. */
export async function POST(req: NextRequest, context: Ctx) {
  const user = await getAuthUser();
  if (!puedeAdministrarDemos(user ? { id: user.id, role: String(user.role) } : null)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { accion } = await context.params;

  try {
    if (accion === "preparar") {
      const resumen = await prepararDemoEscolar({ origen: req.nextUrl.origin, presupuestoFotosMs: 200_000 });
      return NextResponse.json({ ok: true, resumen });
    }
    if (accion === "reiniciar") {
      return NextResponse.json({ ok: true, resumen: await reiniciarDemoEscolar() });
    }

    const ctx = await getContextoDemoEscolar();
    if (!ctx) return NextResponse.json({ error: "Primero tocá «Preparar»." }, { status: 409 });

    if (accion === "analizar") {
      const res = await runAnalysisPipeline({
        ocrRequested: false,
        debug: false,
        source: "admin",
        albumId: ctx.albumId,
        maxRunMs: 240_000,
      });
      return NextResponse.json({ ok: true, resultado: await res.json().catch(() => null) });
    }
    if (accion === "entrar") {
      await entrarADemo(ctx.fotografoId);
      return NextResponse.json({ ok: true, destino: "/fotografo/escuelas" });
    }
    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (err) {
    console.error(`[DEMO] ${accion} falló`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error en la demo" },
      { status: 500 },
    );
  }
}
