import type { Metadata } from "next";
import { EditorialContainer, Section } from "@/components/foundations";
import { getInfoSpotSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Política editorial",
  description: "Criterios editoriales de Info Spot.",
  alternates: { canonical: "/politica-editorial" },
};

export default async function PoliticaEditorialPage() {
  const settings = await getInfoSpotSettings();

  return (
    <Section spacing="lg">
      <EditorialContainer className="max-w-3xl space-y-6">
        <p className="is-eyebrow">Redacción</p>
        <h1 className="is-h1 text-4xl">Política editorial</h1>
        <p className="text-[var(--is-text-secondary)]">
          {settings.siteName} prioriza claridad, cercanía y utilidad. Cubrimos eventos
          deportivos, culturales y sociales con mirada local y respeto por la autoría
          fotográfica.
        </p>
        <h2 className="text-xl font-semibold">Correcciones</h2>
        <p className="text-[var(--is-text-secondary)]">
          Si detectás un error factual, escribinos a{" "}
          {settings.contactEmail || "el email editorial configurado"}. Evaluamos
          correcciones y actualizaciones con criterio periodístico.
        </p>
        <h2 className="text-xl font-semibold">Créditos fotográficos</h2>
        <p className="text-[var(--is-text-secondary)]">
          Publicamos crédito cuando está disponible. El uso editorial de imágenes se
          acuerda con autores o con el ecosistema ComprameLaFoto cuando corresponde.
        </p>
        <h2 className="text-xl font-semibold">Independencia</h2>
        <p className="text-[var(--is-text-secondary)]">
          La agenda de eventos y las noticias se revisan editorialmente. La publicación
          gratuita de un evento no implica cobertura automática ni publicidad encubierta.
        </p>
        <h2 className="text-xl font-semibold">Solicitudes de baja o modificación</h2>
        <p className="text-[var(--is-text-secondary)]">
          Organizadores y personas mencionadas pueden pedir actualización o retiro de
          datos personales no públicos (email/teléfono) o corrección de información
          publicada, sujeto a revisión.
        </p>
      </EditorialContainer>
    </Section>
  );
}
