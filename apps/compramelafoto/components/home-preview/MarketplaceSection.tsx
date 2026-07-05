import Image from "next/image";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewProse from "@/components/home-preview/PreviewProse";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import PreviewVisual from "@/components/home-preview/PreviewVisual";
import { PreviewButtonLink } from "@/components/home-preview/PreviewButton";

const FEATURES = [
  "Álbumes públicos listos para compartir",
  "Búsqueda por evento, ciudad o fotógrafo",
  "Compra online con pago seguro",
  "Descargas digitales al instante",
  "Productos impresos cuando el fotógrafo los ofrece",
] as const;

export default function MarketplaceSection() {
  return (
    <PreviewSection id="marketplace" variant="default">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full min-w-0">
        <PreviewReveal className="min-w-0">
          <PreviewProse align="start" className="mx-0 max-w-[min(100%,40rem)]">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#9a6b47] m-0 mb-3">
              Para compradores
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
              Marketplace de fotos
            </h2>
            <p className="text-[#6b7280] text-base mt-4 mb-6 leading-relaxed">
              Encontrá tus imágenes de un evento, elegí las que querés y comprá sin intermediarios confusos.
            </p>
            <ul className="m-0 p-0 list-none space-y-2.5 min-w-0">
              {FEATURES.map((f) => (
                <li key={f} className="flex gap-3 text-sm sm:text-base text-[#374151] min-w-0">
                  <span className="text-[#c27b3d] shrink-0" aria-hidden>
                    ✓
                  </span>
                  <span className="min-w-0">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <PreviewButtonLink href="#descubrir" variant="primary" size="md">
                Buscar mis fotos
              </PreviewButtonLink>
            </div>
          </PreviewProse>
        </PreviewReveal>

        <PreviewReveal delay={100} className="min-w-0">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 min-w-0">
            <div className="hp-card col-span-2 relative aspect-[16/9] rounded-2xl overflow-hidden border border-[#e5e7eb] bg-[#f9fafb]">
              <Image
                src="/images/landescolar/escritorio-desordenado-fotos-escolares.png"
                alt=""
                fill
                className="object-cover opacity-90"
                sizes="(max-width: 768px) 100vw, 40vw"
              />
              {/* TODO: captura real del marketplace / galería pública */}
            </div>
            {[1, 2].map((i) => (
              <div
                key={i}
                className="hp-card relative aspect-square rounded-xl overflow-hidden border border-[#e5e7eb] bg-[#f9fafb] min-w-0"
              >
                <PreviewVisual variant="albums" aspect="square" className="h-full !aspect-auto min-h-full border-0 !rounded-none" />
              </div>
            ))}
          </div>
        </PreviewReveal>
      </div>
    </PreviewSection>
  );
}
