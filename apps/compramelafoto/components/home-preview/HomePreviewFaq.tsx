"use client";

import { useState } from "react";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewReveal from "@/components/home-preview/PreviewReveal";

const FAQ_ITEMS = [
  {
    q: "¿Quién puede usar ComprameLaFoto?",
    a: "Cualquier persona que quiera encontrar o comprar sus fotos, y también fotógrafos, organizadores, escuelas y laboratorios que venden o gestionan galerías.",
  },
  {
    q: "¿Sirve para eventos deportivos?",
    a: "Sí. Podés publicar eventos deportivos, invitar fotógrafos, ofrecer galerías y vender fotos a participantes y público.",
  },
  {
    q: "¿Sirve para escuelas?",
    a: "Sí. Incluye preventas escolares, álbumes privados por institución, búsqueda de fotos y comisiones configurables para la escuela.",
  },
  {
    q: "¿Los organizadores pueden cobrar comisión?",
    a: "Sí. Los organizadores pueden definir comisiones sobre las ventas de fotos en sus eventos, según la configuración del evento.",
  },
  {
    q: "¿Cómo cobran los fotógrafos?",
    a: "Las ventas se procesan en línea. El fotógrafo recibe su parte según los acuerdos del evento y la configuración de pagos de la plataforma.",
  },
  {
    q: "¿Qué pasa con la privacidad de las fotos?",
    a: "Podés usar álbumes privados, acceso por link y controles de visibilidad. Las imágenes se publican solo cuando el responsable lo autoriza.",
  },
  {
    q: "¿Puedo participar como laboratorio?",
    a: "Sí. Los laboratorios pueden registrarse para recibir pedidos de impresión y conectarse con fotógrafos del ecosistema.",
  },
  {
    q: "¿ComprameLaFoto cobra comisión?",
    a: "La plataforma aplica una comisión sobre las ventas según el tipo de operación. Crear cuenta y explorar las herramientas no tiene costo fijo de entrada.",
  },
] as const;

export default function HomePreviewFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <PreviewSection id="faq" variant="default">
      <PreviewReveal className="w-full min-w-0">
        <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 mb-8 md:mb-10 tracking-tight">
          Preguntas frecuentes
        </h2>
        <div className="w-full min-w-0 space-y-2.5">
        {FAQ_ITEMS.map((item, i) => (
          <div
            key={item.q}
            className="hp-card rounded-2xl border border-[#e5e7eb] bg-white overflow-hidden min-w-0"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-left hover:bg-[#f9fafb] transition-colors min-w-0"
              aria-expanded={openIndex === i}
            >
              <span className="font-medium text-[#111827] text-sm sm:text-base min-w-0 text-left">
                {item.q}
              </span>
              <span
                className={`shrink-0 text-[#6b7280] transition-transform ${openIndex === i ? "rotate-180" : ""}`}
                aria-hidden
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            {openIndex === i ? (
              <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-0 min-w-0">
                <p className="text-[#6b7280] text-sm sm:text-base leading-relaxed m-0 w-full max-w-none">
                  {item.a}
                </p>
              </div>
            ) : null}
          </div>
        ))}
        </div>
      </PreviewReveal>
    </PreviewSection>
  );
}
