import { NextResponse } from "next/server";
import { requireActiveWorkspace } from "@/lib/workspace";
import { renderPrintedCard } from "@/lib/carnet/render";
import { resolveCardCapabilities } from "@/lib/carnet/operators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * El PDF de imprenta de una tarjeta.
 *
 * Solo para quien tiene permiso de producir: el archivo lleva la foto y los datos del socio,
 * así que no puede quedar detrás de una URL que adivine cualquiera.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Sin institución activa" }, { status: 403 });
  }

  const capabilities = await resolveCardCapabilities(user.id, workspace.id);
  if (!capabilities.includes("PRODUCIR")) {
    return NextResponse.json({ error: "No tenés permiso para imprimir carnets" }, { status: 403 });
  }

  const { cardId } = await params;
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").trim();
  if (!base) {
    return NextResponse.json(
      { error: "Falta configurar la dirección pública de la aplicación" },
      { status: 500 },
    );
  }

  const salida = await renderPrintedCard({ workspaceId: workspace.id, cardId, baseUrl: base });
  if (!salida.ok) {
    // Los mensajes del módulo de diseño están escritos para mostrarlos tal cual: dicen qué
    // dato falta, no un error técnico.
    return NextResponse.json({ error: salida.errors.join(" ") }, { status: 422 });
  }

  const pdf = salida.files.find((f) => f.contentType === "application/pdf");
  if (!pdf) {
    return NextResponse.json({ error: "No se generó el PDF" }, { status: 500 });
  }

  return new NextResponse(Buffer.from(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.fileName}"`,
      // Nunca en cachés intermedias: lleva datos personales.
      "Cache-Control": "private, no-store",
    },
  });
}
