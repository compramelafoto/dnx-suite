import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { adminRoutes } from "@/config/admin/navigation";
import type { AdminRegistrationListItem } from "@/lib/admin-registration/domain/types";
import {
  adminToneToBadgeVariant,
  presentAdminFulfillmentStatus,
  presentAdminOperationalSummary,
  presentAdminPaymentStatus,
} from "@/lib/admin-registration/ui/admin-status-presentation";
import { formatArDateTime } from "@/lib/admin-registration/ui/status-labels";

type Props = {
  row: AdminRegistrationListItem;
};

/** Tarjeta operativa del listado en smartphones (sin tabla ancha). */
export function RegistrationListMobileCard({ row }: Props) {
  const summary = presentAdminOperationalSummary({
    registrationStatus: row.status,
    paymentStatus: row.paymentStatus,
    fulfillmentStatus: row.itemFulfillmentStatus,
  });
  const payment = presentAdminPaymentStatus(row.paymentStatus);
  const kit = presentAdminFulfillmentStatus(row.itemFulfillmentStatus);
  const href = `${adminRoutes.registrations}/${row.id}`;

  return (
    <article className="space-y-3" aria-label={`Inscripción de ${row.firstName} ${row.lastName}`}>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ck-text">
          {row.firstName} {row.lastName}
        </h3>
        <p className="break-all text-sm text-ck-text-secondary">{row.email}</p>
        {row.instagramHandle ? (
          <p className="text-sm text-ck-text-muted">@{row.instagramHandle.replace(/^@/, "")}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={adminToneToBadgeVariant(summary.tone)}>{summary.label}</Badge>
        <Badge variant={adminToneToBadgeVariant(payment.tone)}>{payment.label}</Badge>
        {row.itemFulfillmentStatus ? (
          <Badge variant={adminToneToBadgeVariant(kit.tone)}>{kit.label}</Badge>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-ck-text-muted">Pago</dt>
          <dd>{payment.label}</dd>
        </div>
        <div>
          <dt className="text-xs text-ck-text-muted">Acreditación</dt>
          <dd>Se opera en sede</dd>
        </div>
      </dl>

      <p className="text-sm leading-relaxed text-ck-text-secondary">{summary.description}</p>
      {summary.nextAction ? (
        <p className="text-sm font-medium text-ck-text">Próximo paso: {summary.nextAction}</p>
      ) : null}

      <p className="text-xs text-ck-text-muted">
        {row.visibleCode ? `N.º ${row.visibleCode} · ` : ""}
        Inscripta {formatArDateTime(row.createdAt)}
        {row.shirtSizeLabel ? ` · Talle ${row.shirtSizeLabel}` : ""}
      </p>

      <Button href={href} variant="primary" className="min-h-11 w-full">
        Abrir inscripción
      </Button>
    </article>
  );
}
