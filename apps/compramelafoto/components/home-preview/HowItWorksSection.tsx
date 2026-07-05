import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewProse from "@/components/home-preview/PreviewProse";
import PreviewReveal from "@/components/home-preview/PreviewReveal";

const STEPS = [
  { n: 1, title: "Se crea el evento o álbum", body: "Organizador, escuela o fotógrafo define la cobertura." },
  { n: 2, title: "Los fotógrafos suben sus fotos", body: "Galerías ordenadas por evento o institución." },
  { n: 3, title: "Los participantes encuentran sus imágenes", body: "Búsqueda, carpetas o reconocimiento facial." },
  { n: 4, title: "Compran en línea", body: "Digital o impreso, con pago seguro." },
  { n: 5, title: "Cada parte cobra según su rol", body: "Fotógrafo, organizador y plataforma." },
] as const;

export default function HowItWorksSection() {
  return (
    <PreviewSection id="como-funciona" variant="default" className="!py-16 md:!py-20">
      <PreviewReveal>
        <PreviewProse className="mb-10 md:mb-14 max-w-[min(100%,42rem)] mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">Cómo funciona</h2>
          <p className="text-[#6b7280] text-base mt-3 mb-0">Del evento al cobro, en cinco pasos.</p>
        </PreviewProse>
      </PreviewReveal>
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-4 m-0 p-0 list-none w-full min-w-0">
        {STEPS.map((step, i) => (
          <li key={step.n} className="min-w-0">
            <PreviewReveal delay={i * 50} className="h-full">
              <div className="hp-card h-full rounded-2xl border border-[#e5e7eb] bg-white p-5 min-w-0 text-left lg:text-center">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f3f4f6] text-sm font-semibold text-[#374151] mb-3"
                  aria-hidden
                >
                  {step.n}
                </span>
                <h3 className="text-[0.9375rem] font-semibold text-[#111827] m-0 leading-snug">{step.title}</h3>
                <p className="text-sm text-[#6b7280] mt-2 mb-0 leading-relaxed min-w-0">{step.body}</p>
              </div>
            </PreviewReveal>
          </li>
        ))}
      </ol>
    </PreviewSection>
  );
}
