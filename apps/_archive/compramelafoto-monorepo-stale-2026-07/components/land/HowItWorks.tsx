"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

const STEPS = [
  { num: 1, title: "Subís tus fotos", desc: "Creá tu galería o evento en minutos." },
  { num: 2, title: "Creás tu galería o evento", desc: "Organizá las fotos por evento o fecha." },
  { num: 3, title: "Compartís el link", desc: "Un solo enlace para que tus clientes entren." },
  { num: 4, title: "Tus clientes compran y pagan online", desc: "Mercado Pago, sin perseguir pagos." },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="section-spacing bg-[#f7f5f2]">
      <div className="container-custom max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-4 md:text-3xl">
          Cómo funciona
        </h2>
        <p className="text-center text-[#6b7280] mb-12 text-base md:text-lg">
          Cuatro pasos para empezar a vender.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {STEPS.map((s) => (
            <div key={s.num} className="text-center p-6 rounded-2xl bg-white/80 border border-black/5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow duration-200">
              <div className="w-14 h-14 rounded-full bg-[#c27b3d]/15 text-[#c27b3d] flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-sm">
                {s.num}
              </div>
              <h3 className="text-lg font-medium text-[#1a1a1a] mb-2">{s.title}</h3>
              <p className="text-sm text-[#6b7280]">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link href="/registro">
            <Button variant="primary" className="text-base px-6 py-3">
              Crear cuenta gratis
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
