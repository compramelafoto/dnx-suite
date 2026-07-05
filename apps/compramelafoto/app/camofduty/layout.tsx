import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono, Share_Tech_Mono } from "next/font/google";
import "@/styles/camofduty/index.css";
import codIcon from "./icon.png";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cod-body",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-cod-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-cod-mono",
  display: "swap",
});

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
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
