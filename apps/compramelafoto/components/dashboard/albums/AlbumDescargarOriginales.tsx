"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { DsInfoPanel } from "@/components/ui/DsLayout";

type Parte = { parte: number; desde: number; hasta: number; cantidad: number };

/**
 * «Descargar originales»: el álbum completo en alta resolución, en partes de ~100 fotos.
 * El panel solo lo muestra al dueño del álbum; la API vuelve a chequearlo.
 */
export default function AlbumDescargarOriginales({ albumId }: { albumId: number }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partes, setPartes] = useState<Parte[] | null>(null);
  const [totalFotos, setTotalFotos] = useState(0);

  async function abrir() {
    setAbierto(true);
    if (partes) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/originales`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo preparar la descarga");
      setPartes(data.partes ?? []);
      setTotalFotos(data.totalFotos ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo preparar la descarga");
    } finally {
      setCargando(false);
    }
  }

  return (
    <DsInfoPanel title="Descargar originales">
      <div className="flex flex-col gap-3 w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#374151] m-0 min-w-0">
            Bajá todas las fotos del álbum en alta resolución, sin marca de agua. Solo vos, como
            dueño del álbum, ves esta opción.
          </p>
          {!abierto ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full whitespace-nowrap sm:w-auto"
              onClick={() => void abrir()}
            >
              Descargar originales
            </Button>
          ) : null}
        </div>

        {abierto && cargando ? <p className="text-sm text-[#6b7280] m-0">Preparando la descarga…</p> : null}
        {abierto && error ? <p className="text-sm text-[#b91c1c] m-0">{error}</p> : null}

        {abierto && partes && partes.length === 0 ? (
          <p className="text-sm text-[#6b7280] m-0">El álbum todavía no tiene fotos.</p>
        ) : null}

        {abierto && partes && partes.length > 0 ? (
          <div className="flex flex-col gap-2 w-full">
            <p className="text-sm text-[#374151] m-0">
              {totalFotos.toLocaleString("es-AR")} fotos
              {partes.length > 1
                ? ` en ${partes.length} partes. Bajá cada parte por separado: cada una es un ZIP de hasta ${partes[0].cantidad} fotos y puede tardar varios minutos según tu conexión.`
                : ". Puede tardar varios minutos según tu conexión."}
            </p>
            <ul className="flex flex-col gap-2 m-0 p-0 list-none">
              {partes.map((p) => (
                <li
                  key={p.parte}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-[#e5e7eb] px-3 py-2"
                >
                  <span className="text-sm text-[#1a1a1a]">
                    {partes.length > 1 ? `Parte ${p.parte} · ` : ""}fotos {p.desde} a {p.hasta}
                  </span>
                  <a
                    href={`/api/dashboard/albums/${albumId}/originales/zip?parte=${p.parte}`}
                    download
                    className="text-sm font-medium text-[#2563eb] underline"
                  >
                    Descargar ZIP
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </DsInfoPanel>
  );
}
