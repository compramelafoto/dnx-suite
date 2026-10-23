import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { exportarPliego } from "@/lib/fotolibro/exportar";
import { puedeEditarFotolibro } from "@/lib/fotolibro/permisos";

export const runtime = "nodejs";
// Un pliego baja sus fotos originales y se rasteriza a 300 ppp: puede tardar.
export const maxDuration = 120;

type Ctx = { params: Promise<{ templateId: string; pliego: string }> };

/** Un pliego del fotolibro en JPG para el laboratorio. Lo arma el Modo Fotolibro de a uno. */
export async function GET(_req: Request, context: Ctx) {
  const user = await requireAuth();
  const { templateId, pliego } = await context.params;
  if (!(await puedeEditarFotolibro(user.id, templateId))) {
    return NextResponse.json({ error: "No podés exportar este fotolibro." }, { status: 403 });
  }
  const n = Number(pliego);
  if (!Number.isInteger(n) || n < 0 || n > 200) {
    return NextResponse.json({ error: "Pliego inválido." }, { status: 400 });
  }
  const r = await exportarPliego(templateId, n);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return new NextResponse(Buffer.from(r.jpg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="${r.nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
