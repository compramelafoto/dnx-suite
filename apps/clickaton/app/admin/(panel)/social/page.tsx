import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/admin/db";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import {
  approveSocialPublishAction, cancelSocialPublishAction, duplicateSocialPublishAction,
  rejectSocialPublishAction, retrySocialPublishAction, scheduleSocialPublishAction,
} from "@/lib/social-publisher/admin-actions";

type Props = { searchParams: Promise<{ status?: string; application?: string }> };

export default async function AdminSocialPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const filters = await searchParams;
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
        title="Publicaciones sociales"
        description="Cola editorial de Clickatón. La publicación real requiere aprobación y DNX_SOCIAL_PUBLISHER_LIVE=true."
        breadcrumbs={[{ label: "Publicaciones sociales" }]}
      />
      <form className="flex flex-wrap gap-3 rounded-[var(--ck-radius-card)] border border-ck-border p-4" method="get">
        <select name="status" defaultValue={filters.status ?? ""} className="rounded border border-ck-border bg-transparent px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          {["PENDING_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHED", "FAILED", "CANCELLED", "REJECTED"].map((status) => <option key={status}>{status}</option>)}
        </select>
        <select name="application" defaultValue={filters.application ?? ""} className="rounded border border-ck-border bg-transparent px-3 py-2 text-sm">
          <option value="">Todas las aplicaciones</option><option value="CLICKATON">Clickatón</option>
        </select>
        <Button type="submit" variant="secondary">Filtrar</Button>
      </form>
      {requests.length === 0 ? <p className="text-sm text-ck-text-muted">No hay solicitudes para estos filtros.</p> : (
        <ul className="space-y-4">
          {requests.map((request) => {
            const assets = Array.isArray(request.assets) ? request.assets : [];
            const preview = assets.find((asset) => asset && typeof asset === "object" && "publicUrl" in asset) as { publicUrl?: string | null } | undefined;
            return <li key={request.id} className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-semibold">{request.entityType} · {request.status}</p><p className="text-sm text-ck-text-secondary">{request.caption}</p><p className="mt-1 font-mono text-xs text-ck-text-muted">{request.id}</p></div>
                {preview?.publicUrl ? <a href={preview.publicUrl} target="_blank" rel="noreferrer" className="text-sm underline">Vista previa del asset</a> : <span className="text-sm text-ck-text-muted">Asset pendiente</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={approveSocialPublishAction.bind(null, request.id)}><Button type="submit" size="sm" variant="primary">Aprobar</Button></form>
                <form action={retrySocialPublishAction.bind(null, request.id)}><Button type="submit" size="sm" variant="secondary">Reintentar</Button></form>
                <form action={cancelSocialPublishAction.bind(null, request.id)}><Button type="submit" size="sm" variant="outline">Cancelar</Button></form>
                <form action={duplicateSocialPublishAction.bind(null, request.id)}><Button type="submit" size="sm" variant="outline">Duplicar</Button></form>
                <form action={rejectSocialPublishAction.bind(null, request.id)} className="flex gap-2"><input name="reason" aria-label="Motivo de rechazo" placeholder="Motivo" className="w-36 rounded border border-ck-border px-2 text-sm" /><Button type="submit" size="sm" variant="outline">Rechazar</Button></form>
                <form action={scheduleSocialPublishAction.bind(null, request.id)} className="flex gap-2"><input name="scheduleAt" type="datetime-local" aria-label="Programar publicación" className="rounded border border-ck-border px-2 text-sm" /><Button type="submit" size="sm" variant="secondary">Programar</Button></form>
              </div>
            </li>;
          })}
        </ul>
      )}
    </div>
  );
}
