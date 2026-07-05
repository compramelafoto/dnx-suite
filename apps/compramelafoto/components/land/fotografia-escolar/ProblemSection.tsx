"use client";

const PROBLEMS = [
  "Pedidos en papel",
  "Listas de alumnos",
  "Transferencias manuales",
  "Cientos de mensajes de padres",
  "Selección de fotos caótica",
];

export default function ProblemSection() {
  return (
    <section className="section-spacing bg-[#f9fafb]">
      <div className="container-custom max-w-6xl mx-auto text-center">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-6 md:text-3xl">
          Si hacés fotografía escolar, seguramente conocés estos problemas.
        </h2>
        <ul className="space-y-3 mb-8">
          {PROBLEMS.map((p) => (
            <li
              key={p}
              className="flex items-center justify-center gap-3 text-[#6b7280] font-medium"
            >
              <span className="text-red-500 text-xl" aria-hidden>✕</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <p className="text-[#6b7280] leading-relaxed text-base md:text-lg">
          Cuando trabajás con muchas fotos y muchas familias, estos sistemas se vuelven difíciles de manejar.
        </p>
      </div>
    </section>
  );
}
