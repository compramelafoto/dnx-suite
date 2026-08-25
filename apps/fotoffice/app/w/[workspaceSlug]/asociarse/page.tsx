import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { MembershipApplicationForm } from "@/components/membership/application-form";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { getActiveFeeValue, getDuesSettings } from "@/lib/membership/settings";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string }> };

const ars = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2 });

/**
 * Formulario público de asociación.
 *
 * **No se publica si la institución no puede cobrar.** El guard va acá, en el origen: si el
 * formulario estuviera abierto sin cobros conectados, la persona completaría todo, la
 * Secretaría aprobaría, y recién ahí se descubriría que nadie puede pagar. Cortar antes
 * cuesta una pantalla; cortar después cuesta la confianza de quien se quiso asociar.
 */
export default async function AsociarsePage({ params }: Props) {
  const { workspaceSlug } = await params;

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!branding) notFound();

  const [cobros, settings, valorCuota, workspace] = await Promise.all([
    getWorkspaceCollectionStatus(branding.workspaceId),
    getDuesSettings(branding.workspaceId),
    getActiveFeeValue(branding.workspaceId, null, new Date()),
    prisma.workspace.findUnique({
      where: { id: branding.workspaceId },
      select: { name: true },
    }),
  ]);

  const institutionName = branding.commercialName?.trim() || workspace?.name || "la institución";

  // Sin cobros conectados o sin valor de cuota, aprobar generaría cuotas impagables.
  const abierto = cobros.canReceiveSplit && Boolean(valorCuota);

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-2xl px-4 py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Asociarse a {institutionName}
          </h1>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Completá tus datos y la Secretaría va a revisar tu solicitud.
          </p>
        </header>

        {abierto ? (
          <MembershipApplicationForm
            workspaceSlug={workspaceSlug}
            institutionName={institutionName}
            monthlyAmountLabel={valorCuota ? `$${ars.format(Number(valorCuota.amountArs))}` : null}
            initialDuesCount={settings.initialDuesCount}
          />
        ) : (
          <section className="fo-card space-y-2 p-6">
            <h2 className="text-base font-semibold">Las inscripciones no están abiertas</h2>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              {institutionName} todavía no habilitó la asociación en línea. Escribinos y te
              contamos cómo asociarte.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
