"use client";

import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewProse from "@/components/home-preview/PreviewProse";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import { PreviewButtonLink } from "@/components/home-preview/PreviewButton";
import { usePreviewSearch } from "@/components/home-preview/PreviewSearchContext";

export default function FinalCtaSection() {
  const { focusHeroSearch } = usePreviewSearch();

  return (
    <PreviewSection id="cta-final" variant="accent" className="!pb-16 md:!pb-24">
      <PreviewReveal>
        <PreviewProse className="max-w-[min(100%,36rem)]">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
            ¿No encontrás tus fotos?
          </h2>
          <p className="text-[#6b7280] text-base mt-4 mb-0 leading-relaxed">
            Buscá por nombre del evento, institución, club o fotógrafo. Si necesitás ayuda, contactanos.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-2.5 mt-8 w-full min-w-0">
            <PreviewButtonLink
              href="#inicio"
              variant="accent"
              size="lg"
              onClick={(e) => {
                e.preventDefault();
                focusHeroSearch();
              }}
            >
              Buscar nuevamente
            </PreviewButtonLink>
            <PreviewButtonLink href="/fotografo/soporte" variant="secondary" size="lg">
              Contactar soporte
            </PreviewButtonLink>
          </div>
        </PreviewProse>
      </PreviewReveal>
    </PreviewSection>
  );
}
