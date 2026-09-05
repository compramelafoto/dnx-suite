import type { Metadata } from "next";
import { Suspense } from "react";
import RecomendanosClient from "@/components/recomendanos/RecomendanosClient";

const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://www.compramelafoto.com";
const canonical = `${String(base).replace(/\/$/, "")}/recomendanos`;

export const metadata: Metadata = {
  title: "Recomendá ComprameLaFoto",
  description:
    "Recomendá ComprameLaFoto y ganá el 7,5% de todo lo que venda cada fotógrafo que traigas, durante 12 meses. Sumarse es gratis y el link sale al instante.",
  alternates: { canonical },
  openGraph: {
    title: "Recomendá ComprameLaFoto",
    description:
      "Recomendá ComprameLaFoto y ganá el 7,5% de todo lo que venda cada fotógrafo que traigas, durante 12 meses. Sumarse es gratis y el link sale al instante.",
    url: canonical,
    siteName: "ComprameLaFoto",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Recomendá ComprameLaFoto",
    description:
      "Recomendá ComprameLaFoto y ganá el 7,5% de todo lo que venda cada fotógrafo que traigas, durante 12 meses. Sumarse es gratis y el link sale al instante.",
  },
  robots: { index: true, follow: true },
};

export default function RecomendanosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f5f2] text-[#6b7280]">
          Cargando…
        </div>
      }
    >
      <RecomendanosClient />
    </Suspense>
  );
}
