import type { Metadata } from "next";
import HomePreviewContent from "@/components/home-preview/HomePreviewContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ComprameLaFoto — Encontrá y comprá tus fotos de eventos",
  description:
    "Buscá tus fotos por evento, escuela, club o fotógrafo. ComprameLaFoto conecta compradores, fotógrafos, organizadores, escuelas y laboratorios.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HomePreviewPage() {
  return <HomePreviewContent />;
}
