import {
  DNX_INVENTORY,
  isBookingOccupying,
  type DnxPartnerAdPlacementKey,
  type DnxPartnerBookingStatus,
} from "@repo/partners";
import { listInventoryBookings } from "@repo/db/partners-inventory-bookings";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

/**
 * Qué lugares del inventario publicitario están ocupados y hasta cuándo.
 *
 * Solo lectura: cancelar o extender una reserva desde acá exige decidir quién
 * puede hacerlo, y esa capability todavía no existe.
 */

const NOMBRE_ESPACIO = new Map<string, string>(
  DNX_INVENTORY.map((e) => [e.placementKey, e.name]),
);

function fecha(d: Date): string {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function AdminInventarioPage() {
  await requireClickatonAdmin();
  const ahora = new Date();

  const resultado = await withClickatonDb(() => listInventoryBookings());

  if (!resultado.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Ocupación del inventario"
          description="Qué lugares están vendidos o reservados, y hasta cuándo."
          breadcrumbs={[{ label: "Sponsors y beneficios" }, { label: "Ocupación" }]}
        />
        <AdminMigrationNotice message={resultado.message} />
      </div>
    );
  }

  const filas = resultado.data;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Ocupación del inventario"
        description="Qué lugares están vendidos o reservados, y hasta cuándo. Una reserva vencida deja de ocupar aunque siga figurando hasta que pase la tarea horaria."
        breadcrumbs={[{ label: "Sponsors y beneficios" }, { label: "Ocupación" }]}
      />

      {filas.length === 0 ? (
        <AdminEmptyState
          title="Todo libre"
          description="Todavía no hay ningún lugar reservado ni vendido."
        />
      ) : (
        <Card variant="outlined" className="overflow-x-auto p-0">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-ck-border text-left text-xs uppercase tracking-wide text-ck-text-muted">
              <tr>
                <th className="px-4 py-3">Espacio</th>
                <th className="px-4 py-3">Marca</th>
                <th className="px-4 py-3">Lugar</th>
                <th className="px-4 py-3">Desde</th>
                <th className="px-4 py-3">Hasta</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => {
                const vigente = isBookingOccupying(
                  {
                    placementKey: fila.placementKey as DnxPartnerAdPlacementKey,
                    contextId: fila.contextId,
                    slotIndex: fila.slotIndex,
                    status: fila.status as DnxPartnerBookingStatus,
                    startsAt: fila.startsAt,
                    endsAt: fila.endsAt,
                    reservationExpiresAt: fila.reservationExpiresAt,
                  },
                  ahora,
                );
                return (
                  <tr key={fila.id} className="border-b border-ck-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ck-text">
                        {NOMBRE_ESPACIO.get(fila.placementKey) ?? fila.placementKey}
                      </div>
                      {fila.contextId ? (
                        <div className="text-xs text-ck-text-muted">{fila.contextId}</div>
                      ) : (
                        <div className="text-xs text-ck-text-muted">Global</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>{fila.partner.name}</div>
                      {fila.soldByOrganizationId ? (
                        <div className="text-xs text-ck-text-muted">
                          Vendió: {fila.soldByOrganizationId}
                        </div>
                      ) : (
                        <div className="text-xs text-ck-text-muted">Vendió: DNX</div>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{fila.slotIndex + 1}</td>
                    <td className="px-4 py-3 tabular-nums">{fecha(fila.startsAt)}</td>
                    <td className="px-4 py-3 tabular-nums">{fecha(fila.endsAt)}</td>
                    <td className="px-4 py-3">
                      {fila.status === "SOLD" ? (
                        <Badge variant="success">Vendido</Badge>
                      ) : vigente ? (
                        <Badge variant="warning">
                          Reservado
                          {fila.reservationExpiresAt
                            ? ` hasta ${fecha(fila.reservationExpiresAt)}`
                            : ""}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">Reserva vencida</Badge>
                      )}
                      {fila.reservationExtensionCount > 0 ? (
                        <div className="mt-1 text-xs text-ck-text-muted">
                          Extendida {fila.reservationExtensionCount}×
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
