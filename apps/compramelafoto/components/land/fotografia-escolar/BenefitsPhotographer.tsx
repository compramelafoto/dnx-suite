"use client";

const BENEFITS = [
  { icon: "⏱️", title: "Menos trabajo administrativo" },
  { icon: "🤖", title: "Organización automática de fotos" },
  { icon: "📋", title: "Pedidos más claros" },
  { icon: "🏫", title: "Experiencia profesional frente a colegios" },
  { icon: "📈", title: "Escalabilidad en eventos grandes" },
];

export default function BenefitsPhotographer() {
  return (
    <section className="section-spacing bg-[#f9fafb]">
      <div className="container-custom">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-10 md:text-3xl">
          Beneficios para el fotógrafo escolar
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-black/6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow duration-200"
            >
              <span className="text-2xl flex-shrink-0" aria-hidden>{b.icon}</span>
              <span className="font-medium text-[#1a1a1a]">{b.title}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
