"use client";

const POINTS = [
  "Acceso controlado a galerías",
  "Visualización personalizada por familia",
  "Organización por alumno o curso",
];

export default function PrivateGallerySection() {
  return (
    <section className="section-spacing bg-[#f9fafb]">
      <div className="container-custom max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-6 md:text-3xl">
          Cada familia accede solo a las fotos que le corresponden.
        </h2>
        <p className="text-center text-[#6b7280] mb-8 text-base md:text-lg leading-relaxed max-w-4xl mx-auto">
          La plataforma permite un control de acceso que mejora la experiencia para los padres y reduce la exposición innecesaria de imágenes.
        </p>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {POINTS.map((p) => (
            <li key={p} className="flex items-center gap-3 p-4 rounded-xl bg-white border border-black/5 shadow-sm">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#c27b3d]/15 text-[#c27b3d] flex items-center justify-center text-sm font-bold">✓</span>
              <span className="font-medium text-[#1a1a1a]">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
