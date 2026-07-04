"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

const STEPS = [
  { num: 1, title: "Subís las fotos del evento escolar", desc: "Cargá las imágenes de la jornada o acto." },
  { num: 2, title: "La plataforma organiza las imágenes", desc: "IA y herramientas automáticas agrupan las fotos." },
  { num: 3, title: "Las familias acceden a las fotos correspondientes", desc: "Cada padre ve solo las fotos de su hijo." },
  { num: 4, title: "Realizan el pedido online", desc: "Selección y pago desde el celular o computadora." },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="section-spacing bg-white">
      <div className="container-custom max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-4 md:text-3xl">
          Cómo funciona
        </h2>
        <p className="text-center text-[#6b7280] mb-12 text-base md:text-lg">
          4 pasos simples.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {STEPS.map((s) => (
            <div key={s.num} className="text-center p-6 rounded-2xl bg-[#f9fafb] border border-black/5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow duration-200">
              <div className="w-14 h-14 rounded-full bg-[#c27b3d]/15 text-[#c27b3d] flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-sm">
                {s.num}
              </div>
              <h3 className="text-lg font-medium text-[#1a1a1a] mb-2">{s.title}</h3>
              <p className="text-sm text-[#6b7280]">{s.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-[#6b7280] mt-8">
          Todo el proceso queda centralizado.
        </p>
        <div className="text-center mt-8">
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
