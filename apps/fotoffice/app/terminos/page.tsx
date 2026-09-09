import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { TERMS_SECTIONS } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Términos y Condiciones | Fotoffice",
  description:
    "Las condiciones de uso de Fotoffice para las instituciones y para sus socios: cuentas, pagos, reservas e integraciones.",
};

export default function TerminosPage() {
  return (
    <LegalPage
      title="Términos y Condiciones"
      intro="Las reglas de uso de la plataforma, para la institución que la contrata y para el socio que entra a su portal."
      sections={TERMS_SECTIONS}
      otherHref="/privacidad"
      otherLabel="Política de Privacidad"
    />
  );
}
