import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import {
  getCatalogAvailabilityAction,
  listTicketTypesAction,
} from "@/lib/admin-catalog/actions/tickets";
import { evaluateTicketConfiguration } from "@/lib/admin-catalog/ui/ticket-status";
import { salesStatusOf } from "@/lib/admin-catalog/domain/availability";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export default async function AdminCatalogHubPage() {
  await requireClickatonAdmin();
  const editionsResult = await listEditionOptions();
  const editions = editionsResult.ok ? editionsResult.data : [];

  let ticketTotal = 0;
  let ticketActive = 0;
  let outOfPeriod = 0;
  let incomplete = 0;

  for (const edition of editions) {
    const list = await listTicketTypesAction({ editionId: edition.id });
    if (!list.ok || !list.data) continue;
    const avail = await getCatalogAvailabilityAction(edition.id);
    const availMap = new Map(
      (avail.ok ? avail.data ?? [] : []).map((a) => [a.ticketTypeId, a]),
    );
    for (const ticket of list.data) {
      ticketTotal += 1;
      if (ticket.isActive) ticketActive += 1;
      const config = evaluateTicketConfiguration(ticket);
      if (config.status === "incomplete") incomplete += 1;
      const sales =
        availMap.get(ticket.id)?.salesStatus ??
        salesStatusOf({
          isActive: ticket.isActive,
          salesStartAt: ticket.salesStartAt,
          salesEndAt: ticket.salesEndAt,
        });
      if (ticket.isActive && (sales === "ended" || sales === "not_started")) {
        outOfPeriod += 1;
      }
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Productos y kits"
        description="Configurá los artículos incluidos con la inscripción y las opciones que deberá elegir cada participante."
        breadcrumbs={[{ label: "Productos y kits" }]}
      />

      <nav aria-label="Secciones del catálogo" className="flex flex-wrap gap-3">
        <Button href={catalogAdminRoutes.hub} variant="secondary">
          Resumen
        </Button>
        <Button href={catalogAdminRoutes.products} variant="secondary">
          Productos
        </Button>
        <Button href={catalogAdminRoutes.tickets} variant="primary">
          Entradas y kits
        </Button>
      </nav>

      <div className="grid gap-6 md:grid-cols-2">
        <Card variant="outlined" className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-ck-text">Productos y talles</h2>
            <Badge variant="success">Disponible</Badge>
          </div>
          <p className="flex-1 text-sm text-ck-text-secondary">
            Remeras y artículos con talles u opciones, stock e imágenes. La venta separada todavía
            no está disponible como tienda pública.
          </p>
          <Button href={catalogAdminRoutes.products} variant="primary" className="w-fit">
            Administrar productos
          </Button>
        </Card>

        <Card variant="outlined" className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-ck-text">Entradas y kits</h2>
            <Badge variant="success">Disponible</Badge>
          </div>
          <p className="flex-1 text-sm text-ck-text-secondary">
            Tipos de entrada, cupos, períodos de venta y composición de productos incluidos.
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ck-text-secondary">Total</dt>
              <dd className="text-xl font-semibold text-ck-text">{ticketTotal}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Activas</dt>
              <dd className="text-xl font-semibold text-ck-text">{ticketActive}</dd>
            </div>
          </dl>
          {outOfPeriod > 0 ? (
            <p className="text-sm text-[var(--ck-warning)]" role="status">
              {outOfPeriod} entrada(s) activa(s) fuera del período de venta actual.
            </p>
          ) : null}
          {incomplete > 0 ? (
            <p className="text-sm text-[var(--ck-danger)]" role="status">
              {incomplete} entrada(s) con configuración incompleta.
            </p>
          ) : null}
          <Button href={catalogAdminRoutes.tickets} variant="primary" className="w-fit">
            Administrar entradas
          </Button>
        </Card>

        <Card variant="outlined" className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-ck-text">Disponibilidad y cupos</h2>
            <Badge variant="neutral">Próximamente</Badge>
          </div>
          <p className="flex-1 text-sm text-ck-text-secondary">
            Vista dedicada de cupos y holds. Los cupos ya se ven en el listado de entradas.
          </p>
          <p className="text-sm text-ck-text-muted">Sin ruta productiva en esta etapa.</p>
        </Card>

        <Card variant="outlined" className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-ck-text">Operación de kits</h2>
            <Badge variant="neutral">Próximamente</Badge>
          </div>
          <p className="flex-1 text-sm text-ck-text-secondary">
            Entrega operativa de kits en sede. Fuera del alcance de esta etapa.
          </p>
          <p className="text-sm text-ck-text-muted">Sin ruta productiva en esta etapa.</p>
        </Card>
      </div>
    </div>
  );
}
