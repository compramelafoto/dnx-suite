import Link from "next/link";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewProse from "@/components/home-preview/PreviewProse";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import PreviewMegaMenuIcon from "@/components/home-preview/PreviewMegaMenuIcon";
import type { MegaMenuIcon } from "@/components/home-preview/preview-mega-menu";

const ACTORS: { title: string; desc: string; href: string; icon: MegaMenuIcon }[] = [
  {
    title: "Fotógrafos",
    desc: "Publican galerías y venden en línea.",
    href: "/fotografo/registro",
    icon: "camera",
  },
  {
    title: "Organizadores",
    desc: "Centralizan eventos y comisiones.",
    href: "/registro/organizador",
    icon: "users",
  },
  {
    title: "Escuelas",
    desc: "Preventa y álbumes institucionales.",
    href: "/escuelas",
    icon: "school",
  },
  {
    title: "Laboratorios",
    desc: "Impresión conectada al ecosistema.",
    href: "/lab/registro",
    icon: "print",
  },
];

export default function EcosystemSection() {
  return (
    <PreviewSection id="ecosistema" variant="muted" className="!py-14 md:!py-20">
      <PreviewReveal>
        <PreviewProse className="mb-8 max-w-[min(100%,42rem)] mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#374151] m-0 tracking-tight leading-snug">
            ComprameLaFoto también conecta a quienes hacen posible cada evento
          </h2>
        </PreviewProse>
      </PreviewReveal>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 m-0 p-0 list-none w-full min-w-0">
        {ACTORS.map((actor, i) => (
          <li key={actor.title} className="min-w-0 flex">
            <PreviewReveal delay={i * 50} className="w-full min-w-0">
              <Link
                href={actor.href}
                className="hp-card block h-full w-full min-w-0 rounded-2xl border border-[#e5e7eb] bg-white p-5 hover:bg-[#fafafa] transition-colors"
              >
                <PreviewMegaMenuIcon name={actor.icon} />
                <h3 className="text-base font-semibold text-[#111827] mt-3 mb-1 m-0">{actor.title}</h3>
                <p className="text-sm text-[#6b7280] m-0 leading-relaxed min-w-0">{actor.desc}</p>
              </Link>
            </PreviewReveal>
          </li>
        ))}
      </ul>
    </PreviewSection>
  );
}
