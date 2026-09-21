import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { MembershipApplicationForm } from "@/components/membership/application-form";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { getActiveFeeValue, getDuesSettings } from "@/lib/membership/settings";
import { normalizeRecommendationCode } from "@/lib/membership/recommendation-code";
import { resolveRecommender } from "@/lib/membership/recommendation-link";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceSlug: string }>;
  /** `?rec=` es el enlace de recomendación de un socio. Ausente o inválido, el alta sigue igual. */
  searchParams: Promise<{ rec?: string }>;
};

const ars = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2 });

/**
 * Formulario público de asociación.
 *
 * **No se publica si la institución no puede cobrar.** El guard va acá, en el origen: si el
 * formulario estuviera abierto sin cobros conectados, la persona completaría todo, la
 * Secretaría aprobaría, y recién ahí se descubriría que nadie puede pagar. Cortar antes
 * cuesta una pantalla; cortar después cuesta la confianza de quien se quiso asociar.
 */
export default async function AsociarsePage({ params, searchParams }: Props) {
  const { workspaceSlug } = await params;
  const { rec } = await searchParams;

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!branding) notFound();

  // Sin el módulo habilitado esta página no existe — antes se entraba igual con la dirección
  // exacta. Mismo criterio que /reservas.
  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, MEMBERS_MODULE_KEY))) notFound();

  const [cobros, settings, valorCuota, workspace, v] = await Promise.all([
    getWorkspaceCollectionStatus(branding.workspaceId),
    getDuesSettings(branding.workspaceId),
    getActiveFeeValue(branding.workspaceId, null, new Date()),
    prisma.workspace.findUnique({
      where: { id: branding.workspaceId },
      select: { name: true },
    }),
    loadPersonVocabulary(branding.workspaceId),
  ]);

  /*
    Quién lo recomienda se resuelve en el servidor y contra el padrón. Si el código no
    existe, es de otra institución o el socio está de baja, no se muestra nada y el
    formulario funciona igual: un enlace viejo no puede dejar a nadie afuera.
  */
  const code = normalizeRecommendationCode(rec);
  const candidato = code
    ? await prisma.member.findUnique({
        where: { recommendationCode: code },
        select: { id: true, workspaceId: true, status: true, firstName: true, lastName: true },
      })
    : null;
  const recomendante = resolveRecommender({
    rawCode: rec,
    workspaceId: branding.workspaceId,
    candidate: candidato,
  });

  const institutionName = branding.commercialName?.trim() || workspace?.name || "la institución";

  // Sin cobros conectados o sin valor de cuota, aprobar generaría cuotas impagables.
  const abierto = cobros.canCharge && Boolean(valorCuota);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Asociarse a {institutionName}
        </h1>
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
          Completá tus datos y la Secretaría va a revisar tu solicitud. Te escribimos por
          email en cuanto haya respuesta, sea cual sea.
        </p>
      </div>

      {abierto ? (
        <MembershipApplicationForm
          workspaceSlug={workspaceSlug}
          institutionName={institutionName}
          monthlyAmountLabel={valorCuota ? `$${ars.format(Number(valorCuota.amountArs))}` : null}
          initialDuesCount={settings.initialDuesCount}
          recommendation={
            recomendante && code ? { code, displayName: recomendante.displayName } : null
          }
          vocabulary={v}
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
  );
}
