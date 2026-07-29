import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import { getContestEntryStorage } from "../../../../../../lib/fotorank/storage/private-local-storage";
import { getMyEntry } from "../../../../../../lib/fotorank/entries";

type Ctx = { params: Promise<{ contestId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId } = await ctx.params;
  const entry = await getMyEntry(contestId, user.id);
  if (!entry) {
    return NextResponse.json({ error: { code: "ENTRY_NOT_FOUND", message: "Sin obra." } }, { status: 404 });
  }

  const storage = getContestEntryStorage();
  const thumb = entry.assets.find((a) => a.kind === "THUMBNAIL");
  let previewUrl: string | null = null;
  if (thumb) {
    previewUrl = await storage.getSignedUrl(thumb.storageKey, "read", 600);
  }

  return NextResponse.json({
    ok: true,
    entry: {
      id: entry.id,
      status: entry.status,
      entryNumber: entry.entryNumber,
      technicalSummaryStatus: entry.technicalSummaryStatus,
      technicalSummary: entry.technicalSummaryJson,
      submittedAt: entry.submittedAt?.toISOString() ?? null,
      confirmedAt: entry.confirmedAt?.toISOString() ?? null,
      replacedAt: entry.replacedAt?.toISOString() ?? null,
      category: entry.category,
      previewUrl,
      checks: entry.checks.map((c) => ({
        checkCode: c.checkCode,
        checkGroup: c.checkGroup,
        status: c.status,
        title: c.title,
        message: c.message,
      })),
      activeVersions: entry.assets.map((a) => ({
        id: a.id,
        kind: a.kind,
        versionNumber: a.versionNumber,
        // no exponer storageKey completo al cliente salvo necesidad
        hasFile: Boolean(a.storageKey),
        width: a.width,
        height: a.height,
        sha256Prefix: a.sha256 ? `${a.sha256.slice(0, 12)}…` : null,
      })),
    },
  });
}
