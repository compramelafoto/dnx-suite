import { NextResponse, type NextRequest } from "next/server";
import { requireWebsiteContext } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { csvDeEnvios, csvDeSuscriptores, nombreDeArchivoCsv } from "@/lib/website/formularios-csv";
import { enviosParaExportar, esTablaFaltante, nombreDelFormulario, suscriptoresParaExportar } from "@/lib/website/formularios.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CSV de Sitio web → Formularios: `?formulario=<id>` (un formulario), `?formulario=todos`, o
 * `?tipo=suscriptores`. Mismo permiso que la bandeja (editar el sitio); el workspace sale de la
 * sesión. Lleva datos personales: sin caché.
 */
export async function GET(req: NextRequest) {
  const { workspace, user } = await requireWebsiteContext();
  if (!(await hasModuleLevel(user.id, workspace.id, WEBSITE_MODULE_KEY, "MANAGE"))) {
    return new NextResponse("No tenés permiso para exportar los formularios del sitio.", { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  let csv: string;
  let archivo: string;
  try {
    if (params.get("tipo") === "suscriptores") {
      csv = csvDeSuscriptores(await suscriptoresParaExportar(workspace.id));
      archivo = nombreDeArchivoCsv("suscriptores", "");
    } else {
      const pedido = params.get("formulario") ?? "todos";
      if (pedido === "todos") {
        csv = csvDeEnvios(await enviosParaExportar(workspace.id, null));
        archivo = nombreDeArchivoCsv("formularios", "todos");
      } else {
        if (!/^[a-z0-9]{8,40}$/i.test(pedido)) return new NextResponse("Formulario inválido.", { status: 400 });
        const nombre = await nombreDelFormulario(workspace.id, pedido);
        if (nombre === null) return new NextResponse("No encontramos ese formulario.", { status: 404 });
        csv = csvDeEnvios(await enviosParaExportar(workspace.id, pedido));
        archivo = nombreDeArchivoCsv("formulario", nombre);
      }
    }
  } catch (err) {
    if (esTablaFaltante(err)) return new NextResponse("Faltan las tablas de formularios en la base.", { status: 503 });
    throw err;
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // `archivo` sólo tiene [a-z0-9-] (ver `nombreDeArchivoCsv`): no puede inyectar cabeceras.
      "Content-Disposition": `attachment; filename="${archivo}"`,
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
