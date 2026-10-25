import type { Metadata } from "next";
import CharlaFotoEscolarClient from "@/components/land/charla-foto-escolar/CharlaFotoEscolarClient";

export const metadata: Metadata = {
  title: "Charla gratuita: vendé fotografía escolar sin listados ni cobros a mano | ComprameLaFoto",
  description:
    "Jueves 29 de octubre, 19 hs, por Google Meet. Ahorrate muchísimo tiempo en fotografía escolar: preventa por curso, diseños automáticos y cobro por Mercado Pago.",
  openGraph: {
    title: "Charla gratuita: vendé fotografía escolar sin listados ni cobros a mano | ComprameLaFoto",
    description:
      "Jueves 29 de octubre, 19 hs, por Google Meet. Ahorrate muchísimo tiempo en fotografía escolar: preventa por curso, diseños automáticos y cobro por Mercado Pago.",
    images: [
      {
        url: "/charla-escolar-29-10.jpg",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Charla gratuita: vendé fotografía escolar sin listados ni cobros a mano | ComprameLaFoto",
    description:
      "Jueves 29 de octubre, 19 hs, por Google Meet. Ahorrate muchísimo tiempo en fotografía escolar: preventa por curso, diseños automáticos y cobro por Mercado Pago.",
    images: ["/charla-escolar-29-10.jpg"],
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
