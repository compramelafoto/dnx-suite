import { PageContainer } from "../../components/PageContainer";
import { PageInfoRecuadro } from "../../components/ui/PageInfoRecuadro";

export default function ParticipacionesPage() {
  return (
    <PageContainer
      title="Participaciones"
      description="Consulta y gestiona las participaciones de los fotógrafos en los concursos."
    >
      <PageInfoRecuadro variant="placeholder" className="mt-8">
        <p className="fr-body text-fr-muted">Esta sección está en desarrollo.</p>
      </PageInfoRecuadro>
    </PageContainer>
  );
}
