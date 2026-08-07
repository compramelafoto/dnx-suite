import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { toPartnerActor } from "@/lib/admin/partners/runtime";
import {
  discardSyncEventFormAction,
  processSyncEventFormAction,
  retrySyncEventFormAction,
} from "@/lib/partners-auto-sync/admin-mutations";
import {
  isPartnerBenefitAutoSyncEnabled,
  isPartnerBenefitAutoSyncWritesEnabled,
  resolveAutoSyncProcessMode,
} from "@/lib/partners-auto-sync/flags";
import { listPartnerBenefitSyncEvents } from "@/lib/partners-auto-sync/process";

const SYNC_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PROCESSING: "Procesando",
  PROCESSED: "Procesado",
  FAILED: "Fallido",
  DEAD: "Descartado",
};

function syncPayloadIds(payload: unknown): {
  prizeBundleId?: string;
  previousWinner?: string;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const o = payload as Record<string, unknown>;
  return {
    prizeBundleId: typeof o.prizeBundleId === "string" ? o.prizeBundleId : undefined,
    previousWinner:
      typeof o.previousWinnerRegistrationId === "string"
        ? o.previousWinnerRegistrationId
        : undefined,
  };
}


export default async function PartnerBenefitSyncAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    eventType?: string;
    editionId?: string;
    error?: string;
    ok?: string;
    mode?: string;
    benefits?: string;
    prizeAssignmentId?: string;
    winnersOnly?: string;
  }>;
}) {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const sp = await searchParams;

  let events: Awaited<ReturnType<typeof listPartnerBenefitSyncEvents>> = [];
  let loadError: string | null = null;
  try {
    events = await listPartnerBenefitSyncEvents({
      actor,
      status: sp.status,
      eventType: sp.eventType,
      editionId: sp.editionId,
      prizeAssignmentId: sp.prizeAssignmentId,
      winnersOnly: sp.winnersOnly === "1",
      take: 100,
    });
  } catch (err) {
    loadError = err instanceof Error ? err.message : "No se pudo listar eventos.";
  }

  const mode = resolveAutoSyncProcessMode();

  return (
    <div className="min-w-0 space-y-10">
      <AdminPageHeader
        title="Sincronización de beneficios"
        description="Cola durable de reevaluación automática (outbox Clickatón). No edita acuerdos comerciales."
        breadcrumbs={[
          { label: "Sponsors y beneficios", href: adminRoutes.sponsors },
          { label: "Sincronización" },
        ]}
        actions={
          <Button href={adminRoutes.sponsors} variant="secondary">
            Volver al catálogo
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card variant="outlined" className="space-y-2 p-6">
          <p className="text-sm text-ck-text-muted">Sincronización automática</p>
          <p className="text-lg font-semibold text-ck-text">
            {isPartnerBenefitAutoSyncEnabled() ? "Activada" : "Desactivada"}
          </p>
        </Card>
        <Card variant="outlined" className="space-y-2 p-6">
          <p className="text-sm text-ck-text-muted">Escrituras</p>
          <p className="text-lg font-semibold text-ck-text">
            {isPartnerBenefitAutoSyncWritesEnabled() ? "Activadas" : "Desactivadas"}
          </p>
        </Card>
        <Card variant="outlined" className="space-y-2 p-6">
          <p className="text-sm text-ck-text-muted">Modo efectivo del cron</p>
          <p className="text-lg font-semibold text-ck-text">{mode}</p>
        </Card>
      </div>

      {sp.error ? (
        <Card variant="outlined" className="border-red-500/40 p-4 text-sm text-red-200">
          {sp.error}
        </Card>
      ) : null}
      {sp.ok ? (
        <Card variant="outlined" className="border-emerald-500/30 p-4 text-sm text-ck-text-secondary">
          Operación: {sp.ok}
          {sp.mode ? ` · mode=${sp.mode}` : ""}
          {sp.benefits ? ` · benefits=${sp.benefits}` : ""}
        </Card>
      ) : null}
      {loadError ? (
        <Card variant="outlined" className="border-red-500/40 p-4 text-sm text-red-200">
          {loadError}
        </Card>
      ) : null}

      <Card variant="outlined" className="p-6">
        <form method="get" className="flex flex-wrap gap-4 items-end">
          <label className="space-y-2 text-sm">
            <span className="text-ck-text-muted">Estado</span>
            <select
              name="status"
              defaultValue={sp.status ?? ""}
              className="block min-w-[10rem] rounded-md border border-ck-border bg-ck-bg px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="PROCESSING">Procesando</option>
              <option value="PROCESSED">Procesado</option>
              <option value="FAILED">Fallido</option>
              <option value="DEAD">Descartado</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-ck-text-muted">ID de edición</span>
            <input
              name="editionId"
              defaultValue={sp.editionId ?? ""}
              className="block min-w-[14rem] rounded-md border border-ck-border bg-ck-bg px-3 py-2"
            />
          </label>
          <Button type="submit" variant="secondary" size="sm">
            Filtrar
          </Button>
        </form>
      </Card>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Eventos</h2>
        {events.length === 0 ? (
          <Card variant="outlined" className="p-8 text-sm text-ck-text-secondary">
            No hay eventos de sincronización de beneficios con esos filtros.
          </Card>
        ) : (
          <Card variant="outlined" className="overflow-x-auto p-0">
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead className="border-b border-ck-border text-ck-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Agregado</th>
                  <th className="px-4 py-3 font-medium">Edición</th>
                  <th className="px-4 py-3 font-medium">Intentos</th>
                  <th className="px-4 py-3 font-medium">Error</th>
                  <th className="px-4 py-3 font-medium">Creado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-ck-border/50 align-top">
                    <td className="px-4 py-3 font-mono text-xs text-ck-text">{e.eventType}</td>
                    <td className="px-4 py-3">
                      <Badge>{SYNC_STATUS_LABELS[e.status] ?? e.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-ck-text-muted">
                      {e.aggregateType}
                      <br />
                      <span className="font-mono">{e.aggregateId.slice(0, 12)}…</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {e.editionId ? (
                        <Link
                          href={`${adminRoutes.editions}/${e.editionId}/sponsors`}
                          className="text-ck-accent underline-offset-2 hover:underline"
                        >
                          {e.editionId.slice(0, 10)}…
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{e.attempts}</td>
                    <td className="px-4 py-3 text-xs text-ck-text-muted max-w-[12rem] truncate">
                      {e.lastError ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-ck-text-muted">
                      {e.createdAt.toLocaleString("es-AR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <form action={processSyncEventFormAction}>
                          <input type="hidden" name="eventId" value={e.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            Procesar (shadow/apply)
                          </Button>
                        </form>
                        <form action={processSyncEventFormAction}>
                          <input type="hidden" name="eventId" value={e.id} />
                          <input type="hidden" name="forceApply" value="1" />
                          <Button type="submit" size="sm" variant="primary">
                            Aplicar escrituras
                          </Button>
                        </form>
                        <form action={retrySyncEventFormAction}>
                          <input type="hidden" name="eventId" value={e.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Reintentar
                          </Button>
                        </form>
                        <form action={discardSyncEventFormAction} className="flex gap-2">
                          <input type="hidden" name="eventId" value={e.id} />
                          <input
                            name="reason"
                            placeholder="Motivo"
                            className="min-w-0 flex-1 rounded border border-ck-border bg-transparent px-2 text-xs"
                            required
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Descartar
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
