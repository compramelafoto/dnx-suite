import { checkAgencyUploadTarget } from "@/lib/agencies/upload-target";
import { ensureMpConnected } from "@/app/api/dashboard/albums/[id]/photos/upload-helpers";
import { FLUX_MESSAGES, authorizeFluxRequest, fluxError, fluxJson, readJsonObject } from "@/lib/agencies/flux-http";
import { requestFluxUploads, resolveFluxPoint, validateFluxFiles } from "@/lib/agencies/flux-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const positiveInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** DNX FLUX pide subir hasta 50 JPG al álbum de una agencia: devuelve una URL firmada de R2 por archivo. */
export async function POST(request: Request) {
  const a = await authorizeFluxRequest(request);
  if ("res" in a) return a.res;
  const body = await readJsonObject(request);
  if (!body) return fluxError(FLUX_MESSAGES.data, 400);
  const agencyId = positiveInt(body.agencyId);
  const albumId = positiveInt(body.albumId);
  if (!agencyId || !albumId) return fluxError(FLUX_MESSAGES.data, 400);
  const v = validateFluxFiles(body.files);
  if (!v.ok) return fluxError(v.error, 400);
  try {
    const target = await checkAgencyUploadTarget(agencyId, albumId, a.ctx.userId);
    if (!target.ok) return fluxError(target.message, 403);
    const mp = await ensureMpConnected({ id: a.ctx.userId, role: a.ctx.role });
    if (!mp.ok) return fluxError(mp.error ?? FLUX_MESSAGES.error, 403);
    const p = await resolveFluxPoint(agencyId, body);
    if (!p.ok) return fluxError(p.error, 400);
    const files = await requestFluxUploads(a.ctx, { agencyId, albumId }, v.files, p.point);
    return fluxJson({ files });
  } catch {
    return fluxError(FLUX_MESSAGES.error, 503);
  }
}
