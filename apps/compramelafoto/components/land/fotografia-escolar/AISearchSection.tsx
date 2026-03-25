"use client";

const POINTS = [
  "El sistema identifica rostros en las fotografías",
  "Se agrupan automáticamente las fotos de cada alumno",
  "Cada familia puede acceder rápidamente a las fotos donde aparece su hijo",
];

export default function AISearchSection() {
  return (
    <section className="section-spacing bg-white">
      <div className="container-custom max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-6 md:text-3xl">
          Cada familia puede encontrar fácilmente las fotos de su hijo.
        </h2>
        <p className="text-center text-[#6b7280] mb-8 text-base md:text-lg leading-relaxed max-w-4xl mx-auto">
          La plataforma utiliza tecnología de inteligencia artificial aplicada al reconocimiento facial para facilitar la organización de las galerías.
        </p>
        <ul className="space-y-4 max-w-4xl mx-auto mb-8">
          {POINTS.map((p) => (
            <li key={p} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#c27b3d]/20 text-[#c27b3d] flex items-center justify-center text-sm">✓</span>
              <span className="font-medium text-[#1a1a1a]">{p}</span>
            </li>
          ))}
        </ul>
        <p className="text-center text-[#6b7280] text-sm md:text-base max-w-4xl mx-auto">
          Esto simplifica enormemente el proceso de selección.
        </p>
        <p className="text-center text-[#6b7280] text-xs md:text-sm mt-4 max-w-4xl mx-auto italic">
          El sistema está diseñado para facilitar la búsqueda de imágenes dentro de galerías privadas y no para usos de vigilancia ni identificación pública.
        </p>
      </div>
    </section>
  );
}
