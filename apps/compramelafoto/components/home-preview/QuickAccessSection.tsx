import Card from "@/components/ui/Card";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewProse from "@/components/home-preview/PreviewProse";
import PreviewVisual, { type PreviewVisualVariant } from "@/components/home-preview/PreviewVisual";
import { PreviewTextLink } from "@/components/home-preview/PreviewButton";

const ITEMS: {
  title: string;
  description: string;
  href: string;
  cta: string;
  visual: PreviewVisualVariant;
}[] = [
  {
    title: "Fotógrafos",
    description:
      "Publicá tus álbumes, vendé fotos, gestioná preventas y cobrá de forma ordenada.",
    href: "/fotografo/registro",
    cta: "Ver herramientas",
    visual: "photographers",
  },
  {
    title: "Organizadores",
    description:
      "Publicá eventos, invitá fotógrafos, ofrecé galerías y generá comisiones.",
    href: "/registro/organizador",
    cta: "Conocer más",
    visual: "organizers",
  },
  {
    title: "Escuelas",
    description:
      "Gestioná fotografía escolar, preventas, álbumes privados y comisiones institucionales.",
    href: "/escuelas",
    cta: "Conocer más",
    visual: "schools",
  },
  {
    title: "Laboratorios",
    description: "Recibí pedidos, conectá con fotógrafos y formá parte del ecosistema.",
    href: "/lab/registro",
    cta: "Registrarme",
    visual: "labs",
  },
];

export default function QuickAccessSection() {
  return (
    <PreviewSection variant="default">
      <PreviewProse className="mb-10 md:mb-12 max-w-[min(100%,42rem)]">
        <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
          ¿Quién usa la plataforma?
        </h2>
        <p className="text-[#6b7280] text-base mt-3 mb-0 leading-relaxed">
          Cada actor del evento tiene su espacio: vender, organizar, imprimir o comprar.
        </p>
      </PreviewProse>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 m-0 p-0 list-none w-full min-w-0">
        {ITEMS.map((item) => (
          <li key={item.title} className="min-w-0 flex">
            <Card className="flex flex-col h-full min-w-0 w-full !rounded-2xl !p-0 overflow-hidden border-[#e5e7eb] shadow-none hover:border-[#d1d5db] transition-colors">
              <div className="p-1.5 pb-0 min-w-0">
                {/* TODO: foto sector por rol */}
                <PreviewVisual variant={item.visual} aspect="video" className="!rounded-xl border-0" />
              </div>
              <div className="flex flex-col flex-1 p-5 sm:p-6 min-w-0">
                <h3 className="text-lg font-semibold text-[#111827] m-0">{item.title}</h3>
                <p className="text-sm text-[#6b7280] mt-2 mb-0 leading-relaxed flex-1 min-w-0">
                  {item.description}
                </p>
                <div className="mt-4">
                  <PreviewTextLink href={item.href}>{item.cta}</PreviewTextLink>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </PreviewSection>
  );
}
