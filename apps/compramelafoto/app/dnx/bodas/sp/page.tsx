import type { Metadata } from "next";

import BodasLanding from "@/components/dnx/bodas/BodasLanding";

/**
 * Versión de presentación, sin importes. Es la que se manda en el primer
 * contacto: muestra el trabajo y qué incluye cada propuesta, y deja el
 * precio para la conversación posterior.
 *
 * Va con `noindex` a propósito: comparte casi todo el contenido con
 * /dnx/bodas y no queremos que Google la trate como contenido duplicado
 * ni que se la muestre a quien está buscando precios.
 */
export const metadata: Metadata = {
  title: "Fotografía de bodas en Rosario y Funes | DNX Fotografía",
  description:
    "Fotografía de bodas en Funes, Rosario y alrededores. Cobertura profesional, preparativos, ceremonia, fiesta, productos impresos y entrevista personalizada.",
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: "Fotografía de bodas en Rosario y Funes | DNX Fotografía",
    description:
      "Fotografía de bodas en Funes, Rosario y alrededores. Cobertura profesional, preparativos, ceremonia, fiesta, productos impresos y entrevista personalizada.",
  },
};

export default function DnxBodasPresentacionPage() {
  return <BodasLanding mostrarPrecios={false} />;
}
