import type { Metadata } from "next";

import XvLanding from "@/components/dnx/xv/XvLanding";

/**
 * Versión de presentación, sin importes. Es la que se manda en el primer
 * contacto: muestra el trabajo y qué incluye cada propuesta, y deja el
 * precio para la conversación posterior.
 *
 * Va con `noindex` a propósito: comparte casi todo el contenido con
 * /dnx/xv y no queremos que Google la trate como contenido duplicado ni
 * que se la muestre a quien está buscando precios.
 */
export const metadata: Metadata = {
  title: "Fotografía de XV en Rosario y Funes | DNX Estudio",
  description:
    "Sesiones PRE XV, cobertura de fiestas de quince, productos impresos y experiencia fotográfica personalizada en Funes, Rosario y alrededores.",
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: "Fotografía de XV en Rosario y Funes | DNX Estudio",
    description:
      "Sesiones PRE XV, cobertura de fiestas de quince, productos impresos y experiencia fotográfica personalizada en Funes, Rosario y alrededores.",
    images: [
      {
        url: "/dnx/logo-dnx.png",
        width: 512,
        height: 512,
        alt: "Logo DNX Estudio",
      },
    ],
  },
};

export default function DnxXvPresentacionPage() {
  return <XvLanding mostrarPrecios={false} />;
}
