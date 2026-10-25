"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { fotosCarnetDelClienteAction } from "@/app/(shell)/ventas/impresion/actions";

type FotoAnterior = { adjuntoId: string; fecha: string; nombre: string };

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

/**
 * Los originales de foto carnet que ya están en la ficha del cliente. Tocar uno lo usa como foto
 * de esta preparación, sin volver a subirlo. Van como texto (nombre y fecha), sin miniatura.
 */
export function FotosAnteriores({
  clientId,
  deshabilitado,
  onElegir,
}: {
  clientId: string;
  deshabilitado: boolean;
  onElegir: (adjuntoId: string) => void;
}) {
  const [cargadas, setCargadas] = useState<{ clientId: string; fotos: FotoAnterior[] } | null>(null);

  useEffect(() => {
    let activo = true;
    fotosCarnetDelClienteAction(clientId)
      .then((fotos) => {
        if (activo) setCargadas({ clientId, fotos });
      })
      .catch(() => {
        if (activo) setCargadas({ clientId, fotos: [] });
      });
    return () => {
      activo = false;
    };
  }, [clientId]);

  const fotos = cargadas?.clientId === clientId ? cargadas.fotos : null;
  if (!fotos || fotos.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <History className="size-4" aria-hidden />
        Fotos anteriores
      </p>
      <div className="flex flex-wrap gap-2">
        {fotos.map((f) => (
          <button
            key={f.adjuntoId}
            type="button"
            className="fo-btn fo-btn-secondary h-auto max-w-full flex-col items-start px-3 py-1.5 text-left"
            disabled={deshabilitado}
            onClick={() => onElegir(f.adjuntoId)}
            title={`Usar ${f.nombre}`}
          >
            <span className="max-w-[16rem] truncate text-xs font-medium">{f.nombre}</span>
            <span className="text-[11px] text-[var(--fo-muted)]">{fechaCorta(f.fecha)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
