"use client";

import { useEffect, useState } from "react";
import ConversacionesResueltas from "@/components/admin/soporte/ConversacionesResueltas";
import FichaTicket from "@/components/admin/soporte/FichaTicket";
import ResumenBot from "@/components/admin/soporte/ResumenBot";
import TableroReclamos from "@/components/admin/soporte/TableroReclamos";

type Pestania = "tablero" | "conversaciones";

/** Centro de reclamos: números del DNX Bot, tablero por columnas y las charlas que el bot resolvió solo. */
export default function AdminSoportePage() {
  const [pestania, setPestania] = useState<Pestania>("tablero");
  const [abierta, setAbierta] = useState<number | null>(null);
  const [recargar, setRecargar] = useState(0);

  // Escape cierra la ficha.
  useEffect(() => {
    if (abierta == null) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierta(null); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Centro de reclamos</h1>
        <p className="mt-1 text-gray-600">Cada reclamo llega con un diagnóstico automático. Arrastrá las fichas entre columnas; el borde rojo indica que pasaron las 24 horas.</p>
      </div>

      <ResumenBot />

      <div className="flex gap-2" role="tablist">
        {([["tablero", "Tablero de reclamos"], ["conversaciones", "Conversaciones resueltas por el bot"]] as const).map(([id, texto]) => (
          <button
            key={id}
            role="tab"
            aria-selected={pestania === id}
            onClick={() => setPestania(id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${pestania === id ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 text-gray-700"}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestania === "tablero" ? <TableroReclamos seleccionada={abierta} onAbrir={setAbierta} recargar={recargar} /> : <ConversacionesResueltas />}

      {abierta != null && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setAbierta(null)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-4 shadow-xl sm:p-6" onClick={(e) => e.stopPropagation()} aria-label={`Reclamo #${abierta}`}>
            <div className="mb-3 flex items-center justify-between">
              <a href={`/admin/soporte/${abierta}`} className="text-sm text-blue-700 underline">Abrir en una página</a>
              <button type="button" onClick={() => setAbierta(null)} className="rounded-lg border border-gray-300 px-3 py-1 text-sm">Cerrar</button>
            </div>
            <FichaTicket ticketId={abierta} onCambio={() => setRecargar((n) => n + 1)} />
          </aside>
        </div>
      )}
    </div>
  );
}
