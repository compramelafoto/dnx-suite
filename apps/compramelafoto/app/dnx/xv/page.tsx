import type { Metadata } from "next";

import XvLanding from "@/components/dnx/xv/XvLanding";

export const metadata: Metadata = {
  title: "Fotografía de XV en Rosario y Funes | DNX Estudio",
  description:
    "Sesiones PRE XV, cobertura de fiestas de quince, productos impresos y experiencia fotográfica personalizada en Funes, Rosario y alrededores.",
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
  twitter: {
    card: "summary",
    title: "Fotografía de XV en Rosario y Funes | DNX Estudio",
    description:
      "Sesiones PRE XV, cobertura de fiestas de quince, productos impresos y experiencia fotográfica personalizada en Funes, Rosario y alrededores.",
    images: ["/dnx/logo-dnx.png"],
  },
};

export default function DnxXvLandingPage() {
  // Sin importes: el precio sale del presupuesto que arma FOTOFFICE con la consulta del formulario.
  return <XvLanding mostrarPrecios={false} pagina="xv" />;
}
