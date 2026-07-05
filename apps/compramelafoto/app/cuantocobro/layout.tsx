import type { Metadata } from "next";
import { CC_LOGO_ALT, CC_LOGO_SRC } from "@/lib/cuantocobro/brand";
import "@/styles/cuantocobro/index.css";
import ccIcon from "./icon.png";

const title = "¿Cuánto Cobro? — Calculá tu tarifa como fotógrafo | ComprameLaFoto";
const description =
  "Calculá tus costos personales, gastos de negocio, disponibilidad y descubrí cuánto deberías cobrar para una actividad fotográfica rentable y sostenible.";

export const metadata: Metadata = {
  title,
  description,
  icons: {
    icon: [
      {
        url: ccIcon.src,
        type: "image/png",
        sizes: `${ccIcon.width}x${ccIcon.height}`,
      },
    ],
    shortcut: ccIcon.src,
    apple: ccIcon.src,
  },
  openGraph: {
    title,
    description,
    type: "website",
    locale: "es_AR",
    images: [{ url: CC_LOGO_SRC, width: 1024, height: 1024, alt: CC_LOGO_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [CC_LOGO_SRC],
  },
};

export default function CuantoCobroRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="cc-page clf-landing ds-fill-width min-w-0 w-full">{children}</div>;
}
