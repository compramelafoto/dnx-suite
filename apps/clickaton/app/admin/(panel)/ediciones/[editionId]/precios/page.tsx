import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PricePhaseForm } from "@/components/admin/pricing/PricePhaseForm";
import { PricePhaseItemsPanel } from "@/components/admin/pricing/PricePhaseItemsPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { listProductsAction } from "@/lib/admin-catalog/actions/products";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { formatAdminDateTime } from "@/lib/admin/datetime-input";
import { getEditionById } from "@/lib/admin/editions/queries";
import { createPricePhaseAction, setPricePhaseActiveAction } from "@/lib/admin/pricing/mutations";
import { listPricePhaseItems } from "@/lib/admin/pricing/phase-items";
import { getEditionPriceSnapshot } from "@/lib/admin/pricing/queries";
import { displayRegistrationAmount } from "@/lib/admin-registration/ui/status-labels";
import { prisma, withClickatonDb } from "@/lib/admin/db";

type Props = {
  params: Promise<{ editionId: string }>;
};

export default async function EditionPricingPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;

  const editionResult = await getEditionById(editionId);
  if (!editionResult.ok) {
    return (
      <div className="space-y-6">
        <AdminMigrationNotice message={editionResult.message} />
      </div>
    );
  }
  if (!editionResult.data) notFound();

  const edition = editionResult.data;
  const snapshot = await getEditionPriceSnapshot(editionId);
  const phases = snapshot.ok ? snapshot.data.phases : [];
  const current = snapshot.ok ? snapshot.data.current : null;
  const next = snapshot.ok ? snapshot.data.next : null;

  const createAction = createPricePhaseAction.bind(null, editionId);

  const productsResult = await listProductsAction({ editionId });
  const products = productsResult.ok && productsResult.data ? productsResult.data : [];

  const phaseItemsResults = await Promise.all(
    phases.map((phase) => listPricePhaseItems(phase.id)),
  );
  const itemsByPhase = new Map(
    phases.map((phase, idx) => [
      phase.id,
      phaseItemsResults[idx]?.ok ? phaseItemsResults[idx]!.data! : [],
    ]),
  );

  const registrationCounts = await withClickatonDb(async () => {
    const counts = await Promise.all(
      phases.map((phase) =>
        prisma.clickatonRegistration.count({
          where: {
            pricePhaseId: phase.id,
            status: { notIn: ["CANCELLED", "REFUNDED"] },
          },
        }),
      ),
    );
    return new Map(phases.map((phase, idx) => [phase.id, counts[idx] ?? 0]));
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`Precios — ${edition.name}`}
        description="Fases configurables. Una sola fase vigente a la vez (sin solapes activos)."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${edition.id}` },
          { label: "Precios" },
        ]}
        actions={
          <Button href={`${adminRoutes.editions}/${edition.id}`} variant="secondary">
            Volver a edición
          </Button>
        }
      />

      <Card variant="outlined" className="space-y-3 p-5">
        <p className="text-sm text-ck-text">
          <span className="text-ck-text-muted">Vigente ahora: </span>
          {current
            ? `${current.name} — ${displayRegistrationAmount(current.amount, current.currency)}`
            : "Ninguna fase vigente"}
        </p>
        <p className="text-sm text-ck-text">
          <span className="text-ck-text-muted">Próxima subida: </span>
          {next
            ? `${next.name} — ${displayRegistrationAmount(next.amount, next.currency)} (desde ${formatAdminDateTime(next.startsAt, edition.timezone ?? undefined)})`
            : "—"}
        </p>
      </Card>

      <Card variant="outlined" className="space-y-4 p-5">
        <h2 className="text-lg font-semibold text-ck-text">Fases</h2>
        {phases.length === 0 ? (
          <p className="text-sm text-ck-text-muted">Todavía no hay fases. Creá la primera abajo.</p>
        ) : (
          <ul className="space-y-8">
            {phases.map((phase) => {
              const phaseItems = itemsByPhase.get(phase.id) ?? [];
              const otherPhases = phases.filter((p) => p.id !== phase.id);
              const regCount =
                registrationCounts.ok ? (registrationCounts.data.get(phase.id) ?? 0) : 0;

              return (
                <li key={phase.id} className="space-y-4 border-b border-ck-border pb-8 last:border-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-ck-text">
                        {phase.name}{" "}
                        <span className="text-sm text-ck-text-muted">
                          ({phase.isActive ? "activa" : "inactiva"})
                        </span>
                      </p>
                      <p className="text-sm text-ck-text">
                        {displayRegistrationAmount(phase.amount, phase.currency)}
                      </p>
                      <p className="text-xs text-ck-text-muted">
                        {formatAdminDateTime(phase.startsAt, edition.timezone ?? undefined)} →{" "}
                        {formatAdminDateTime(phase.endsAt, edition.timezone ?? undefined)}
                      </p>
                      <p className="text-xs text-ck-text-muted">
                        {phaseItems.length} producto(s) incluido(s)
                        {products.length === 0 ? (
                          <>
                            {" "}
                            ·{" "}
                            <Link
                              className="text-ck-yellow underline"
                              href={catalogAdminRoutes.editionCatalog(editionId)}
                            >
                              Crear productos
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await setPricePhaseActiveAction(editionId, phase.id, !phase.isActive);
                      }}
                    >
                      <Button type="submit" variant="secondary">
                        {phase.isActive ? "Desactivar" : "Activar"}
                      </Button>
                    </form>
                  </div>

                  <PricePhaseItemsPanel
                    editionId={editionId}
                    phase={phase}
                    items={phaseItems}
                    products={products}
                    otherPhases={otherPhases}
                    registrationCount={regCount}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-ck-text-muted">
          Tip: fechas en zona {edition.timezone ?? "America/Argentina/Buenos_Aires"}. Edición de
          montos/fechas: recrear fase o ampliar UI en etapa siguiente.{" "}
          <Link className="underline" href={`${adminRoutes.editions}/${edition.id}`}>
            Volver
          </Link>
        </p>
      </Card>

      <PricePhaseForm action={createAction} submitLabel="Crear fase" />
    </div>
  );
}
