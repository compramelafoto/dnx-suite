"use client";

export default function Guidelines() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6">
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-[#1a1a1a]">Cómo sacarte la foto</h3>
        <ul className="list-disc list-inside text-sm text-[#4b5563] space-y-1">
          <li>Fondo liso claro, ideal blanco o gris muy claro.</li>
          <li>Luz suave frontal (ventana) evitando sombras duras.</li>
          <li>Evitá luz de arriba que marque ojeras.</li>
          <li>Cámara a la altura de los ojos, sin gran angular extremo.</li>
          <li>Rostro centrado, hombros alineados, mirá al lente.</li>
          <li>Expresión neutra, boca cerrada.</li>
          <li>Sin filtros de belleza.</li>
          <li>Pelo despejado de la cara, sin reflejos fuertes en lentes.</li>
          <li>Si el trámite lo pide: sin accesorios / sin gorra (ver requisitos del trámite).</li>
        </ul>
      </div>
      <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 flex flex-col items-center justify-center text-center">
        <div className="w-40 h-52 border-2 border-dashed border-[#9ca3af] rounded-md relative flex items-center justify-center">
          <div className="w-28 h-28 border border-[#c27b3d] rounded-full" />
          <div className="absolute bottom-6 text-[11px] text-[#6b7280]">Zona de cabeza</div>
        </div>
        <p className="text-xs text-[#6b7280] mt-3">
          Ajustá el zoom para que la cara quede bien proporcionada.
        </p>
      </div>
    </div>
  );
}
