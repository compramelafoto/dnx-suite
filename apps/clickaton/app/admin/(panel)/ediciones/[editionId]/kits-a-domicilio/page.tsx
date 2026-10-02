import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  markKitDispatchedAction,
  markKitPendingAction,
  markKitReturnedAction,
  saveHomeDeliveryConfigAction,
} from "@/lib/home-delivery/admin";
import {
  HOME_DELIVERY_STATUS_LABEL,
  formatArs,
  type HomeDeliveryStatus,
} from "@/lib/home-delivery/domain";

type Props = {
  params: Promise<{ editionId: string }>;
};

const BADGE: Record<HomeDeliveryStatus, "warning" | "accent" | "success" | "danger"> = {
  PENDING: "warning",
  DISPATCHED: "accent",
  RECEIVED: "success",
  RETURNED: "danger",
};

function fecha(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(value);
}

/** Para el `<input type="date">`: el día en Argentina. */
function diaArgentino(value: Date | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(value);
}

export default async function KitsADomicilioPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true, city: true, homeDelivery: true },
  });
  if (!edition) notFound();
  const config = edition.homeDelivery;

  const rows = await prisma.clickatonRegistrationShipping.findMany({
    where: { editionId },
    orderBy: { createdAt: "asc" },
    include: {
      registration: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          visibleCode: true,
          status: true,
          paymentStatus: true,
          items: {
            where: { isIncluded: true },
            select: { nameSnapshot: true, variantNameSnapshot: true },
          },
        },
      },
    },
  });

  // Sólo cuentan los que pagaron: una reserva sin pagar no se despacha.
  const pagos = rows.filter(
    (r) => r.registration.status === "CONFIRMED" && r.registration.paymentStatus === "APPROVED",
  );
  const sinPagar = rows.length - pagos.length;
  const contar = (s: HomeDeliveryStatus) => pagos.filter((r) => r.status === s).length;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Kits a domicilio"
        description={`Quienes viven fuera de ${edition.city ?? "la ciudad de la edición"} y pagaron para recibir el kit por correo. El despacho es manual: cargá el número de seguimiento y se le avisa por email.`}
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Kits a domicilio" },
        ]}
      />

      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">Configuración</h2>
        <form action={saveHomeDeliveryConfigAction} className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <input type="hidden" name="editionId" value={editionId} />
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input type="checkbox" name="enabled" defaultChecked={config?.enabled ?? false} />
            Ofrecer el envío a domicilio en la inscripción
          </label>
          <label className="text-sm">
            <span className="ck-label text-ck-text-secondary">Costo del envío (pesos)</span>
            <input
              name="feePesos"
              inputMode="numeric"
              defaultValue={config ? String(config.feeAmount / 100) : "10000"}
              className="mt-2 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="ck-label text-ck-text-secondary">Llegada garantizada hasta</span>
            <input
              type="date"
              name="guaranteedUntil"
              defaultValue={diaArgentino(config?.guaranteedUntil ?? null)}
              className="mt-2 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-3 py-2"
            />
          </label>
          <Button type="submit">Guardar</Button>
        </form>
        <p className="text-sm text-ck-text-secondary">
          Después de esa fecha se sigue vendiendo con envío, avisando que el kit puede no llegar
          antes de la maratón. Quien vive en {edition.city ?? "la ciudad de la edición"} no ve la
          opción.
        </p>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["PENDING", "DISPATCHED", "RECEIVED", "RETURNED"] as const).map((s) => (
          <Card key={s} className="p-5">
            <p className="ck-label text-ck-text-secondary">{HOME_DELIVERY_STATUS_LABEL[s]}</p>
            <p className="mt-1 text-2xl font-bold">{contar(s)}</p>
          </Card>
        ))}
      </section>
      {sinPagar > 0 ? (
        <p className="text-sm text-ck-text-secondary" role="status">
          Además hay {sinPagar} {sinPagar === 1 ? "inscripción" : "inscripciones"} con envío sin
          pagar o canceladas. No se muestran: no hay que despacharlas.
        </p>
      ) : null}

      {pagos.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-ck-text-secondary">Todavía nadie pagó un envío a domicilio.</p>
        </Card>
      ) : (
        <section className="space-y-4">
          {pagos.map((r) => {
            const reg = r.registration;
            const status = r.status as HomeDeliveryStatus;
            return (
              <Card key={r.id} className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {reg.firstName} {reg.lastName}
                      {reg.visibleCode ? (
                        <span className="ml-2 font-mono text-sm text-ck-text-secondary">
                          {reg.visibleCode}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-ck-text-secondary">{reg.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={BADGE[status]}>{HOME_DELIVERY_STATUS_LABEL[status]}</Badge>
                    {!r.guaranteed ? (
                      <span className="text-xs text-ck-text-secondary">Sin garantía de llegada</span>
                    ) : null}
                  </div>
                </div>

                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <dt className="ck-label text-ck-text-secondary">Domicilio</dt>
                    <dd>
                      {r.street} {r.streetNumber}
                      {r.floor ? `, ${r.floor}` : ""}
                    </dd>
                    <dd>
                      ({r.postalCode}) {r.city}, {r.province}
                    </dd>
                    {r.reference ? <dd className="text-ck-text-secondary">{r.reference}</dd> : null}
                  </div>
                  <div>
                    <dt className="ck-label text-ck-text-secondary">Recibe</dt>
                    <dd>{r.recipientName}</dd>
                    <dd className="text-ck-text-secondary">DNI {r.documentNumber}</dd>
                    <dd className="text-ck-text-secondary">{r.phone}</dd>
                  </div>
                  <div>
                    <dt className="ck-label text-ck-text-secondary">Kit</dt>
                    {reg.items.length > 0 ? (
                      reg.items.map((i, idx) => (
                        <dd key={idx}>
                          {i.nameSnapshot}
                          {i.variantNameSnapshot ? ` · ${i.variantNameSnapshot}` : ""}
                        </dd>
                      ))
                    ) : (
                      <dd className="text-ck-text-secondary">—</dd>
                    )}
                    <dd className="text-ck-text-secondary">Envío {formatArs(r.feeAmount)}</dd>
                  </div>
                </dl>

                {status !== "PENDING" ? (
                  <p className="text-sm text-ck-text-secondary">
                    {r.carrier ? `${r.carrier} · ` : ""}
                    {r.trackingNumber ? `Seguimiento ${r.trackingNumber} · ` : ""}
                    Despachado {fecha(r.dispatchedAt)}
                    {r.receivedAt ? ` · Recibido y acreditado ${fecha(r.receivedAt)}` : ""}
                    {r.returnedAt ? ` · Devuelto ${fecha(r.returnedAt)}` : ""}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-end gap-3 border-t border-ck-border pt-4">
                  {status === "PENDING" || status === "RETURNED" ? (
                    <form action={markKitDispatchedAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="shippingId" value={r.id} />
                      <label className="text-sm">
                        <span className="ck-label text-ck-text-secondary">Correo</span>
                        <input
                          name="carrier"
                          defaultValue={r.carrier ?? "Correo Argentino"}
                          className="mt-1 block rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-3 py-2"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="ck-label text-ck-text-secondary">N.º de seguimiento</span>
                        <input
                          name="trackingNumber"
                          defaultValue={r.trackingNumber ?? ""}
                          className="mt-1 block rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-3 py-2"
                        />
                      </label>
                      <label className="flex items-center gap-2 pb-2 text-sm">
                        <input type="checkbox" name="notify" defaultChecked />
                        Avisarle por email
                      </label>
                      <Button type="submit" size="sm">
                        Marcar despachado
                      </Button>
                    </form>
                  ) : null}
                  {status === "DISPATCHED" ? (
                    <>
                      <form action={markKitReturnedAction}>
                        <input type="hidden" name="shippingId" value={r.id} />
                        <ConfirmSubmitButton
                          confirmMessage="¿El correo devolvió este kit?"
                          variant="outline"
                          size="sm"
                        >
                          Volvió devuelto
                        </ConfirmSubmitButton>
                      </form>
                      <form action={markKitPendingAction}>
                        <input type="hidden" name="shippingId" value={r.id} />
                        <ConfirmSubmitButton
                          confirmMessage="¿Deshacer el despacho? Vuelve a «Por despachar»."
                          variant="text"
                          size="sm"
                        >
                          Deshacer despacho
                        </ConfirmSubmitButton>
                      </form>
                    </>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
