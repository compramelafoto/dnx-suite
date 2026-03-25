"use client";

const TARGETS = [
  { icon: "📷", label: "Fotógrafos sociales" },
  { icon: "🏫", label: "Fotografía escolar" },
  { icon: "⚽", label: "Eventos deportivos" },
  { icon: "🏆", label: "Clubes y colegios" },
  { icon: "🎉", label: "Organizadores de eventos" },
];

export default function TargetSection() {
  return (
    <section className="section-spacing bg-white">
      <div className="container-custom">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-10 md:text-3xl">
          Ideal para:
        </h2>
        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {TARGETS.map((t) => (
            <div
              key={t.label}
              className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white border border-black/6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-[#c27b3d]/25 hover:bg-[#f7f5f2] transition-all duration-200"
            >
              <span className="text-2xl" aria-hidden>{t.icon}</span>
              <span className="font-medium text-[#1a1a1a] text-sm md:text-base">{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
