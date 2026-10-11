import { NextResponse } from "next/server";
import { pedirSubidaDeOriginal } from "@/lib/ventas/autor";
import { getUsuario } from "@/lib/usuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sinCache = { "Cache-Control": "private, no-store" };

/**
 * La URL firmada para subir el original de una obra directo al bucket privado (etapa 8, D15). La
 * arma la acción `pedirSubidaDeOriginal` (sesión, obra propia y vendible, tipo y tamaño); acá sólo
 * se exige la sesión y que el pedido venga del mismo sitio.
 */
export async function POST(req: Request) {
  const origen = req.headers.get("origin");
  if (origen && origen !== new URL(req.url).origin) return NextResponse.json({ error: "Pedido inválido." }, { status: 403, headers: sinCache });
  if (!(await getUsuario())) return NextResponse.json({ error: "Tenés que ingresar." }, { status: 401, headers: sinCache });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers: sinCache });
  }
  const activityWorkId = form.get("activityWorkId");
  const mime = form.get("mime");
  const bytes = Number(form.get("bytes"));
  if (typeof activityWorkId !== "string" || typeof mime !== "string") return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers: sinCache });
  const r = await pedirSubidaDeOriginal(activityWorkId, { mime, bytes });
  if (!r.ok) return NextResponse.json({ error: r.errores[0] }, { status: 400, headers: sinCache });
  return NextResponse.json({ url: r.url, clave: r.clave }, { headers: sinCache });
}
