import { descargarOriginal } from "@/lib/ventas/descarga-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** El original de una obra para imprimir (panel): quien prepara las copias de la muestra o su autor. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return descargarOriginal(id);
}
