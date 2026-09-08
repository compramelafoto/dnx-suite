import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { getModuleDefinition } from "@/lib/modules/registry";
import { listIntegrations } from "@/lib/integrations/registry";
import { listIntegrationSummaries } from "@/lib/integrations/store";
import { integrationErrorMessage, integrationOkMessage } from "@/lib/integrations/messages";
import { DisconnectButton } from "./disconnect-button";

export const dynamic = "force-dynamic";

/**
 * Las cuentas de terceros de la institución, en un solo lugar.
 *
 * Vive acá y no dentro de cada módulo porque la misma cuenta de Google sirve a Calendar
 * (Reservas), Classroom (Cursos) y Contacts (Socios). Repartir la conexión entre las
 * pantallas de cada módulo obligaría a conectar la misma cuenta tres veces y dejaría al
 * dueño sin un lugar donde ver qué le dio a la plataforma.
 *
 * Ver la enmienda a `docs/fotoffice/ARQUITECTURA-NAVEGACION.md` §4.6.
 */
export default async function IntegracionesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const params = await searchParams;
  const [role, conectadas] = await Promise.all([
    resolveWorkspaceRole(user.id, workspace.id),
    listIntegrationSummaries(workspace.id),
  ]);
  if (!canManageWorkspaceSettings(role)) redirect("/workspace/configuracion");

  const porClave = new Map(conectadas.map((c) => [c.integrationKey, c]));
  const disponibles = listIntegrations({ status: "AVAILABLE" });

  const errorMessage = integrationErrorMessage(params.error ?? null);
  const okMessage = integrationOkMessage(params.ok ?? null);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integraciones"
        description="Cuentas de servicios externos que la institución vincula a FotoOffice. Se conectan una vez y las usan todos los módulos que las necesiten."
      />

      {okMessage ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">{okMessage}</p>
      ) : null}

      {errorMessage ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-4">
        {disponibles.map((integration) => {
          const conectada = porClave.get(integration.key);
          const modulos = integration.requiredByModules
            .map((key) => getModuleDefinition(key)?.label)
            .filter((label): label is string => Boolean(label));

          return (
            <section key={integration.key} className="fo-card space-y-4 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1 min-w-0">
                  <h2 className="text-base font-semibold">{integration.label}</h2>
                  <p className="text-sm text-[var(--fo-muted)] leading-relaxed max-w-2xl">
                    {integration.description}
                  </p>
                  {modulos.length > 0 ? (
                    <p className="text-xs text-[var(--fo-muted-soft)]">
                      La usa: {modulos.join(", ")}.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col items-start gap-2 shrink-0 sm:items-end">
                  {conectada?.status === "ACTIVE" ? (
                    <>
                      <span className="text-xs font-medium text-[var(--fo-success)]">
                        Conectada
                      </span>
                      <span className="text-sm font-medium">{conectada.accountEmail}</span>
                      <span className="text-xs text-[var(--fo-muted-soft)]">
                        Desde el {conectada.connectedAt.toLocaleDateString("es-AR")}
                      </span>
                      <DisconnectButton
                        integrationKey={integration.key}
                        label={integration.label}
                        consequence="lo que depende de esta cuenta deja de sincronizar. Lo ya creado no se borra."
                      />
                    </>
                  ) : conectada?.status === "NEEDS_RECONSENT" ? (
                    <>
                      <span className="text-xs font-medium text-[var(--fo-danger)]">
                        Necesita reconexión
                      </span>
                      <span className="text-sm font-medium">{conectada.accountEmail}</span>
                      <p className="text-xs text-[var(--fo-muted)] max-w-xs sm:text-right leading-relaxed">
                        El permiso se revocó desde la cuenta de Google.
                      </p>
                      <Link
                        href={`/api/integrations/google/connect?integration=${integration.key}`}
                        prefetch={false}
                        className="fo-btn fo-btn-primary text-sm inline-flex"
                      >
                        Volver a conectar
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={`/api/integrations/google/connect?integration=${integration.key}`}
                      prefetch={false}
                      className="fo-btn fo-btn-primary text-sm inline-flex"
                    >
                      Conectar
                    </Link>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
