import Link from "next/link";
import { PageContainer } from "../../components/PageContainer";
import { PageInfoRecuadro } from "../../components/ui/PageInfoRecuadro";

export default function DiplomasPage() {
  return (
    <PageContainer
      title="Diplomas"
      description="Emisión con plantilla estructurada, PDF/PNG, QR y verificación pública por concurso."
    >
      <PageInfoRecuadro className="mt-8">
        <p className="fr-body text-fr-muted">
          Los diplomas se emiten desde cada concurso: abrí un concurso y usá el botón de recibo en el encabezado, o la ruta
          <span className="font-mono text-fr-primary"> /dashboard/concursos/[id]/diplomas</span>.
        </p>
        <Link href="/concursos" className="fr-btn fr-btn-primary mt-8 inline-flex">
          Ir a concursos
        </Link>
      </PageInfoRecuadro>
    </PageContainer>
  );
}
