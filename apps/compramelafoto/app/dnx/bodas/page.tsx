import type { Metadata } from "next";

import BodasLanding from "@/components/dnx/bodas/BodasLanding";

export const metadata: Metadata = {
  title: "Fotografía de bodas en Rosario y Funes | DNX Fotografía",
  description:
    "Fotografía de bodas en Funes, Rosario y alrededores. Cobertura profesional, preparativos, ceremonia, fiesta, productos impresos y entrevista personalizada.",
  openGraph: {
    title: "Fotografía de bodas en Rosario y Funes | DNX Fotografía",
    description:
      "Fotografía de bodas en Funes, Rosario y alrededores. Cobertura profesional, preparativos, ceremonia, fiesta, productos impresos y entrevista personalizada.",
  },
};

export default function DnxBodasLandingPage() {
  return <BodasLanding mostrarPrecios />;
}
