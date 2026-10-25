import { NextResponse } from "next/server";
import { getDemoActiva } from "@/lib/demos/sesion-demo";
import { getContextoDemoEscolar } from "@/lib/demos/escolar/contexto";
import { publicarFotosDeLaToma } from "@/lib/demos/escolar/fotos-toma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/demo/fotos — publica las fotos de la toma de la demo y las analiza. Solo con demo activa. */
export async function POST() {
  if (!(await getDemoActiva())) {
    return NextResponse.json({ error: "No hay una demo activa." }, { status: 403 });
  }
  const ctx = await getContextoDemoEscolar();
  if (!ctx) return NextResponse.json({ error: "La demo no está preparada." }, { status: 409 });
  const resultado = await publicarFotosDeLaToma(ctx.albumId);
  return NextResponse.json({ ok: true, ...resultado });
}
