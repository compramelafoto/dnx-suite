import {
  Abril_Fatface,
  Bebas_Neue,
  Cormorant_Garamond,
  DM_Sans,
  Great_Vibes,
  Inter,
  Montserrat,
  Playfair_Display,
  Poppins,
  Space_Grotesk,
} from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
  weight: ["400", "600", "700"],
});
const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
  weight: ["400", "600", "700"],
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
  weight: ["400", "600", "700"],
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cormorant",
  weight: ["400", "500", "600", "700"],
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
  weight: ["400", "600", "700"],
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
  weight: ["400", "600", "700"],
});
const bebas = Bebas_Neue({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bebas",
  weight: "400",
});
const abril = Abril_Fatface({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-abril",
  weight: "400",
});
const greatVibes = Great_Vibes({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-great-vibes",
  weight: "400",
});

export default function PolaroidEditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        inter.variable,
        poppins.variable,
        montserrat.variable,
        playfair.variable,
        cormorant.variable,
        spaceGrotesk.variable,
        dmSans.variable,
        bebas.variable,
        abril.variable,
        greatVibes.variable,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
