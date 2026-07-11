import type { Metadata } from "next";
import { EditorialContainer, Section } from "@/components/foundations";
import { getInfoSpotSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Términos de uso de Info Spot.",
  alternates: { canonical: "/terminos" },
};

export default async function TerminosPage() {
  const settings = await getInfoSpotSettings();

  return (
    <Section spacing="lg">
      <EditorialContainer className="max-w-3xl space-y-6">
        <p className="is-eyebrow">Legal</p>
        <h1 className="is-h1 text-4xl">Términos de uso</h1>
        <p className="text-[var(--is-text-secondary)]">
          Al usar {settings.siteName} aceptás estos términos. El medio publica información
          periodística y agenda de eventos; no garantiza la exactitud de datos enviados por
          terceros hasta su revisión editorial.
        </p>
        <h2 className="text-xl font-semibold">Publicación de eventos</h2>
        <p className="text-[var(--is-text-secondary)]">
          Los envíos públicos entran en revisión. Info Spot puede editar, rechazar o
          archivar contenidos que no cumplan criterios editoriales o de seguridad.
        </p>
        <h2 className="text-xl font-semibold">Contenido de terceros</h2>
        <p className="text-[var(--is-text-secondary)]">
          Enlaces externos (inscripciones, sitios de organizadores) son responsabilidad de
          sus titulares. No inventamos datos de contacto ni domicilios.
        </p>
        <h2 className="text-xl font-semibold">Propiedad intelectual</h2>
        <p className="text-[var(--is-text-secondary)]">
          Textos, marca y diseño de Info Spot están protegidos. Las fotografías pertenecen a
          sus autores según los créditos publicados.
        </p>
        <h2 className="text-xl font-semibold">Contacto</h2>
        <p className="text-[var(--is-text-secondary)]">
          Consultas: {settings.contactEmail || "email editorial (pendiente de configuración)"}.
        </p>
      </EditorialContainer>
    </Section>
  );
}
