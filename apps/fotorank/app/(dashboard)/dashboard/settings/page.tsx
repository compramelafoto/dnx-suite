import { PageContainer } from "../../../components/PageContainer";
import { PageInfoRecuadro } from "../../../components/ui/PageInfoRecuadro";
import { getActiveOrganizationProfileForSettings } from "../../../actions/organization-institutional";
import { InstitutionalSettingsForm } from "./InstitutionalSettingsForm";

export default async function DashboardInstitutionalSettingsPage() {
  const res = await getActiveOrganizationProfileForSettings();

  if (!res.ok) {
    return (
      <PageContainer
        title="Perfil institucional"
        description="Configurá los datos de tu organización para el panel y las landings públicas."
      >
        <PageInfoRecuadro variant="warning">
          <p className="fr-body text-amber-100">{res.error}</p>
        </PageInfoRecuadro>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Perfil institucional"
      description="Esta información se aplica a todos los concursos de la organización activa y refuerza la confianza en las landings públicas."
    >
      <InstitutionalSettingsForm profile={res.profile} />
    </PageContainer>
  );
}
