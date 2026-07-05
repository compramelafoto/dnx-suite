"use client";

const POINTS = [
  "Control de acceso a galerías",
  "Gestión segura de datos",
  "Almacenamiento protegido",
  "Manejo responsable de información personal",
];

export default function SecuritySection() {
  return (
    <section className="section-spacing bg-[#f7f5f2]">
      <div className="container-custom max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-6 md:text-3xl">
          Diseñada con foco en privacidad y protección de datos.
        </h2>
        <p className="text-center text-[#6b7280] mb-8 text-base md:text-lg leading-relaxed max-w-4xl mx-auto">
          La plataforma considera especialmente el manejo responsable de imágenes de menores.
        </p>
        <ul className="grid sm:grid-cols-2 gap-4 max-w-5xl mx-auto mb-8">
          {POINTS.map((p) => (
            <li key={p} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#c27b3d]/20 text-[#c27b3d] flex items-center justify-center text-sm">✓</span>
              <span className="font-medium text-[#1a1a1a]">{p}</span>
            </li>
          ))}
        </ul>
        <p className="text-center text-[#6b7280] text-sm md:text-base max-w-4xl mx-auto mb-4">
          El sistema respeta principios de protección de datos personales y lineamientos de la Agencia de Acceso a la Información Pública (AAIP).
        </p>
        <p className="text-center text-[#6b7280] text-sm md:text-base max-w-4xl mx-auto">
          Esto te permite trabajar con instituciones educativas de forma más <strong className="text-[#1a1a1a]">profesional y responsable</strong>.
        </p>
      </div>
    </section>
  );
}
