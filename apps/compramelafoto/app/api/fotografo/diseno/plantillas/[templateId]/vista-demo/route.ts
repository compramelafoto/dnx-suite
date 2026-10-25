import { NextResponse } from "next/server";
import { toDesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { archivosDeDemoSubidos, urlPublicaDeDemo } from "@/lib/design-v2/demo-archivos";
import {
  RETRATOS_DE_COMPANEROS,
  archivosNecesarios,
  demoDePlantilla,
  fotosDeDemoPorBloque,
  huecosDeDemo,
} from "@/lib/design-v2/demo-de-plantilla";
import { valoresDeDemo } from "@/lib/design-v2/demo-valores";
import { designErrorResponse, requireDesignActor } from "@/lib/design-v2/http";
import { loadTemplateForSandbox } from "@/lib/design-v2/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

/**
 * GET — la plantilla «terminada» con datos de demo, para verla en 3D desde el catálogo: los
 * textos (alumno, curso, colegio, compañeros) y, por cada hueco de foto, la foto de demo que le
 * toca si ya está subida o la de muestra si no.
 */
export async function GET(_req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const template = await loadTemplateForSandbox((await context.params).templateId, actor);
    const demo = demoDePlantilla({ templateId: template.templateId, meta: template.legacy.meta });
    const huecos = huecosDeDemo(template.legacy.blocks);
    const subidos = await archivosDeDemoSubidos([...archivosNecesarios(demo, huecos), ...RETRATOS_DE_COMPANEROS]);
    // (Los retratos de los compañeros son para el mosaico del curso; sin mosaico no se usan.)
    const urlSiEsta = (archivo: string) => (subidos[archivo] ? urlPublicaDeDemo(archivo) : null);
    return NextResponse.json({
      ok: true,
      template: toDesignTemplatePayload(template),
      values: valoresDeDemo(demo, urlSiEsta(demo.archivos.logo), urlSiEsta),
      fotos: fotosDeDemoPorBloque(huecos, demo, urlSiEsta),
    });
  } catch (err) {
    return designErrorResponse(err, "vista demo de plantilla");
  }
}
