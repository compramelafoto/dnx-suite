import { NextResponse } from "next/server";
import { contextoDeGalerias } from "@/lib/galerias/contexto";
import { confirmarFoto } from "@/lib/galerias/fotos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Procesar una foto (leer, dos derivadas, dos subidas) entra de sobra en un minuto. */
export const maxDuration = 60;

/**
 * Confirma que el navegador subió el original y lo procesa (vista y miniatura). Una foto por
 * llamada. Antes de tocar nada: sesión, workspace, módulo `gallery` encendido y permiso de
 * Gestionar (null = 403 sin decir el motivo); después la foto tiene que ser de una galería de ese
 * workspace. Cuerpo: `{ "fotoId": "..." }` en JSON.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoDeGalerias("operar");
  if (!ctx) return NextResponse.json({ error: "No tenés permiso para hacer esto." }, { status: 403 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Los datos no son válidos." }, { status: 415 });
  }
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Los datos no son válidos." }, { status: 400 });
  }
  const fotoId = cuerpo && typeof cuerpo === "object" ? (cuerpo as { fotoId?: unknown }).fotoId : undefined;
  const { id } = await params;
  const r = await confirmarFoto(ctx, id, fotoId);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 422 });
  return NextResponse.json({ ok: true });
}
