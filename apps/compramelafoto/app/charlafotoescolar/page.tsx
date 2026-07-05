import type { Metadata } from "next";
import CharlaFotoEscolarClient from "@/components/land/charla-foto-escolar/CharlaFotoEscolarClient";

export const metadata: Metadata = {
  title: "Automatizá tu negocio de fotografía escolar | ComprameLaFoto",
  description:
    "Charla gratuita para fotógrafos argentinos. Descubrí cómo ordenar pedidos, automatizar procesos y vender fotografía escolar de forma mucho más simple.",
  openGraph: {
    title: "Automatizá tu negocio de fotografía escolar | ComprameLaFoto",
    description:
      "Charla gratuita para fotógrafos argentinos. Descubrí cómo ordenar pedidos, automatizar procesos y vender fotografía escolar de forma mucho más simple.",
    images: [
      {
        url: "/charla-foto-escolar-flyer.png",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Automatizá tu negocio de fotografía escolar | ComprameLaFoto",
    description:
      "Charla gratuita para fotógrafos argentinos. Descubrí cómo ordenar pedidos, automatizar procesos y vender fotografía escolar de forma mucho más simple.",
    images: ["/charla-foto-escolar-flyer.png"],
  },
};

export default function CharlaFotoEscolarPage() {
  return (
    <CharlaFotoEscolarClient
      talkSlug="charlafotoescolar"
      fallbackLinks={{
        calendarUrl: "https://calendar.app.google/fZehF9PeL8HoFH2q8",
        whatsappUrl: "https://chat.whatsapp.com/Dla9eNPKIiWAnOswmxMldk",
      }}
    />
  );
}
