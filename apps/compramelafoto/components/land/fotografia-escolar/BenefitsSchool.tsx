"use client";

const BENEFITS = [
  "Menos trabajo administrativo",
  "Proceso organizado",
  "Mayor control sobre la publicación de fotos",
  "Respeto por la privacidad de los alumnos",
];

export default function BenefitsSchool() {
  return (
    <section className="section-spacing bg-[#f7f5f2]">
      <div className="container-custom max-w-5xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-4 md:text-3xl">
          Beneficios para los colegios
        </h2>
        <p className="text-center text-[#6b7280] mb-8 text-base">
          Esta sección podés mostrarla al colegio cuando presentás tu servicio.
        </p>
        <ul className="grid sm:grid-cols-2 gap-4">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-3 p-4 rounded-xl bg-white/80 border border-black/5 shadow-sm">
              <span className="text-[#c27b3d] text-xl">✓</span>
              <span className="font-medium text-[#1a1a1a]">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
