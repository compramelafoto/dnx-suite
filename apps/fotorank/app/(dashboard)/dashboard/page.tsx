import { PageContainer } from "../../components/PageContainer";
import { getUserOrganizations } from "../../lib/fotorank/organizations";
import { requireAuth } from "../../lib/auth";

export default async function DashboardPage() {
  const user = await requireAuth();
  const orgs = await getUserOrganizations(user.id);
  const firstOrg = orgs[0];

  return (
    <PageContainer
      title="Dashboard"
      description={
        firstOrg
          ? `Bienvenido a ${firstOrg.name}. Desde aquí podrás gestionar concursos y participaciones.`
          : "Vista general del sistema de concursos fotográficos. Aquí podrás ver estadísticas y actividad reciente."
      }
    />
  );
}
