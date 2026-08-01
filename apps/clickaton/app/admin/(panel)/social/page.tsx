import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/admin/db";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import {
  approveSocialPublishAction,
  cancelSocialPublishAction,
  duplicateSocialPublishAction,
  rejectSocialPublishAction,
  retrySocialPublishAction,
  scheduleSocialPublishAction,
} from "@/lib/social-publisher/admin-actions";
import {
  formatSocialDateTime,
  LEGAL_REVIEW_NOTE,
  presentSocialEntityType,
  presentSocialPublisherLiveMode,
  presentSocialPublishStatus,
  SOCIAL_PUBLISH_STATUS_FILTER_OPTIONS,
  SOCIAL_SENSITIVE_CONFIRM,
  socialToneToBadgeVariant,
} from "@/lib/social-communications/ui/social-communications-status-presentation";

type Props = { searchParams: Promise<{ status?: string; application?: string }> };

type AssetPreview = { publicUrl?: string | null; kind?: string | null };

function readPreviewAsset(assets: unknown): AssetPreview | null {
  if (!Array.isArray(assets)) return null;
  const found = assets.find(
    (asset) => asset && typeof asset === "object" && "publicUrl" in asset,
  ) as AssetPreview | undefined;
  return found ?? null;
}

export default async function AdminSocialPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const filters = await searchParams;
  const liveMode = presentSocialPublisherLiveMode(
    process.env.DNX_SOCIAL_PUBLISHER_LIVE === "true",
  );

  const requests = await prisma.dnxSocialPublishRequest.findMany({
    where: {
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.application ? { application: filters.application } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Publicaciones en redes sociales"
        description="Prepará y revisá el contenido que Clickatón podrá publicar o dejar listo para compartir."
        breadcrumbs={[{ label: "Publicaciones en redes sociales" }]}
      />

      <Card
        variant="outlined"
        className="space-y-2 border-[var(--ck-warning)]/40 bg-[var(--ck-warning-soft)] p-5"
        role="status"
      >
        <p className="font-semibold text-ck-text">{liveMode.label}</p>
        <p className="text-sm text-ck-text-secondary">{liveMode.description}</p>
        {!liveMode.canPublishNow ? (
          <p className="text-sm text-ck-text-muted">
            No se muestra “Publicar ahora” porque la publicación automática está desactivada.
          </p>
        ) : null}
        <p className="text-xs text-ck-text-muted">{LEGAL_REVIEW_NOTE}</p>
      </Card>

      <form
        className="flex flex-col gap-3 rounded-[var(--ck-radius-card)] border border-ck-border p-4 sm:flex-row sm:flex-wrap sm:items-end"
        method="get"
      >
        <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
          <span className="font-medium text-ck-text">Estado</span>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="min-h-11 rounded border border-ck-border bg-transparent px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            {SOCIAL_PUBLISH_STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
          <span className="font-medium text-ck-text">Aplicación</span>
          <select
            name="application"
            defaultValue={filters.application ?? ""}
            className="min-h-11 rounded border border-ck-border bg-transparent px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            <option value="CLICKATON">Clickatón</option>
          </select>
        </label>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button type="submit" variant="secondary" className="min-h-11">
            Aplicar filtros
          </Button>
          <Button href="/admin/social" variant="outline" className="min-h-11">
            Limpiar filtros
          </Button>
        </div>
      </form>

      {requests.length === 0 ? (
        <Card variant="outlined" className="space-y-2 p-5">
          <p className="font-medium text-ck-text">No hay publicaciones programadas</p>
          <p className="text-sm text-ck-text-muted">
            Prepará una pieza y definí cuándo deberá publicarse. También puede estar vacío por los
            filtros aplicados.
          </p>
        </Card>
      ) : (
        <ul className="space-y-6">
          {requests.map((request) => {
            const status = presentSocialPublishStatus(request.status);
            const entity = presentSocialEntityType(request.entityType);
            const preview = readPreviewAsset(request.assets);
            const scheduledLabel = request.scheduleAt
              ? formatSocialDateTime(request.scheduleAt)
              : null;

            return (
              <li
                key={request.id}
                className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ck-text">{entity.label}</p>
                      <Badge variant={socialToneToBadgeVariant(status.tone)}>
                        {status.label}
                      </Badge>
                      <Badge variant="neutral">{entity.publicationType}</Badge>
                    </div>
                    <p className="text-sm text-ck-text-secondary">{status.description}</p>
                    {status.nextAction ? (
                      <p className="text-sm text-ck-text-muted">Próximo paso: {status.nextAction}</p>
                    ) : null}
                    {request.caption ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ck-text-muted">
                          Texto de la publicación
                        </p>
                        <p className="text-sm leading-relaxed text-ck-text">{request.caption}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-ck-text-muted">Sin texto de publicación.</p>
                    )}
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                          Publicará desde
                        </dt>
                        <dd className="text-ck-text-secondary">
                          {request.platform === "INSTAGRAM"
                            ? "Instagram (cuenta organizadora)"
                            : request.platform
                              ? `Cuenta organizadora (${String(request.platform)})`
                              : "Cuenta organizadora"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                          Fecha programada
                        </dt>
                        <dd className="text-ck-text-secondary">
                          {scheduledLabel
                            ? `Programada para el ${scheduledLabel}.`
                            : "Sin fecha programada"}
                        </dd>
                      </div>
                    </dl>
                    {status.duplicationRisk ? (
                      <p className="text-xs text-ck-text-muted">
                        Atención: reintentar puede duplicar la publicación si ya llegó a la red.
                      </p>
                    ) : null}
                  </div>

                  <div className="w-full shrink-0 sm:w-40">
                    {preview?.publicUrl ? (
                      <a
                        href={preview.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl border border-ck-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preview.publicUrl}
                          alt={`Vista previa de ${entity.label}`}
                          className="aspect-[9/16] h-auto w-full max-h-64 object-cover"
                        />
                        <span className="sr-only">Abrir vista previa</span>
                      </a>
                    ) : (
                      <p className="rounded-xl border border-dashed border-ck-border px-3 py-8 text-center text-sm text-ck-text-muted">
                        No pudimos mostrar la vista previa. La pieza sigue registrada.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <form action={approveSocialPublishAction.bind(null, request.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={SOCIAL_SENSITIVE_CONFIRM.approve}
                      size="sm"
                      variant="primary"
                      className="min-h-11 w-full sm:w-auto"
                    >
                      Aprobar publicación
                    </ConfirmSubmitButton>
                  </form>
                  <form action={retrySocialPublishAction.bind(null, request.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={SOCIAL_SENSITIVE_CONFIRM.retry}
                      size="sm"
                      variant="secondary"
                      className="min-h-11 w-full sm:w-auto"
                    >
                      Volver a intentar la publicación
                    </ConfirmSubmitButton>
                  </form>
                  <form action={cancelSocialPublishAction.bind(null, request.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={SOCIAL_SENSITIVE_CONFIRM.cancel}
                      size="sm"
                      variant="outline"
                      className="min-h-11 w-full sm:w-auto"
                    >
                      Cancelar publicación
                    </ConfirmSubmitButton>
                  </form>
                  <form action={duplicateSocialPublishAction.bind(null, request.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={SOCIAL_SENSITIVE_CONFIRM.duplicate}
                      size="sm"
                      variant="outline"
                      className="min-h-11 w-full sm:w-auto"
                    >
                      Duplicar preparación
                    </ConfirmSubmitButton>
                  </form>
                  <form
                    action={rejectSocialPublishAction.bind(null, request.id)}
                    className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
                  >
                    <input
                      name="reason"
                      aria-label="Motivo de rechazo"
                      placeholder="Motivo de rechazo"
                      className="min-h-11 w-full rounded border border-ck-border px-3 text-sm sm:w-44"
                    />
                    <ConfirmSubmitButton
                      confirmMessage={SOCIAL_SENSITIVE_CONFIRM.reject}
                      size="sm"
                      variant="outline"
                      className="min-h-11 w-full sm:w-auto"
                    >
                      Rechazar
                    </ConfirmSubmitButton>
                  </form>
                  <form
                    action={scheduleSocialPublishAction.bind(null, request.id)}
                    className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
                  >
                    <input
                      name="scheduleAt"
                      type="datetime-local"
                      aria-label="Programar publicación"
                      className="min-h-11 w-full rounded border border-ck-border px-3 text-sm sm:w-auto"
                    />
                    <ConfirmSubmitButton
                      confirmMessage={SOCIAL_SENSITIVE_CONFIRM.schedule}
                      size="sm"
                      variant="secondary"
                      className="min-h-11 w-full sm:w-auto"
                    >
                      Programar publicación
                    </ConfirmSubmitButton>
                  </form>
                </div>

                <AdminTechnicalInfo
                  rows={[
                    { label: "ID de solicitud", value: request.id, mono: true, copyText: request.id },
                    { label: "Estado interno", value: request.status, mono: true },
                    { label: "Tipo de entidad", value: request.entityType, mono: true },
                    {
                      label: "ID de entidad",
                      value: request.entityId,
                      mono: true,
                      copyText: request.entityId,
                    },
                    {
                      label: "Plantilla",
                      value: request.templateRef ?? "—",
                      mono: true,
                    },
                    {
                      label: "Intentos",
                      value: String(request.attemptCount ?? 0),
                    },
                    {
                      label: "Modo LIVE (env)",
                      value: process.env.DNX_SOCIAL_PUBLISHER_LIVE === "true" ? "true" : "false",
                      mono: true,
                    },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
