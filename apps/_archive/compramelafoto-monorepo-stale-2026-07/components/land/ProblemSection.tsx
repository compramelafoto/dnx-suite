"use client";

const PROBLEMS = [
  "WhatsApp",
  "Transferencias manuales",
  "Carpetas de Drive",
  "Pedidos desordenados",
  "Mensajes repetidos",
];

export default function ProblemSection() {
  return (
    <section className="section-spacing bg-[#f9fafb]">
      <div className="container-custom max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-6 md:text-3xl">
          Si hoy vendés fotos así, probablemente estés perdiendo ventas.
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
          Este proceso genera confusión, pérdida de tiempo y ventas que nunca se concretan.
        </p>
      </div>
    </section>
  );
}
