import type { Metadata } from "next";
import { EditorialContainer, Section } from "@/components/foundations";
import { getInfoSpotSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Política de privacidad de Info Spot.",
  alternates: { canonical: "/privacidad" },
};

export default async function PrivacidadPage() {
  const settings = await getInfoSpotSettings();
  const email = settings.contactEmail;

  return (
    <Section spacing="lg">
      <EditorialContainer className="prose-neutral max-w-3xl space-y-6">
        <p className="is-eyebrow">Legal</p>
        <h1 className="is-h1 text-4xl">Privacidad</h1>
        <p className="text-[var(--is-text-secondary)]">
          Esta política describe cómo Info Spot trata datos personales en el marco de un
          medio digital argentino. Los datos societarios o fiscales adicionales se
          completarán cuando estén disponibles en la configuración del medio.
        </p>
        <h2 className="text-xl font-semibold">Qué datos podemos recibir</h2>
        <ul className="list-disc space-y-2 pl-5 text-[var(--is-text-secondary)]">
          <li>Formularios de publicación de eventos (nombre, email, teléfono opcional del organizador).</li>
          <li>Consultas por correo electrónico a canales editoriales o de prensa.</li>
          <li>Datos técnicos mínimos de seguridad (por ejemplo, hash de IP en envíos públicos).</li>
        </ul>
        <h2 className="text-xl font-semibold">Uso</h2>
        <p className="text-[var(--is-text-secondary)]">
          Usamos los datos para revisar y publicar contenido, contactar organizadores o
          colaboradores, y proteger el sitio frente a abuso. El email y teléfono del
          organizador no se muestran en fichas públicas.
        </p>
        <h2 className="text-xl font-semibold">Imágenes y créditos</h2>
        <p className="text-[var(--is-text-secondary)]">
          Las fotografías publicadas respetan créditos cuando están disponibles. El uso
          editorial de imágenes se rige por acuerdos con autores y por la política editorial.
        </p>
        <h2 className="text-xl font-semibold">Derechos</h2>
        <p className="text-[var(--is-text-secondary)]">
          Podés solicitar acceso, corrección o baja de datos personales escribiendo a{" "}
          {email ? (
            <a className="text-[var(--is-accent)] hover:underline" href={`mailto:${email}`}>
              {email}
            </a>
          ) : (
            "el email editorial configurado en el medio"
          )}
          .
        </p>
      </EditorialContainer>
    </Section>
  );
}
