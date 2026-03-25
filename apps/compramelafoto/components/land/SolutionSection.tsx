"use client";

import Card from "@/components/ui/Card";

const BENEFITS = [
  "Publicás tus fotos",
  "Compartís tu galería",
  "Tus clientes compran solos",
  "Cobrás de forma automática",
];

export default function SolutionSection() {
  return (
    <section className="section-spacing bg-white">
      <div className="container-custom max-w-5xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] text-center mb-8 md:text-3xl">
          ComprameLaFoto organiza todo en un solo lugar.
        </h2>
        <Card className="p-8 md:p-10 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.1)]">
          <ul className="grid sm:grid-cols-2 gap-4">
            {BENEFITS.map((b, i) => (
              <li key={b} className="flex items-center gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#c27b3d]/15 text-[#c27b3d] flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <span className="font-medium text-[#1a1a1a]">{b}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-[#6b7280]">
            Todo en una plataforma simple.
          </p>
        </Card>
      </div>
    </section>
  );
}
