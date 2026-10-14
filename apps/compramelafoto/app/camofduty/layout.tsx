import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/styles/camofduty/index.css";
import codIcon from "./icon.png";

/*
 * Tipografías guardadas en el proyecto (camofduty/fonts, del juego latino de Fontsource) en lugar de
 * `next/font/google`: esa opción las bajaba de Google en cada publicación y, cuando Google
 * tardaba o respondía mal, la publicación fallaba ("An error occurred in next/font"). Son las
 * mismas familias y pesos de antes.
 */
const barlow = localFont({
  src: [
    { path: "./fonts/barlow-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/barlow-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/barlow-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-cod-body",
  display: "swap",
});

const barlowCondensed = localFont({
  src: [
    { path: "./fonts/barlow-condensed-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/barlow-condensed-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-condensed-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/barlow-condensed-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-cod-display",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-cod-mono",
  display: "swap",
});

const shareTechMono = localFont({
  src: [{ path: "./fonts/share-tech-mono-400.woff2", weight: "400", style: "normal" }],
  variable: "--font-cod-vf-lcd",
  display: "swap",
});

const title = "Cam Of Duty — Simulador Fotográfico Interactivo";
const description =
  "Entrená exposición, enfoque, composición e iluminación en un entorno virtual diseñado para aprender fotografía practicando.";

export const metadata: Metadata = {
  title,
  description,
  icons: {
    icon: [
      {
        url: codIcon.src,
        type: "image/png",
        sizes: `${codIcon.width}x${codIcon.height}`,
      },
    ],
    shortcut: codIcon.src,
    apple: codIcon.src,
  },
  openGraph: {
    title,
    description,
    type: "website",
    locale: "es_AR",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

/**
 * Layout aislado de Cam Of Duty.
 * No usa Header/Footer de ComprameLaFoto (ver MainLayout).
 */
export default function CamOfDutyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`cod-scope ${barlow.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} ${shareTechMono.variable}`}
    >
      {children}
    </div>
  );
}
