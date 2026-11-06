import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { archivosDeDemoSubidos, urlPublicaDeDemo } from "@/lib/design-v2/demo-archivos";
import { archivosNecesarios, demoDePlantilla, fotosDeDemoPorBloque, huecosDeDemo } from "@/lib/design-v2/demo-de-plantilla";
import { valoresDeDemo } from "@/lib/design-v2/demo-valores";
import { loadDesignTemplateVersion } from "@/lib/design-v2/template";
import { gateTestAlbumPublicAccess } from "@/lib/public-album-test-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; packId: string }> };

/** «7° grado» + «A» → «7° grado A». */
function nombreDelCurso(c: { name: string; division: string | null }): string {
  return [c.name, c.division].filter((x) => x && x.trim()).join(" ").trim();
}

/**
 * GET — el diseño de un pack de preventa (librito, carpeta…) «terminado», para que la familia lo
 * vea en 3D antes de comprar: con el logo y el nombre real del colegio, el primer curso del álbum
 * y fotos y nombres de ejemplo (nunca fotos del álbum). Es la misma vista que «Ver en 3D» del
 * catálogo de plantillas del fotógrafo, pero pública y atada a un pack vigente.
 */
export async function GET(_req: Request, context: Ctx) {
  const { slug, packId: rawPackId } = await context.params;
  const packId = Number(rawPackId);
  if (!slug?.trim() || !Number.isInteger(packId) || packId <= 0) {
    return NextResponse.json({ ok: false, error: "Pack inválido." }, { status: 400 });
  }
  try {
    const album = await prisma.album.findFirst({
      where: { publicSlug: slug.trim(), deletedAt: null },
      select: {
        id: true,
        userId: true,
        isTest: true,
        school: {
          select: {
            name: true,
            logoUrl: true,
            courses: {
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { division: "asc" }],
              take: 1,
              select: { name: true, division: true },
            },
          },
        },
      },
    });
    if (!album) return NextResponse.json({ ok: false, error: "No encontramos el álbum." }, { status: 404 });
    const gate = await gateTestAlbumPublicAccess({ isTest: album.isTest, userId: album.userId });
    if (!gate.ok) return gate.response;

    const pack = await prisma.packDefinition.findFirst({
      where: { id: packId, albumId: album.id, isActive: true },
      select: { benefits: { orderBy: { sortOrder: "asc" }, select: { templateV2Id: true } } },
    });
    const templateId = pack?.benefits.find((b) => b.templateV2Id)?.templateV2Id ?? null;
    if (!templateId) return NextResponse.json({ ok: false, error: "Este pack no tiene un diseño para mostrar." }, { status: 404 });

    const template = await loadDesignTemplateVersion({ templateId });
    if (!template) return NextResponse.json({ ok: false, error: "No encontramos el diseño de este pack." }, { status: 404 });

    const base = demoDePlantilla({ templateId: template.templateId, meta: template.legacy.meta });
    const curso = album.school?.courses[0];
    // Los datos del colegio son los reales; el alumno, sus compañeros y las fotos, de ejemplo.
    const demo = {
      ...base,
      curso: curso ? nombreDelCurso(curso) : base.curso,
      turno: curso ? null : base.turno,
      colegio: album.school?.name?.trim() || base.colegio,
    };
    const huecos = huecosDeDemo(template.legacy.blocks);
    const subidos = await archivosDeDemoSubidos(archivosNecesarios(demo, huecos));
    const urlSiEsta = (archivo: string) => (subidos[archivo] ? urlPublicaDeDemo(archivo) : null);
    const logo = album.school?.logoUrl?.trim() || urlSiEsta(demo.archivos.logo);
    return NextResponse.json({
      ok: true,
      template: toDesignTemplatePayload(template),
      values: valoresDeDemo(demo, logo, urlSiEsta),
      fotos: fotosDeDemoPorBloque(huecos, demo, urlSiEsta),
    });
  } catch (err) {
    console.error("vista 3d de pack de preventa:", err);
    return NextResponse.json({ ok: false, error: "No pudimos armar la vista 3D." }, { status: 500 });
  }
}
