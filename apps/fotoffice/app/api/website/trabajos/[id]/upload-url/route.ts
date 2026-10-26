import { NextResponse } from "next/server";
import { requireBlogEditorApi } from "@/lib/blog/access";
import { AVISO_TABLAS_FALTANTES, esTablaFaltante } from "@/lib/trabajos/reglas";
import { prepararSubida, type ArchivoAPreparar } from "@/lib/trabajos/subida";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/** Tanda máxima por pedido: las URLs vencen al minuto si la subida no empezó. */
const MAX_POR_PEDIDO = 20;

/**
 * Dónde subir fotos a un trabajo. **Los archivos no pasan por acá**: devuelve una URL firmada por
 * archivo y el navegador sube directo a R2 (ver `lib/trabajos/subida.ts`). Del navegador sólo
 * llegan nombre, tipo y peso declarados; la institución sale de la sesión y el prefijo lo arma el
 * servidor. Lo que de verdad se subió se verifica después, al confirmar.
 *
 * Mismo guardián que el blog: sólo quien edita el sitio.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;
  const trabajoId = (await params).id;

  const body = (await request.json().catch(() => null)) as { archivos?: unknown } | null;
  const crudos = Array.isArray(body?.archivos) ? body.archivos : [];
  if (crudos.length === 0) return NextResponse.json({ error: "Elegí al menos una foto." }, { status: 400 });
  if (crudos.length > MAX_POR_PEDIDO) {
    return NextResponse.json({ error: `Se preparan hasta ${MAX_POR_PEDIDO} fotos por vez.` }, { status: 400 });
  }
  const archivos: ArchivoAPreparar[] = crudos.map((a) => {
    const x = (a ?? {}) as Record<string, unknown>;
    return {
      nombre: typeof x.nombre === "string" && x.nombre.trim() ? x.nombre.trim().slice(0, 200) : "foto.jpg",
      tipo: typeof x.tipo === "string" ? x.tipo : "",
      bytes: typeof x.bytes === "number" ? x.bytes : 0,
    };
  });

  try {
    const r = await prepararSubida(ctx.workspace.id, trabajoId, archivos);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "El trabajo no existe" ? 404 : 400 });
    return NextResponse.json({ subidas: r.valor });
  } catch (err) {
    if (esTablaFaltante(err)) {
      return NextResponse.json({ error: AVISO_TABLAS_FALTANTES }, { status: 503 });
    }
    console.error("[fotoffice][trabajos] no se pudo preparar la subida:", err);
    return NextResponse.json({ error: "No pudimos preparar la subida. Probá de nuevo." }, { status: 500 });
  }
}
