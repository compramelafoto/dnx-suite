import Image from "next/image";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewProse from "@/components/home-preview/PreviewProse";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import { PreviewButtonLink } from "@/components/home-preview/PreviewButton";

const STEPS = [
  "El organizador crea el evento y define las reglas",
  "Invita fotógrafos oficiales o colaboradores",
  "Cada fotógrafo sube fotos a su espacio",
  "La galería se centraliza para el público",
  "Comisiones configurables por venta",
] as const;

export default function CollaborativeEventsSection() {
  return (
    <PreviewSection id="eventos-colaborativos" variant="muted">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full min-w-0">
        <PreviewReveal className="min-w-0 order-2 lg:order-1">
          <PreviewProse align="start" className="mx-0 max-w-[min(100%,40rem)]">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#9a6b47] m-0 mb-3">
              Para organizadores
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
              Eventos colaborativos
            </h2>
            <p className="text-[#6b7280] text-base mt-4 mb-6 leading-relaxed">
              Un solo evento, varios fotógrafos y una galería unificada para quienes quieren comprar o
              inscribirse.
            </p>
            <ol className="m-0 p-0 list-none space-y-3 min-w-0">
              {STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm sm:text-base text-[#374151] min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-xs font-semibold text-[#6b7280]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 pt-0.5 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-col sm:flex-row gap-2.5">
              <PreviewButtonLink href="/organizador/events/new" variant="accent" size="md">
                Crear evento
              </PreviewButtonLink>
              <PreviewButtonLink href="#descubrir-eventos-fotografos" variant="secondary" size="md">
                Ver convocatorias
              </PreviewButtonLink>
            </div>
          </PreviewProse>
        </PreviewReveal>

        <PreviewReveal delay={100} className="min-w-0 order-1 lg:order-2">
          <div className="hp-card relative aspect-[4/3] rounded-2xl overflow-hidden border border-[#e5e7eb] bg-white">
            {/* TODO: mockup panel organizador / galería colaborativa */}
            <Image
              src="/images/organizador/hero-marketing.jpg"
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </PreviewReveal>
      </div>
    </PreviewSection>
  );
}
