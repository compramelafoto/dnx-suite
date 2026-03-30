import { PageContainer } from "../../components/PageContainer";
import { PageInfoRecuadro } from "../../components/ui/PageInfoRecuadro";

export default function CategoriasPage() {
  return (
    <PageContainer
      title="Categorías"
      description="Administra las categorías en las que se pueden participar los concursos."
    >
      <PageInfoRecuadro variant="placeholder" className="mt-8">
        <p className="fr-body text-fr-muted">
          Las categorías se definen por concurso. Abrí un concurso en Concursos para gestionarlas.
        </p>
      </PageInfoRecuadro>
    </PageContainer>
  );
}
