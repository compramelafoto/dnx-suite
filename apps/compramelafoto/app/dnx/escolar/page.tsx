import type { Metadata } from "next";

import EscolarLanding from "@/components/dnx/escolar/EscolarLanding";
import { DNX_ESCOLAR_BRAND } from "@/lib/dnx-escolar/landing-brand";

const TITLE = "Fotografía escolar en Rosario, Funes y Roldán | DNX Estudio";
const DESCRIPTION =
  "DNX Estudio hace las fotos del colegio; las familias eligen, pagan online y reciben sus imágenes. Sin cobros ni pedidos en la secretaría, y con beneficio acordado para la institución.";
const CANONICAL = "https://www.compramelafoto.com/dnx/escolar";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL,
    type: "website",
    locale: "es_AR",
    images: [{ url: "/dnx/logo-dnx.png", width: 512, height: 512, alt: "Logo DNX Estudio" }],
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/dnx/logo-dnx.png"],
  },
};

export default function DnxEscolarLandingPage() {
  return <EscolarLanding brand={DNX_ESCOLAR_BRAND} />;
}
