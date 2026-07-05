import Image from "next/image";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewProse from "@/components/home-preview/PreviewProse";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import { PreviewButtonLink } from "@/components/home-preview/PreviewButton";

const BULLETS = [
  "Preventa escolar con precios claros",
  "Álbumes privados por institución o curso",
  "Búsqueda inteligente para familias",
  "Comisiones configurables para la escuela",
  "Seguridad y privacidad de las imágenes",
] as const;

export default function SchoolManagementSection() {
  return (
    <PreviewSection id="gestion-escolar" variant="default">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full min-w-0">
        <PreviewReveal className="min-w-0">
          <div className="hp-card relative aspect-[4/3] rounded-2xl overflow-hidden border border-[#e5e7eb] bg-[#f9fafb] max-w-lg mx-auto lg:mx-0 w-full">
            {/* TODO: fotografía escolar institucional */}
            <Image
              src="/images/landescolar/escuela-principal-2026.png"
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </PreviewReveal>

        <PreviewReveal delay={80} className="min-w-0">
          <PreviewProse align="start" className="mx-0 max-w-[min(100%,40rem)]">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#9a6b47] m-0 mb-3">
              Para instituciones
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
              Gestión escolar
            </h2>
            <p className="text-[#6b7280] text-base mt-4 mb-6 leading-relaxed">
              Fotografía escolar ordenada: desde la preventa hasta la entrega digital o impresa.
            </p>
            <ul className="m-0 p-0 list-none space-y-2.5 min-w-0">
              {BULLETS.map((item) => (
                <li key={item} className="flex gap-3 text-sm sm:text-base text-[#374151] min-w-0">
                  <span className="text-[#c27b3d] shrink-0" aria-hidden>
                    ✓
                  </span>
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <PreviewButtonLink href="/escuelas" variant="accent" size="md">
                Conocer solución para escuelas
              </PreviewButtonLink>
            </div>
          </PreviewProse>
        </PreviewReveal>
      </div>
    </PreviewSection>
  );
}
