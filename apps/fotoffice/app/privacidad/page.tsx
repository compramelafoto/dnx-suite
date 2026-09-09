import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { PRIVACY_SECTIONS } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Política de Privacidad | Fotoffice",
  description:
    "Qué datos trata Fotoffice, para qué los usa y con quién los comparte. Incluye el uso de los datos de Google Calendar.",
};

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Política de Privacidad"
      intro="Qué datos tratamos, para qué los usamos y qué podés pedirnos. Escrito para leerse, no para firmarse a ciegas."
      sections={PRIVACY_SECTIONS}
      otherHref="/terminos"
      otherLabel="Términos y Condiciones"
    />
  );
}
