import { NextResponse } from "next/server";
import { prepararFotoAutor } from "@/lib/testimonios/foto";
import {
  FRENO_FOTOS_TESTIMONIO,
  frenadoPorIp,
  MENSAJE_FRENO_TESTIMONIO,
  sitioDelFormulario,
} from "@/lib/testimonios/formulario-publico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ workspaceSlug: string }> };

/**
 * Dónde subir la foto del autor de un testimonio (formulario público, sin sesión). **La foto no pasa
 * por acá**: devuelve una URL firmada de un minuto y el navegador sube directo a R2. Del navegador
 * sólo llegan tipo y peso declarados; el estudio sale del slug y el prefijo lo arma el servidor. Lo
 * que de verdad se subió se verifica al enviar el formulario (`confirmarFotoAutor`).
 *
 * Freno por IP aparte del de los envíos: firmar no crea nada, pero cada URL es un permiso de escritura.
 */
export async function POST(request: Request, { params }: RouteParams) {
  if (await frenadoPorIp("testimonio-foto", FRENO_FOTOS_TESTIMONIO)) {
    return NextResponse.json({ error: MENSAJE_FRENO_TESTIMONIO }, { status: 429 });
  }
  const { workspaceSlug } = await params;
  const body = (await request.json().catch(() => null)) as { tipo?: unknown; bytes?: unknown } | null;
  try {
    const sitio = await sitioDelFormulario(workspaceSlug);
    if (!sitio) return NextResponse.json({ error: "Este formulario no está disponible." }, { status: 404 });
    const r = await prepararFotoAutor(sitio.workspaceId, {
      tipo: typeof body?.tipo === "string" ? body.tipo : "",
      bytes: typeof body?.bytes === "number" ? body.bytes : 0,
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.sinR2 ? 503 : 400 });
    return NextResponse.json(r.valor);
  } catch (err) {
    console.error("[testimonios] no se pudo preparar la subida de la foto", { error: (err as { name?: string })?.name ?? "desconocido" });
    return NextResponse.json({ error: "No pudimos preparar la subida. Podés enviar el testimonio sin foto." }, { status: 500 });
  }
}
