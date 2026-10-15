import { NextResponse } from "next/server";
import { toDesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { hayArchivoDeDemo, urlPublicaDeDemo } from "@/lib/design-v2/demo-archivos";
import { demoDePlantilla } from "@/lib/design-v2/demo-de-plantilla";
import { valoresDeDemo } from "@/lib/design-v2/demo-valores";
import { designErrorResponse, requireDesignActor } from "@/lib/design-v2/http";
import { loadTemplateForSandbox } from "@/lib/design-v2/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

/**
 * GET — la plantilla «terminada» con datos de demo, para verla en 3D desde el catálogo: los
 * textos (alumno, curso, colegio, compañeros) y las fotos de demo que ya estén subidas. La que
 * falte va como `null` y la pantalla pone la foto de muestra.
 */
export async function GET(_req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const template = await loadTemplateForSandbox((await context.params).templateId, actor);
    const demo = demoDePlantilla({ templateId: template.templateId, meta: template.legacy.meta });
    const [hayRetrato, hayGrupal, hayLogo] = await Promise.all([
      hayArchivoDeDemo(demo.archivos.retrato),
      hayArchivoDeDemo(demo.archivos.grupal),
      hayArchivoDeDemo(demo.archivos.logo),
    ]);
    const logo = hayLogo ? urlPublicaDeDemo(demo.archivos.logo) : null;
    return NextResponse.json({
      ok: true,
      template: toDesignTemplatePayload(template),
      values: valoresDeDemo(demo, logo),
      fotos: {
        retrato: hayRetrato ? urlPublicaDeDemo(demo.archivos.retrato) : null,
        grupal: hayGrupal ? urlPublicaDeDemo(demo.archivos.grupal) : null,
      },
    });
  } catch (err) {
    return designErrorResponse(err, "vista demo de plantilla");
  }
}
