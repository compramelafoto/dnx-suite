import { NextResponse } from "next/server";
import { prepararSubidaDeVideo } from "@/app/actions/course-lessons";
import { explicarConfiguracionFaltante, readStreamConfig } from "@/lib/courses-video/config";
import { StreamError } from "@/lib/courses-video/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dónde subir el video de una clase.
 *
 * **El archivo no pasa por acá.** Esta ruta sólo devuelve una URL de un solo uso contra la
 * que el navegador sube directo: las funciones de Vercel rechazan cualquier pedido de más de
 * 4,5 MB con `413 FUNCTION_PAYLOAD_TOO_LARGE`, y un video de una clase pesa cientos de megas.
 *
 * Si falta configurar el proveedor responde 503 y dice qué falta, en vez de fallar con un
 * error que no se entiende: el resto del módulo sigue funcionando igual.
 */
export async function POST(req: Request) {
  const configuracion = readStreamConfig();
  if (!configuracion.ok) {
    return NextResponse.json(
      {
        error: explicarConfiguracionFaltante(configuracion.missing),
        missing: configuracion.missing,
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { lessonId?: string };
  const lessonId = body.lessonId?.trim();
  if (!lessonId) {
    return NextResponse.json({ error: "Falta indicar la clase." }, { status: 400 });
  }

  try {
    const resultado = await prepararSubidaDeVideo(lessonId);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: 400 });
    }
    return NextResponse.json({ uploadUrl: resultado.uploadUrl }, { status: 200 });
  } catch (error) {
    if (error instanceof StreamError) {
      console.error("[fotoffice_courses] stream_upload_error", { status: error.status });
      return NextResponse.json(
        { error: "El proveedor de video no aceptó la subida. Probá de nuevo en unos minutos." },
        { status: 502 },
      );
    }
    const mensaje = error instanceof Error ? error.message : "No se pudo preparar la subida.";
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}
