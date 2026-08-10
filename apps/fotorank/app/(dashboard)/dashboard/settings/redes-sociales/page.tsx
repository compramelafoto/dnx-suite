import { PageContainer } from "../../../../components/PageContainer";
import { PageInfoRecuadro } from "../../../../components/ui/PageInfoRecuadro";
import { getSocialConnectionsForActiveOrg } from "./actions";

function permIcon(ok: boolean) {
  return ok ? "✓" : "✕";
}

export default async function RedesSocialesSettingsPage() {
  const res = await getSocialConnectionsForActiveOrg();

  if (!res.ok) {
    return (
      <PageContainer
        title="Redes sociales"
        description="Conectá cuentas Instagram de la organización para votación pública."
      >
        <PageInfoRecuadro variant="warning">
          <p className="fr-body text-amber-100">{res.error}</p>
        </PageInfoRecuadro>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Redes sociales"
      description="Las conexiones pertenecen a la organización activa. Un concurso selecciona una cuenta autorizada al configurar voto público con Instagram."
    >
      <PageInfoRecuadro variant="warningSoft">
        <p className="fr-body-small text-fr-muted">
          <strong className="text-fr-primary">LEGAL/PRIVACY REVIEW REQUIRED.</strong> La conexión
          social almacena identificadores de cuenta y referencias opacas a tokens (nunca texto plano
          en logs). Revisión legal antes de uso comercial.
        </p>
      </PageInfoRecuadro>

      <div className="fr-recuadro fr-card mt-10 space-y-8">
        <div>
          <p className="fr-eyebrow">Organización</p>
          <p className="mt-4 text-lg font-semibold text-fr-primary">{res.organizationName}</p>
        </div>

        {res.connections.length === 0 ? (
          <p className="fr-body text-fr-muted">
            No hay cuentas Instagram conectadas. Usá el flujo OAuth desde el panel de jurado o el
            callback de desarrollo cuando esté disponible.
          </p>
        ) : (
          <ul className="space-y-8">
            {res.connections.map((c) => (
              <li key={c.id} className="rounded-xl border border-fr-border p-8 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-gold">
                      Instagram — {c.connectionStatus}
                    </p>
                    <p className="mt-4 text-xl font-semibold text-fr-primary">
                      @{c.accountUsername ?? c.accountId}
                    </p>
                    <p className="mt-2 text-sm text-fr-muted">Health: {c.health}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-fr-primary">Permisos</p>
                  <ul className="mt-4 space-y-2 text-sm text-fr-muted">
                    <li>Publicar contenido {permIcon(c.permissions.publish)}</li>
                    <li>Leer métricas {permIcon(c.permissions.readMetrics)}</li>
                    <li>Insights {permIcon(c.permissions.insights)}</li>
                    <li>Webhooks (likes) {permIcon(c.permissions.webhooks)}</li>
                  </ul>
                </div>

                <p className="text-xs text-fr-muted">
                  Última verificación:{" "}
                  {c.lastValidatedAt ? new Date(c.lastValidatedAt).toLocaleString("es-AR") : "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
