"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "¿La plataforma protege la privacidad de los alumnos?",
    a: "Sí. La plataforma está diseñada con foco en privacidad y protección de datos. Permite control de acceso a galerías, gestión segura de datos y manejo responsable de información personal. Respeta principios de protección de datos y lineamientos de la AAIP.",
  },
  {
    q: "¿Cómo funciona la identificación de fotos con IA?",
    a: "La plataforma utiliza tecnología de reconocimiento facial para identificar rostros en las fotografías y agrupar automáticamente las fotos de cada alumno. Cada familia puede acceder rápidamente a las fotos donde aparece su hijo. El sistema está diseñado para facilitar la búsqueda dentro de galerías privadas.",
  },
  {
    q: "¿Los padres pueden ver solo las fotos de su hijo?",
    a: "Sí. La plataforma permite que cada familia acceda solo a las fotos que le corresponden. El acceso es controlado y personalizado por alumno o curso, reduciendo la exposición innecesaria de imágenes.",
  },
  {
    q: "¿Puedo usarla en colegios grandes?",
    a: "Sí. Podés subir cientos o miles de fotos. La plataforma escala sin problema para eventos con muchos alumnos y familias.",
  },
  {
    q: "¿Es difícil de usar?",
    a: "No. La plataforma es simple. Subís fotos, la plataforma organiza las imágenes, compartís el acceso con las familias y los padres compran online. Todo el proceso queda centralizado.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="section-spacing bg-white">
      <div className="container-custom max-w-5xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-10 md:text-3xl">
          Preguntas frecuentes
        </h2>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-black/6 shadow-[0_2px_6px_rgba(0,0,0,0.03)] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[#f9fafb] transition-colors"
              >
                <span className="font-medium text-[#1a1a1a]">{item.q}</span>
                <span
                  className={`flex-shrink-0 text-[#6b7280] transition-transform ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {openIndex === i && (
                <div className="px-5 pb-4 pt-0">
                  <p className="text-[#6b7280] text-sm leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
