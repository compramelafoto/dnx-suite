import SectionSplit from "@/components/home-preview/SectionSplit";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewVisual from "@/components/home-preview/PreviewVisual";
import { PreviewButtonLink } from "@/components/home-preview/PreviewButton";

const BULLETS = [
  "Preventa escolar",
  "Álbumes privados",
  "Búsqueda inteligente de fotos",
  "Comisiones para instituciones",
  "Seguridad y privacidad de imágenes",
] as const;

export default function SchoolsSection() {
  return (
    <PreviewSection variant="muted">
      <SectionSplit
        visual={
          // TODO: imagen real de fotografía escolar / institución
          <PreviewVisual variant="schools" aspect="portrait" />
        }
      >
        <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
          Fotografía escolar más simple, segura y organizada
        </h2>
        <p className="text-[#6b7280] text-base mt-4 mb-6 leading-relaxed">
          ComprameLaFoto permite gestionar preventas, álbumes por institución, pedidos digitales o impresos y
          comisiones para escuelas.
        </p>
        <ul className="m-0 p-0 list-none space-y-2.5 min-w-0">
          {BULLETS.map((item) => (
            <li key={item} className="flex gap-3 text-[#374151] text-sm sm:text-base min-w-0">
              <span className="text-[#9a6b47] shrink-0 font-medium" aria-hidden>
                ·
              </span>
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <PreviewButtonLink href="/escuelas" variant="primary" size="md">
            Conocer solución para escuelas
          </PreviewButtonLink>
        </div>
      </SectionSplit>
    </PreviewSection>
  );
}
