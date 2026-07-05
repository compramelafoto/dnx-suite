import type { Metadata } from "next";
import CharlasFprClient from "@/components/land/charlas-fpr/CharlasFprClient";

const title = "Charla gratuita para fotógrafos en Rosario | ComprameLaFoto";
const description =
  "Charla gratuita presencial el 14 de mayo a las 19:00 Hrs en la SFPR (Rosario). Ordená ventas, cobros y entregas y profesionalizá tu trabajo con ComprameLaFoto.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    images: [{ url: "/images/charlasfpr/hero-sfpr-banner-v5.png" }],
    type: "website",
    locale: "es_AR",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/charlasfpr/hero-sfpr-banner-v5.png"],
  },
};

export default function CharlasFprPage() {
  return <CharlasFprClient />;
}
