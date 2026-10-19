import { FLUX_MESSAGES, authorizeFluxRequest, fluxError, fluxJson } from "@/lib/agencies/flux-http";
import { confirmFluxUpload } from "@/lib/agencies/flux-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DNX FLUX confirma que terminó de subir una foto: entra a la fila de ingesta del álbum de la agencia. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorizeFluxRequest(request);
  if ("res" in a) return a.res;
  const { id } = await params;
  try {
    const r = await confirmFluxUpload(a.ctx, id);
    return fluxJson(r.body, r.status);
  } catch {
    return fluxError(FLUX_MESSAGES.error, 503);
  }
}
