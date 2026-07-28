import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  adminReviewSubmissionAction,
  ensureUploadConfigAction,
} from "@/lib/photo-upload/admin";

type Props = {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{ status?: string; validation?: string }>;
};

export default async function EditionSubmissionsAdminPage({ params, searchParams }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;
  const filters = await searchParams;

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    include: { uploadConfig: true },
  });
  if (!edition) notFound();

  const submissions = await prisma.clickatonPhotoSubmission.findMany({
    where: {
      editionId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.validation ? { validationResult: filters.validation as never } : {}),
    },
    include: {
      prompt: { select: { sequence: true, internalName: true, title: true } },
      registration: { select: { visibleCode: true, firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`Envíos · ${edition.name}`}
        description="Revisión técnica. No modifica metadata EXIF original. Uploads deshabilitados por defecto en seed."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Envíos" },
        ]}
        actions={
          <form action={ensureUploadConfigAction.bind(null, editionId)}>
            <Button type="submit" variant="secondary">
              Asegurar config upload
            </Button>
          </form>
        }
      />

      <Card variant="outlined" className="space-y-2 p-5 text-sm">
        <p>
          Uploads habilitados:{" "}
          <strong>{edition.uploadConfig?.uploadsEnabled ? "SÍ" : "NO"}</strong>
        </p>
        <p className="text-ck-text-muted">
          GPS default: {edition.uploadConfig?.defaultGpsMode ?? "OPTIONAL"} · tolerancia{" "}
          {edition.uploadConfig?.captureClockToleranceMinutes ?? 5} min
        </p>
      </Card>

      <form method="get" className="flex flex-wrap gap-3">
        <select name="status" defaultValue={filters.status ?? ""} className="rounded border border-ck-border bg-transparent px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          {["PENDING_CONFIRMATION", "CONFIRMED", "REJECTED", "FAILED", "MANUAL_REVIEW", "PROCESSING"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="validation" defaultValue={filters.validation ?? ""} className="rounded border border-ck-border bg-transparent px-3 py-2 text-sm">
          <option value="">Toda validación</option>
          {["PASS", "WARNING", "FAIL", "MANUAL_REVIEW"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm">Filtrar</Button>
      </form>

      {submissions.length === 0 ? (
        <p className="text-sm text-ck-text-muted">Sin envíos para estos filtros.</p>
      ) : (
        <ul className="space-y-4">
          {submissions.map((s) => (
            <li key={s.id}>
              <Card variant="outlined" className="space-y-3 p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      #{s.registration.visibleCode ?? "—"} ·{" "}
                      {s.registration.firstName} {s.registration.lastName}
                    </p>
                    <p className="text-sm text-ck-text-secondary">
                      Consigna {s.prompt.sequence} ({s.prompt.internalName}) · {s.status} ·{" "}
                      {s.validationResult ?? "—"}
                    </p>
                    <p className="font-mono text-xs text-ck-text-muted">
                      hash {s.sha256?.slice(0, 16) ?? "—"}… · entry {s.fotorankEntryId ?? "—"}
                    </p>
                  </div>
                  <div className="text-xs text-ck-text-muted">
                    <p>EXIF: {s.exifStatus ?? "—"}</p>
                    <p>GPS: {s.gpsStatus ?? "—"}</p>
                    <p>Captura Δ: {s.captureDeltaMinutes ?? "—"} min</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={adminReviewSubmissionAction.bind(null, editionId, s.id)}>
                    <input type="hidden" name="decision" value="APPROVE" />
                    <Button type="submit" size="sm" variant="primary">Aprobar técnicamente</Button>
                  </form>
                  <form action={adminReviewSubmissionAction.bind(null, editionId, s.id)} className="flex gap-2">
                    <input type="hidden" name="decision" value="REJECT" />
                    <input name="notes" placeholder="Motivo" className="rounded border border-ck-border px-2 text-sm" />
                    <Button type="submit" size="sm" variant="outline">Rechazar</Button>
                  </form>
                  <form action={adminReviewSubmissionAction.bind(null, editionId, s.id)}>
                    <input type="hidden" name="decision" value="MANUAL_REVIEW" />
                    <Button type="submit" size="sm" variant="secondary">Cola revisión</Button>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
