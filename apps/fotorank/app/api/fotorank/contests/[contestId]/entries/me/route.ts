import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import { getContestEntryStorage } from "../../../../../../lib/fotorank/storage/private-local-storage";
import { getMyEntries } from "../../../../../../lib/fotorank/entries";
import { toPublicParticipantAdmissionView } from "../../../../../../lib/fotorank/admission";
import type { AdmissionOpsMetadata } from "../../../../../../lib/fotorank/admission";

type Ctx = { params: Promise<{ contestId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId } = await ctx.params;
  const entries = await getMyEntries(contestId, user.id);
  if (entries.length === 0) {
    return NextResponse.json({ error: { code: "ENTRY_NOT_FOUND", message: "Sin obra." } }, { status: 404 });
  }

  const storage = getContestEntryStorage();
  const views = await Promise.all(entries.map((e) => toMyEntryView(e, storage)));

  /**
   * `entry` es la primera obra y se conserva por compatibilidad: en concursos
   * de una sola foto es la única, y los e2e y clientes viejos la leen así.
   * `entries` trae todas para los concursos que admiten varias.
   */
  return NextResponse.json({ ok: true, entry: views[0], entries: views });
}

type MyEntry = Awaited<ReturnType<typeof getMyEntries>>[number];

async function toMyEntryView(entry: MyEntry, storage: ReturnType<typeof getContestEntryStorage>) {
  const thumb = entry.assets.find((a) => a.kind === "THUMBNAIL");
  let previewUrl: string | null = null;
  if (thumb) {
    previewUrl = await storage.getSignedUrl(thumb.storageKey, "read", 600);
  }

  const meta =
    entry.metadataJson && typeof entry.metadataJson === "object" && !Array.isArray(entry.metadataJson)
      ? (entry.metadataJson as { admissionOps?: AdmissionOpsMetadata })
      : {};
  const admissionPublic = toPublicParticipantAdmissionView({
    status: entry.status,
    technicalSummaryStatus: entry.technicalSummaryStatus,
    manualReviewStatus: entry.manualReviewStatus,
    admissionStatus: entry.admissionStatus,
    withdrawnAt: entry.withdrawnAt,
    admissionOps: meta.admissionOps ?? null,
  });

  return {
    id: entry.id,
    status: entry.status,
    entryNumber: entry.entryNumber,
    technicalSummaryStatus: entry.technicalSummaryStatus,
    manualReviewStatus: entry.manualReviewStatus,
    admissionStatus: entry.admissionStatus,
    admissionPublic,
    publicRejectionReason: entry.publicRejectionReason,
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
  };
}
