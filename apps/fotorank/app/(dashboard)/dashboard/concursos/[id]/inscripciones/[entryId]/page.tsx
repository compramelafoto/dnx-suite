import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../../../../lib/auth";
import { EntryError, listContestEntriesForOrganizer } from "../../../../../../lib/fotorank/entries";
import { redactArgraForLog } from "../../../../../../lib/fotorank/eligibility";
import { getContestEntryStorage } from "../../../../../../lib/fotorank/storage/private-local-storage";
import { PageContainer } from "../../../../../../components/PageContainer";
import { ManualReviewForm } from "./ManualReviewForm";
import { AdmissionActionsForm } from "./AdmissionActionsForm";

type Props = { params: Promise<{ id: string; entryId: string }> };

export default async function ContestEntryDetailAdminPage({ params }: Props) {
  const user = await requireAuth();
  const { id: contestId, entryId } = await params;

  try {
    await listContestEntriesForOrganizer({ contestId, organizerUserId: user.id });
  } catch (err) {
    if (err instanceof EntryError && err.code === "FORBIDDEN") redirect("/dashboard");
    if (err instanceof EntryError && err.code === "CONTEST_NOT_FOUND") notFound();
    throw err;
  }

  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { id: entryId, contestId },
    include: {
      category: { select: { name: true, slug: true } },
      registration: {
        include: { participant: { select: { name: true, email: true } } },
      },
      checks: { orderBy: [{ checkGroup: "asc" }, { checkCode: "asc" }] },
      assets: { orderBy: [{ versionNumber: "desc" }, { kind: "asc" }] },
      reviews: {
        orderBy: { reviewedAt: "desc" },
        include: { reviewer: { select: { name: true, email: true } } },
      },
      activeAsset: {
        include: { exifMetadata: true },
      },
    },
  });
  if (!entry) notFound();

  const eligibilityMeta =
    entry.metadataJson && typeof entry.metadataJson === "object" && !Array.isArray(entry.metadataJson)
      ? ((entry.metadataJson as { eligibility?: Record<string, unknown> }).eligibility ?? null)
      : null;
  const registrationAnswersJson = entry.registration?.answersJson ?? null;
  const answers =
    registrationAnswersJson &&
    typeof registrationAnswersJson === "object" &&
    !Array.isArray(registrationAnswersJson)
      ? (registrationAnswersJson as {
          argraMembershipNumber?: string;
          argraVerificationStatus?: string;
        })
      : null;
  const argraRedacted = redactArgraForLog(answers?.argraMembershipNumber ?? null);

  const storage = getContestEntryStorage();
  const thumb = entry.assets.find((a) => a.isActive && a.kind === "THUMBNAIL");
  const previewUrl = thumb ? await storage.getSignedUrl(thumb.storageKey, "read", 600) : null;
  const sha = entry.activeAsset?.sha256;
  const shaMasked = sha ? `${sha.slice(0, 12)}…${sha.slice(-8)}` : null;

  return (
    <PageContainer
      title={`Obra ${entry.entryNumber ?? entry.id.slice(0, 8)}`}
      description="Detalle técnico, checklist, versiones y revisión manual."
    >
      <div className="mb-8 flex flex-wrap gap-4">
        <Link
          href={`/dashboard/concursos/${contestId}/inscripciones`}
          className="text-sm text-gold hover:text-gold-hover"
        >
          ← Volver a inscripciones
        </Link>
        <Link
          href={`/dashboard/concursos/${contestId}/admision`}
          className="text-sm text-fr-muted hover:text-gold"
        >
          Cola de admisión
        </Link>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          <section className="fr-recuadro border border-fr-border bg-fr-card space-y-4">
            <h2 className="text-lg font-semibold">Participante</h2>
            <p className="text-fr-primary">{entry.registration?.participant.name ?? "—"}</p>
            <p className="text-sm text-fr-muted">{entry.registration?.participant.email}</p>
            <p className="text-sm text-fr-muted">
              Categoría: {entry.category.name} · Estado obra: {entry.status} · Técnico:{" "}
              {entry.technicalSummaryStatus}
            </p>
            <p className="text-sm text-fr-muted" data-testid="admission-status-line">
              Admisión: {entry.admissionStatus ?? "—"} · Manual: {entry.manualReviewStatus}
            </p>
          </section>

          {eligibilityMeta || argraRedacted ? (
            <section
              className="fr-recuadro border border-fr-border bg-fr-card space-y-4"
              data-testid="admin-eligibility"
            >
              <h2 className="text-lg font-semibold">Elegibilidad</h2>
              <dl className="grid gap-4 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-fr-muted">Dispositivo declarado</dt>
                  <dd className="mt-2 text-fr-primary">
                    {String(eligibilityMeta?.declaredDeviceKind ?? "—")}
                    {eligibilityMeta?.declaredDeviceMake || eligibilityMeta?.declaredDeviceModel
                      ? ` · ${String(eligibilityMeta?.declaredDeviceMake ?? "")} ${String(eligibilityMeta?.declaredDeviceModel ?? "")}`.trim()
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-fr-muted">Estado dispositivo</dt>
                  <dd className="mt-2 text-fr-primary">
                    {String(eligibilityMeta?.deviceEligibilityStatus ?? "—")}
                    {eligibilityMeta?.deviceReasonCode
                      ? ` (${String(eligibilityMeta.deviceReasonCode)})`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-fr-muted">Localidad / territorio</dt>
                  <dd className="mt-2 text-fr-primary">
                    {String(eligibilityMeta?.captureLocality ?? "—")}
                    {eligibilityMeta?.captureDepartment
                      ? ` · ${String(eligibilityMeta.captureDepartment)}`
                      : ""}
                    <span className="mt-1 block text-fr-muted">
                      {String(eligibilityMeta?.territoryStatus ?? "—")} · GPS presente:{" "}
                      {eligibilityMeta?.gpsPresent === true ? "sí" : "no"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-fr-muted">Período de captura</dt>
                  <dd className="mt-2 text-fr-primary">
                    {String(eligibilityMeta?.captureWindowStatus ?? "—")}
                  </dd>
                </div>
                {argraRedacted || answers?.argraVerificationStatus ? (
                  <div>
                    <dt className="text-fr-muted">ARGRA (restringido)</dt>
                    <dd className="mt-2 text-fr-primary">
                      {argraRedacted ?? "—"} · {answers?.argraVerificationStatus ?? "NOT_REQUIRED"}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="text-xs text-fr-muted">
                Coordenadas GPS exactas y número ARGRA completo no se muestran en listados públicos ni logs.
              </p>
            </section>
          ) : null}

          {previewUrl ? (
            <section className="fr-recuadro border border-fr-border bg-fr-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="max-h-96 w-full object-contain" />
              <p className="mt-4 text-xs text-fr-muted">Preview firmado (no es el original).</p>
            </section>
          ) : null}

          <section className="fr-recuadro border border-fr-border bg-fr-card space-y-4">
            <h2 className="text-lg font-semibold">Checklist</h2>
            <ul className="space-y-3 text-sm">
              {entry.checks.map((c) => (
                <li key={c.id} className="flex gap-3 border-b border-fr-border/40 pb-3">
                  <span className="w-32 shrink-0 font-medium text-fr-muted">{c.status}</span>
                  <span>
                    <span className="text-fr-primary">{c.title}</span>
                    <span className="mt-1 block text-fr-muted">{c.message}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="fr-recuadro border border-fr-border bg-fr-card space-y-4">
            <h2 className="text-lg font-semibold">Versiones</h2>
            <ul className="space-y-3 text-sm text-fr-muted">
              {entry.assets.map((a) => (
                <li key={a.id}>
                  v{a.versionNumber} · {a.kind} · {a.isActive ? "ACTIVA" : "histórica"}
                  {a.sha256 ? ` · ${a.sha256.slice(0, 12)}…` : ""}
                </li>
              ))}
            </ul>
            {shaMasked ? <p className="text-xs">SHA-256 activo: {shaMasked}</p> : null}
          </section>

          {entry.activeAsset?.exifMetadata ? (
            <section className="fr-recuadro border border-fr-border bg-fr-card space-y-3 text-sm">
              <h2 className="text-lg font-semibold">Metadata EXIF</h2>
              <p>Estado: {entry.activeAsset.exifMetadata.metadataStatus}</p>
              <p>
                {entry.activeAsset.exifMetadata.cameraMake ?? "—"}{" "}
                {entry.activeAsset.exifMetadata.cameraModel ?? ""}
              </p>
              <p className="text-fr-muted">
                Software: {entry.activeAsset.exifMetadata.software ?? "—"} · Captura:{" "}
                {entry.activeAsset.exifMetadata.captureDate?.toISOString() ?? "—"}
              </p>
            </section>
          ) : null}
        </div>

        <aside className="space-y-8">
          <section className="fr-recuadro border border-fr-border bg-fr-card space-y-4">
            <h2 className="text-lg font-semibold">Admisión operativa</h2>
            <p className="text-xs text-fr-muted">
              Toda acción valida permisos server-side, registra operador, estados y reason code.
            </p>
            <AdmissionActionsForm
              contestId={contestId}
              entryId={entry.id}
              categorySlug={entry.category.slug}
            />
          </section>
          <section className="fr-recuadro border border-fr-border bg-fr-card space-y-4">
            <h2 className="text-lg font-semibold">Revisión manual (legacy)</h2>
            <ManualReviewForm contestId={contestId} entryId={entry.id} />
            <ul className="mt-6 space-y-3 text-xs text-fr-muted">
              {entry.reviews.map((r) => (
                <li key={r.id}>
                  {r.decision} · {r.reviewer.name ?? r.reviewer.email} ·{" "}
                  {r.reviewedAt.toISOString()}
                  {r.reason ? ` — ${r.reason}` : ""}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
