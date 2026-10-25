import { NextResponse } from "next/server";
import { designErrorResponse, parseId, requireDesignActor } from "@/lib/design-v2/http";
import { guardarCursosDelListado, loadListadoDelDiseno } from "@/lib/design-v2/listado-del-diseno";
import { loadDesignProjectForActor, loadTemplateForDesign } from "@/lib/design-v2/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/fotografo/disenos/[id]/listado — los cursos del listado y el aviso de la foto grupal. */
export async function GET(_req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });
  try {
    const { project, data } = await loadDesignProjectForActor(id, actor);
    const template = await loadTemplateForDesign(data);
    const listado = await loadListadoDelDiseno({ albumId: project.albumId, data, template });
    return NextResponse.json({ ok: true, listado });
  } catch (err) {
    return designErrorResponse(err, "leer listado");
  }
}

/** POST /api/fotografo/disenos/[id]/listado — Body: `{ cursos: string[] }` (claves de los cursos sumados). */
export async function POST(req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { cursos?: unknown };
  const cursos = Array.isArray(body.cursos)
    ? body.cursos.filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= 300).slice(0, 30)
    : null;
  if (!cursos) return NextResponse.json({ ok: false, error: "Faltan los cursos." }, { status: 400 });
  try {
    await guardarCursosDelListado(id, actor, cursos);
    const { project, data } = await loadDesignProjectForActor(id, actor);
    const template = await loadTemplateForDesign(data);
    const listado = await loadListadoDelDiseno({ albumId: project.albumId, data, template });
    return NextResponse.json({ ok: true, data, listado, status: project.status });
  } catch (err) {
    return designErrorResponse(err, "guardar listado");
  }
}
