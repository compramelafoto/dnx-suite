"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "¿Necesito conocimientos técnicos?",
    a: "No. La plataforma es simple. Subís fotos, creás la galería y compartís el link. Tus clientes compran solos.",
  },
  {
    q: "¿Tiene costo crear cuenta?",
    a: "Crear tu cuenta es gratis. ComprameLaFoto cobra una comisión solo cuando realizás una venta.",
  },
  {
    q: "¿Cómo recibo los pagos?",
    a: "Los pagos se procesan con Mercado Pago. El dinero se acredita en la cuenta que configures.",
  },
  {
    q: "¿Sirve para eventos grandes?",
    a: "Sí. Podés subir cientos o miles de fotos. La plataforma escala sin problema.",
  },
  {
    q: "¿Mis clientes lo van a entender?",
    a: "Sí. Entran por el link, ven sus fotos, eligen y pagan. Es tan simple como comprar en cualquier tienda online.",
  },
];

export default function LandFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="section-spacing bg-white">
      <div className="container-custom max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-10 md:text-3xl">
          Preguntas frecuentes antes de empezar
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
