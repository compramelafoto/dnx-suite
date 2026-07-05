"use client";

const BENEFITS = [
  "Búsqueda simple de fotos",
  "Selección rápida",
  "Proceso de compra claro",
  "Acceso desde el celular",
];

export default function BenefitsFamilies() {
  return (
    <section className="section-spacing bg-white">
      <div className="container-custom max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-8 md:text-3xl">
          Beneficios para las familias
        </h2>
        <ul className="grid sm:grid-cols-2 gap-4">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-3 p-4 rounded-xl bg-[#f9fafb] border border-black/5">
              <span className="text-[#c27b3d] text-xl">✓</span>
              <span className="font-medium text-[#1a1a1a]">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
