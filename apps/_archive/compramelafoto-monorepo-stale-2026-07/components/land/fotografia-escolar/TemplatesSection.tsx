"use client";

const ITEMS = [
  "Plantillas de fotos escolares",
  "Composiciones de curso",
  "Diseños listos para impresión",
  "Productos fotográficos personalizados",
];

export default function TemplatesSection() {
  return (
    <section className="section-spacing bg-white">
      <div className="container-custom max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-6 md:text-3xl">
          Creación automática de productos fotográficos.
        </h2>
        <p className="text-center text-[#6b7280] mb-8 text-base md:text-lg leading-relaxed max-w-4xl mx-auto">
          La plataforma permite generar automáticamente diseños personalizados para ahorrar tiempo en procesos repetitivos.
        </p>
        <ul className="grid sm:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {ITEMS.map((item) => (
            <li key={item} className="flex items-center gap-3 p-4 rounded-xl bg-[#f9fafb] border border-black/5">
              <span className="text-[#c27b3d] text-xl">✓</span>
              <span className="font-medium text-[#1a1a1a]">{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-center text-[#6b7280] text-sm mt-6 max-w-4xl mx-auto">
          Las plantillas se generan automáticamente utilizando la información de cada curso o grupo.
        </p>
      </div>
    </section>
  );
}
