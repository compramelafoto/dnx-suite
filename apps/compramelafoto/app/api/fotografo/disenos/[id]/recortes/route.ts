import { NextResponse } from "next/server";
import { huecosSinFondo } from "@repo/template-editor-core";
import { designErrorResponse, parseId, requireDesignActor } from "@/lib/design-v2/http";
import { loadDesignProjectForActor, loadTemplateForDesign } from "@/lib/design-v2/projects";
import { asegurarRecortes, descartarRecorte, estadosDeRecortes, recortesActivos } from "@/lib/recortes/recortes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** El servicio tarda unos segundos por foto. */
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/fotografo/disenos/[id]/recortes — las fotos sin fondo de los huecos «Quitar el fondo».
 * Body: `{ accion: "generar" }` (las que falten), `{ accion: "descartar" | "usar", photoId }`.
 */
export async function POST(req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { accion?: unknown; photoId?: unknown };

  try {
    const loaded = await loadDesignProjectForActor(id, actor);
    const template = await loadTemplateForDesign(loaded.data);
    const huecos = huecosSinFondo(template.legacy.blocks as Array<{ id: string; type: string; configJson?: unknown }>);
    const fotos = [...huecos].flatMap((b) => {
      const pid = loaded.data.slots[b]?.photoId;
      return pid != null ? [pid] : [];
    });

    if (body.accion === "generar") {
      if (!recortesActivos()) {
        return NextResponse.json(
          { ok: false, error: "El servicio para quitar fondos todavía no está configurado: por ahora se imprime la foto entera." },
          { status: 409 },
        );
      }
      await asegurarRecortes(fotos);
    } else if (body.accion === "descartar" || body.accion === "usar") {
      const photoId = typeof body.photoId === "number" ? body.photoId : NaN;
      if (!fotos.includes(photoId)) return NextResponse.json({ ok: false, error: "Esa foto no va sin fondo en este diseño." }, { status: 400 });
      await descartarRecorte(photoId, body.accion === "descartar");
    } else {
      return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, recortes: await estadosDeRecortes(fotos) });
  } catch (err) {
    return designErrorResponse(err, "recortes del diseño");
  }
}
