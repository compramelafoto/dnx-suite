import { NextResponse } from "next/server";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { parsePlacaFormat, parsePlacaKind } from "@/lib/placas/constants";
import { renderPlaca } from "@/lib/placas/render";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * La placa de un socio, como PNG.
 *
 * Se dibuja en cada pedido y no se guarda (ver `lib/placas/render.ts`). Sólo para quien ve
 * Comunicación en esta institución: la imagen lleva la foto y el nombre del socio.
 *
 * `?descargar=1` la entrega como archivo; sin eso, para mostrarla en la pantalla.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ memberId: string; kind: string; format: string }> },
) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Sin institución activa" }, { status: 403 });
  }
  const level = await getModuleLevel(user.id, workspace.id, COMMUNICATIONS_MODULE_KEY);
  if (!hasLevel(level, "VIEW")) {
    return NextResponse.json({ error: "No tenés acceso a Comunicación" }, { status: 403 });
  }

  const { memberId, kind: kindRaw, format: formatRaw } = await params;
  const kind = parsePlacaKind(kindRaw);
  const format = parsePlacaFormat(formatRaw);
  if (!kind || !format) {
    return NextResponse.json({ error: "No existe esa placa" }, { status: 404 });
  }

  const salida = await renderPlaca({ workspaceId: workspace.id, memberId, kind, format });
  if (!salida.ok) {
    // Que el mensaje quede en el registro: sin él, cada diagnóstico cuesta un deploy.
    console.error("[fotoffice][placas] no se pudo dibujar", {
      workspaceId: workspace.id,
      memberId,
      kind,
      format,
      errores: salida.errors,
    });
    return NextResponse.json({ error: salida.errors.join(" ") }, { status: 422 });
  }

  const descargar = new URL(request.url).searchParams.get("descargar") === "1";
  return new NextResponse(Buffer.from(salida.png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // Lleva datos del socio y cambia con la plantilla: ni el navegador ni el CDN la guardan.
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${salida.fileName}"`,
    },
  });
}
