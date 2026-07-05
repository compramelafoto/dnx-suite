import type { Metadata } from "next";
import SchoolLeadsLandingClient from "@/components/land/escuelas-leads/SchoolLeadsLandingClient";

export const dynamic = "force-dynamic";

const OG_IMAGE_URL =
  "https://www.compramelafoto.com/images/landescolar/escuela-principal-2026.png";

export const metadata: Metadata = {
  title: "Solicitudes de escuelas | ComprameLaFoto",
  description:
    "Completá la solicitud para implementar ComprameLaFoto en tu escuela y coordinar una conversación directa por WhatsApp.",
  openGraph: {
    title: "ComprameLaFoto para escuelas",
    description:
      "Organización escolar de fotos, preventa, links para familias y menos carga administrativa.",
    images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: "Fotografía escolar" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Solicitudes de escuelas | ComprameLaFoto",
    description:
      "Solicitá información para implementar ComprameLaFoto en tu institución educativa.",
    images: [OG_IMAGE_URL],
  },
};

export default function EscuelasLeadsPage() {
  return <SchoolLeadsLandingClient />;
}
