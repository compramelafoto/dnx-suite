import SectionSplit from "@/components/home-preview/SectionSplit";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewVisual from "@/components/home-preview/PreviewVisual";
import { PreviewButtonLink } from "@/components/home-preview/PreviewButton";

const BULLETS = [
  "Eventos públicos o privados",
  "Invitación a fotógrafos",
  "Galería centralizada",
  "Comisión configurable",
  "Links y QR para compartir",
] as const;

export default function OrganizersSection() {
  return (
    <PreviewSection variant="default">
      <SectionSplit
        reverse
        visual={
          // TODO: imagen de evento / QR / panel organizador
          <PreviewVisual variant="organizers" aspect="portrait" />
        }
      >
        <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
          Eventos con fotografía, comunidad y comisiones
        </h2>
        <p className="text-[#6b7280] text-base mt-4 mb-6 leading-relaxed">
          Los organizadores pueden publicar eventos, invitar fotógrafos, centralizar galerías y generar ingresos
          por cada venta.
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
          <PreviewButtonLink href="/organizador/events/new" variant="primary" size="md">
            Crear evento
          </PreviewButtonLink>
        </div>
      </SectionSplit>
    </PreviewSection>
  );
}
