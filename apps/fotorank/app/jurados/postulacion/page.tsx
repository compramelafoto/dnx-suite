import type { Metadata } from "next";

import { PageContainer, PublicShell } from "../../components/public-ui";
import { PostulacionForm } from "./PostulacionForm";

export const metadata: Metadata = {
  title: "Postularte como jurado — FotoRank",
  description:
    "Presentá tu ficha para que los organizadores de concursos de FotoRank puedan convocarte como jurado.",
};

export default function PostulacionDeJuradoPage() {
  return (
    <PublicShell header={{ variant: "contest", panelHref: "/jurado/panel" }}>
      <section className="fr-public-section">
        <PageContainer className="max-w-3xl">
          <header className="space-y-3">
            <h1 className="fr-public-title text-3xl md:text-4xl">Postularte como jurado</h1>
            <p className="fr-public-body">
              Contanos quién sos y qué hacés. Si aprobamos tu ficha, los organizadores de
              concursos van a poder encontrarte y proponerte que integres su jurado.
            </p>
          </header>

          <div className="fr-public-stack-content">
            <PostulacionForm />
          </div>
        </PageContainer>
      </section>
    </PublicShell>
  );
}
