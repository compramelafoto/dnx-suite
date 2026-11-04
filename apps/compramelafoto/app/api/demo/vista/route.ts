import { NextRequest, NextResponse } from "next/server";
import { getDemoActiva, cambiarSesionDemo, salirDeDemo } from "@/lib/demos/sesion-demo";
import { destinoDeVista, esVistaDemo, usuarioParaVista } from "@/lib/demos/vistas";
import { getContextoDemoEscolar } from "@/lib/demos/escolar/contexto";
import { asegurarOrganizadorTurismoDemo, getOrganizadorTurismoDemoId } from "@/lib/demos/organizador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/demo/vista — cambia de vista dentro de una demo activa (fotógrafo, familia, colegio,
 * organizador) o sale de la demo. Solo con la cookie de vuelta del admin de demos viva.
 */
export async function POST(req: NextRequest) {
  const demo = await getDemoActiva();
  if (!demo) return NextResponse.json({ error: "No hay una demo activa." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const vista = body?.vista;

  if (vista === "salir") {
    await salirDeDemo();
    return NextResponse.json({ ok: true, destino: "/admin/demos" });
  }
  if (!esVistaDemo(vista)) {
    return NextResponse.json({ error: "Vista inválida." }, { status: 400 });
  }

  const ctx = await getContextoDemoEscolar();
  if (!ctx) return NextResponse.json({ error: "La demo no está preparada." }, { status: 409 });

  let organizadorUserId: number | null = null;
  if (vista === "organizador") {
    // Si la demo se preparó antes de existir esta vista, el organizador se crea acá (idempotente).
    try {
      organizadorUserId = (await getOrganizadorTurismoDemoId()) ?? (await asegurarOrganizadorTurismoDemo());
    } catch (err) {
      console.error("[DEMO] organizador de turismo", err);
      return NextResponse.json({ error: "No se pudo preparar el organizador demo." }, { status: 409 });
    }
  }
  const destinoUserId = usuarioParaVista(vista, { ...ctx, organizadorUserId });
  if (destinoUserId == null) {
    return NextResponse.json({ error: "Falta el usuario de esa vista: tocá «Preparar»." }, { status: 409 });
  }

  try {
    await cambiarSesionDemo(destinoUserId);
  } catch (err) {
    console.error("[DEMO] cambio de vista rechazado", err);
    return NextResponse.json({ error: "No se pudo cambiar de vista." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, destino: destinoDeVista(vista, ctx) });
}
