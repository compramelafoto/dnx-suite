import type { Metadata } from "next";
import DnxFotoBasicaFunesClient from "@/components/land/dnx-foto-basica-funes/DnxFotoBasicaFunesClient";
import {
  DNX_FOTO_BASICA_FUNES_PRICE_ARS,
} from "@/lib/dnx-foto-basica-funes";
import { formatARS } from "@/lib/lab/helpers";

const title = "Curso presencial de Fotografía Básica en Funes | DNX Estudio · ComprameLaFoto";
const description = `Curso presencial de 12 clases los sábados 15–17 hs, inicio sábado 6 de junio. DNX Estudio, Funes. Precio total ${formatARS(DNX_FOTO_BASICA_FUNES_PRICE_ARS)}. Dictado por Daniel Cuart.`;

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    images: [{ url: "/images/cursos/fotografia-basica-funes-flyer.jpg" }],
    type: "website",
    locale: "es_AR",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/cursos/fotografia-basica-funes-flyer.jpg"],
  },
};

export default function CursoFotografiaBasicaFunesPage() {
  return <DnxFotoBasicaFunesClient />;
}
