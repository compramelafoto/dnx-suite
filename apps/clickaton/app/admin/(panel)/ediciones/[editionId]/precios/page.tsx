import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { PricePhaseForm } from "@/components/admin/pricing/PricePhaseForm";
import { PricePhaseItemsPanel } from "@/components/admin/pricing/PricePhaseItemsPanel";
import { PricePhaseCompare } from "@/components/pricing/PricePhaseCompare";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { listProductsAction } from "@/lib/admin-catalog/actions/products";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { getEditionById } from "@/lib/admin/editions/queries";
import { createPricePhaseAction, setPricePhaseActiveAction } from "@/lib/admin/pricing/mutations";
import { listPricePhaseItems } from "@/lib/admin/pricing/phase-items";
import { getEditionPriceSnapshot } from "@/lib/admin/pricing/queries";
import {
  COMMERCIAL_REVIEW_NOTE,
  commercialToneToBadgeVariant,
  formatCommercialDateTime,
  presentPriceCompare,
  presentPricePhaseOperationalStatus,
} from "@/lib/admin/pricing/ui/commercial-status-presentation";
import { displayRegistrationAmount } from "@/lib/admin-registration/ui/status-labels";
import { findActivePhaseOverlaps } from "@/lib/pricing/domain/resolve-price-phase";
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
  const timezone = edition.timezone ?? "America/Argentina/Buenos_Aires";
  const snapshot = await getEditionPriceSnapshot(editionId);
  const phases = snapshot.ok ? snapshot.data.phases : [];
  const current = snapshot.ok ? snapshot.data.current : null;
  const next = snapshot.ok ? snapshot.data.next : null;
  const overlaps = findActivePhaseOverlaps(phases);
  const compare = presentPriceCompare({
    current: current
      ? {
          name: current.name,
          amount: current.amount,
          currency: current.currency,
          endsAt: current.endsAt,
        }
      : null,
    next: next
      ? {
          name: next.name,
          amount: next.amount,
          currency: next.currency,
          startsAt: next.startsAt,
        }
      : null,
    timezone,
  });

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
        title={`Fases de precio · ${edition.name}`}
        description="Definí cuánto costará la inscripción en cada período y qué beneficios estarán incluidos."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${edition.id}` },
          { label: "Fases de precio" },
        ]}
        actions={
          <Button href={`${adminRoutes.editions}/${edition.id}`} variant="secondary" className="min-h-11">
            Volver a la edición
          </Button>
        }
      />

      <Card variant="outlined" className="space-y-4 p-5 sm:p-6">
        <PricePhaseCompare compare={compare} />
        <p className="text-xs text-ck-text-muted">
          Horario de la edición: {timezone.replace(/_/g, " ")}.
        </p>
        {overlaps.length > 0 ? (
          <div
            className="rounded-[var(--ck-radius-sm)] border border-[var(--ck-warning)]/40 bg-[var(--ck-warning-soft)] px-4 py-3 text-sm"
            role="status"
          >
            <p className="font-semibold text-ck-text">Hay fases que se superponen</p>
            <p className="mt-1 text-ck-text-secondary">
              No puede haber dos fases vigentes al mismo tiempo. Revisá las fechas antes de
              habilitar más fases.
            </p>
            <ul className="mt-2 list-disc pl-5 text-ck-text-muted">
              {overlaps.map((o) => (
                <li key={`${o.aId}-${o.bId}`}>
                  {o.aName} y {o.bName}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-xs text-ck-text-muted">{COMMERCIAL_REVIEW_NOTE}</p>
      </Card>

      <Card variant="outlined" className="space-y-4 p-5">
        <h2 className="text-lg font-semibold text-ck-text">Fases configuradas</h2>
        {phases.length === 0 ? (
          <div className="space-y-2">
            <p className="font-medium text-ck-text">Todavía no configuraste fases de precio</p>
            <p className="text-sm text-ck-text-muted">
              Creá la primera fase para definir cuánto costará la inscripción.
            </p>
          </div>
        ) : (
          <>
            {/* Escritorio */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                <caption className="sr-only">Listado de fases de precio</caption>
                <thead>
                  <tr className="border-b border-ck-border text-ck-text-secondary">
                    <th scope="col" className="px-3 py-3 font-medium">
                      Nombre
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Precio
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Vigencia
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Estado
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Incluye
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {phases.map((phase) => {
                    const status = presentPricePhaseOperationalStatus(phase);
                    const phaseItems = itemsByPhase.get(phase.id) ?? [];
                    const includedNames = phaseItems
                      .filter((i) => i.isIncluded)
                      .map((i) => i.displayTitle?.trim() || i.product.name)
                      .slice(0, 3);
                    return (
                      <tr key={`row-${phase.id}`} className="border-b border-ck-border/80">
                        <td className="px-3 py-3 font-medium text-ck-text">{phase.name}</td>
                        <td className="px-3 py-3">
                          {displayRegistrationAmount(phase.amount, phase.currency)}
                        </td>
                        <td className="px-3 py-3 text-ck-text-muted">
                          {formatCommercialDateTime(phase.startsAt, timezone)} →{" "}
                          {formatCommercialDateTime(phase.endsAt, timezone)}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={commercialToneToBadgeVariant(status.tone)}>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-ck-text-secondary">
                          {includedNames.length
                            ? includedNames.join(", ")
                            : "Todavía no se definieron productos incluidos"}
                        </td>
                        <td className="px-3 py-3">
                          <a
                            href={`#fase-${phase.id}`}
                            className="inline-flex min-h-11 items-center text-sm font-medium text-ck-yellow underline-offset-2 hover:underline"
                          >
                            Abrir
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="space-y-8">
              {phases.map((phase) => {
                const phaseItems = itemsByPhase.get(phase.id) ?? [];
                const otherPhases = phases.filter((p) => p.id !== phase.id);
                const regCount =
                  registrationCounts.ok ? (registrationCounts.data.get(phase.id) ?? 0) : 0;
                const status = presentPricePhaseOperationalStatus(phase);
                const includedNames = phaseItems
                  .filter((i) => i.isIncluded)
                  .map((i) => i.displayTitle?.trim() || i.product.name);

                return (
                  <li
                    key={phase.id}
                    id={`fase-${phase.id}`}
                    className="space-y-4 border-b border-ck-border pb-8 last:border-0"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ck-text">{phase.name}</p>
                          <Badge variant={commercialToneToBadgeVariant(status.tone)}>
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-xl font-semibold text-ck-text">
                          {displayRegistrationAmount(phase.amount, phase.currency)}
                        </p>
                        <dl className="grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                              Comienza
                            </dt>
                            <dd className="text-ck-text-secondary">
                              {formatCommercialDateTime(phase.startsAt, timezone)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                              Finaliza
                            </dt>
                            <dd className="text-ck-text-secondary">
                              {formatCommercialDateTime(phase.endsAt, timezone)}
                            </dd>
                          </div>
                        </dl>
                        <p className="text-sm text-ck-text-muted">{status.description}</p>
                        <p className="text-sm text-ck-text-secondary">
                          {includedNames.length > 0
                            ? `Incluye: ${includedNames.join(", ")}.`
                            : "Todavía no se definieron los productos incluidos."}
                          {products.length === 0 ? (
                            <>
                              {" "}
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
                        <ConfirmSubmitButton
                          variant="secondary"
                          className="min-h-11 w-full sm:w-auto"
                          confirmMessage={
                            phase.isActive
                              ? "¿Desactivar esta fase? Dejará de aplicarse a nuevas inscripciones. Las inscripciones ya realizadas conservan su precio. Revisión comercial recomendada."
                              : "¿Habilitar esta fase? Podrá aplicarse según sus fechas de vigencia. Revisá que no se superponga con otra fase activa."
                          }
                        >
                          {phase.isActive ? "Desactivar fase" : "Habilitar fase"}
                        </ConfirmSubmitButton>
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

                    <AdminTechnicalInfo
                      title="Información técnica de la fase"
                      description="IDs y referencias de soporte. Cerrado por defecto."
                      rows={[
                        {
                          label: "ID de fase",
                          value: phase.id,
                          mono: true,
                          copyText: phase.id,
                        },
                        {
                          label: "Estado interno activo",
                          value: phase.isActive ? "true" : "false",
                          mono: true,
                        },
                        {
                          label: "Prioridad",
                          value: String(phase.priority),
                          mono: true,
                        },
                        {
                          label: "Monto (unidades menores)",
                          value: String(phase.amount),
                          mono: true,
                        },
                        {
                          label: "Inicio ISO",
                          value: phase.startsAt.toISOString(),
                          mono: true,
                        },
                        {
                          label: "Fin ISO",
                          value: phase.endsAt.toISOString(),
                          mono: true,
                        },
                        {
                          label: "Inscripciones asociadas",
                          value: String(regCount),
                          mono: true,
                        },
                      ]}
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <Card variant="outlined" className="space-y-4 p-5">
        <h2 className="text-lg font-semibold text-ck-text">Crear fase</h2>
        <p className="text-sm text-ck-text-muted">
          El sistema determina cuál fase está vigente según las fechas. No se confía en montos del
          navegador para el cobro.
        </p>
        <PricePhaseForm action={createAction} submitLabel="Crear fase" />
      </Card>
    </div>
  );
}
