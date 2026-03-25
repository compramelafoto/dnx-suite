import { PageContainer } from "../../../components/PageContainer";
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
        <div className="fr-recuadro border-amber-500/30 bg-amber-500/5 text-sm text-amber-100">{res.error}</div>
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
