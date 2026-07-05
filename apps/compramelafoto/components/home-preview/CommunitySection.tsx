import Link from "next/link";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewProse from "@/components/home-preview/PreviewProse";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import { PreviewButtonLink } from "@/components/home-preview/PreviewButton";
import { cn } from "@/lib/utils";

const NETWORK = [
  { title: "Fotógrafos", desc: "Perfiles, portfolios y venta de fotos", href: "/directorio/fotografos" },
  { title: "Organizadores", desc: "Eventos y galerías centralizadas", href: "/directorio/organizadores" },
  { title: "Laboratorios", desc: "Impresión conectada al ecosistema", href: "/directorio/laboratorios" },
  { title: "Escuelas", desc: "Instituciones con fotografía escolar", href: "/escuelas" },
  { title: "Empresas afines", desc: "Proveedores y servicios del sector", href: "/directorio/servicios-de-eventos" },
] as const;

export default function CommunitySection() {
  return (
    <PreviewSection id="comunidad" variant="muted">
      <PreviewReveal>
        <PreviewProse className="mb-10 max-w-[min(100%,42rem)] mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
            Más que venta de fotos: una red del sector
          </h2>
          <p className="text-[#6b7280] text-base mt-3 mb-0 leading-relaxed">
            ComprameLaFoto conecta a quienes hacen posible cada evento: desde el fotógrafo hasta el laboratorio
            que imprime, la escuela que organiza y las marcas que acompañan.
          </p>
        </PreviewProse>
      </PreviewReveal>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 m-0 p-0 list-none w-full min-w-0 mb-10">
        {NETWORK.map((item, i) => (
          <li key={item.title} className="min-w-0 flex">
            <PreviewReveal delay={i * 60} className="w-full min-w-0">
              <Link
                href={item.href}
                className={cn(
                  "hp-card block h-full w-full min-w-0 rounded-2xl border border-[#e5e7eb] bg-white p-5 sm:p-6",
                  "hover:bg-[#fafafa] transition-colors"
                )}
              >
                <h3 className="text-base font-semibold text-[#111827] m-0">{item.title}</h3>
                <p className="text-sm text-[#6b7280] mt-2 mb-0 leading-relaxed min-w-0">{item.desc}</p>
              </Link>
            </PreviewReveal>
          </li>
        ))}
      </ul>

      <PreviewReveal>
        <div className="flex justify-center">
          <PreviewButtonLink href="/fotografo/comunidad" variant="secondary" size="md">
            Explorar comunidad
          </PreviewButtonLink>
        </div>
      </PreviewReveal>
    </PreviewSection>
  );
}
