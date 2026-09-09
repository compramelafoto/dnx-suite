import {
  DNX_INVENTORY,
  isBookingOccupying,
  type DnxPartnerAdPlacementKey,
  type DnxPartnerBookingStatus,
} from "@repo/partners";
import { listInventoryBookings } from "@repo/db/partners-inventory-bookings";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getClickatonPartnersService, toPartnerActor } from "@/lib/admin/partners/runtime";
import {
  confirmarVentaAction,
  extenderReservaAction,
  liberarLugarAction,
  reservarLugarAction,
} from "@/lib/admin/partners/inventory-mutations";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

/**
 * Qué lugares del inventario están ocupados, y dónde se toman.
 *
 * El permiso es el del panel: entrar acá ya implica el bundle completo de
 * operaciones sobre partners, igual que crear una participación.
 *
 * Solo se ofrecen los espacios **montados**: reservar uno que ninguna pantalla
 * dibuja sería venderle a una marca un lugar donde su logo nunca aparecería.
 */

const NOMBRE_ESPACIO = new Map<string, string>(
  DNX_INVENTORY.map((e) => [e.placementKey, e.name]),
);

function fecha(d: Date): string {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Un mes desde hoy, en `AAAA-MM-DD`, como valor por defecto del formulario. */
function periodoPorDefecto(): { desde: string; hasta: string } {
  const hoy = new Date();
  const fin = new Date(hoy);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  const txt = (d: Date) => d.toISOString().slice(0, 10);
  return { desde: txt(hoy), hasta: txt(fin) };
}

const ESPACIOS_VENDIBLES = DNX_INVENTORY.filter((e) => e.mounted);

type Props = { searchParams?: Promise<{ ok?: string; error?: string }> };

export default async function AdminInventarioPage({ searchParams }: Props) {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const ahora = new Date();
  const aviso = (await searchParams) ?? {};
  const periodo = periodoPorDefecto();

  const marcas = await withClickatonDb(async () => {
    const svc = getClickatonPartnersService();
    return svc.listPartners(actor, {});
  });

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

      {aviso.ok ? (
        <div className="rounded-lg border border-ck-border bg-ck-surface px-4 py-3 text-sm text-ck-text">
          {aviso.ok}
        </div>
      ) : null}
      {aviso.error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {aviso.error}
        </div>
      ) : null}

      <Card variant="outlined" className="p-5">
        <h2 className="mb-1 text-base font-semibold text-ck-text">Tomar un lugar</h2>
        <p className="mb-4 text-sm text-ck-text-muted">
          Queda reservado diez días. Si el lugar ya está ocupado en ese período, se avisa y no se
          toma nada.
        </p>
        <form action={reservarLugarAction} className="grid gap-4 md:grid-cols-2">
          <Field id="inv-marca" label="Marca">
            <Select name="partnerId" defaultValue="" required>
              <option value="" disabled>
                Elegí una marca…
              </option>
              {marcas.ok
                ? marcas.data.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))
                : null}
            </Select>
          </Field>

          <Field id="inv-espacio" label="Espacio">
            <Select name="placementKey" defaultValue="" required>
              <option value="" disabled>
                Elegí un espacio…
              </option>
              {ESPACIOS_VENDIBLES.map((e) => (
                <option key={e.placementKey} value={e.placementKey}>
                  {e.name} · {e.application.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="inv-contexto"
            label="Concurso, evento o álbum"
            hint="Solo para espacios que no son globales. Se pega el identificador."
          >
            <Input type="text" name="contextId" placeholder="Opcional" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field id="inv-desde" label="Desde">
              <Input type="date" name="startsAt" defaultValue={periodo.desde} required />
            </Field>
            <Field id="inv-hasta" label="Hasta">
              <Input type="date" name="endsAt" defaultValue={periodo.hasta} required />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Button type="submit">Reservar por 10 días</Button>
          </div>
        </form>
      </Card>

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
                <th className="px-4 py-3">Acciones</th>
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
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {fila.status === "RESERVED" ? (
                          <>
                            <form action={confirmarVentaAction}>
                              <input type="hidden" name="bookingId" value={fila.id} />
                              <Button type="submit" size="sm">
                                Confirmar venta
                              </Button>
                            </form>
                            <form action={extenderReservaAction}>
                              <input type="hidden" name="bookingId" value={fila.id} />
                              <Button type="submit" size="sm" variant="secondary">
                                Extender
                              </Button>
                            </form>
                          </>
                        ) : null}
                        <form action={liberarLugarAction}>
                          <input type="hidden" name="bookingId" value={fila.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            Liberar
                          </Button>
                        </form>
                      </div>
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
