"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BuscarDireccion, type DireccionElegida } from "@/components/impresiones/buscar-direccion";
import { cotizarEnvioCassettes } from "@/lib/digitalizacion/cargos";
import { pesos, type FranjaEnvio } from "@/lib/digitalizacion/entrega";
import type { Punto } from "@/lib/impresiones/envio";
import { pedirEnvioAction } from "@/app/w/[workspaceSlug]/videos/[token]/actions";

const km = (n: number) => String(n).replace(".", ",");

/**
 * «Pedir envío de los cassettes» (spec 2026-10-22, E9): el cliente busca su dirección, ve el precio
 * de la franja (informativo: lo que vale lo recalcula el servidor con el punto exacto del estudio) y
 * confirma. Con precio va a pagar a la página del pedido; sin franja queda «a coordinar».
 */
export function PedirEnvio({ slug, token, estudio, franjas }: { slug: string; token: string; estudio: Punto | null; franjas: FranjaEnvio[] }) {
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState<DireccionElegida | null>(null);
  const [detalles, setDetalles] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();

  if (!abierto) {
    return (
      <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setAbierto(true)}>
        Pedir envío de los cassettes
      </button>
    );
  }

  const confirmar = () =>
    empezar(async () => {
      if (!elegida) return;
      setAviso(null);
      const r = await pedirEnvioAction(slug, token, { lat: elegida.lat, lon: elegida.lon, direccion: elegida.direccion, detalles });
      if (!r.ok) { setAviso(r.error); return; }
      if (r.estado === "A_PAGAR") { window.location.href = r.urlPagar; return; }
      setAviso(r.estado === "A_COORDINAR" ? r.mensaje : "Listo: el envío está confirmado.");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <BuscarDireccion
        elegida={elegida}
        onElegir={(d) => { setElegida(d); setAviso(null); }}
        detalle={(d) => {
          const q = cotizarEnvioCassettes({ estudio, destino: { lat: d.lat, lon: d.lon }, franjas });
          return (
            <p role="status" className="text-sm opacity-80">
              {q.estado === "A_PAGAR"
                ? `Envío: ${pesos(q.precioArs * 100)} (${km(q.km)} km).`
                : q.estado === "CONFIRMADO"
                  ? "El envío a esa dirección no tiene cargo."
                  : "Para esa dirección te vamos a escribir para coordinar el envío."}
            </p>
          );
        }}
      />
      {elegida ? (
        <label className="block space-y-1 text-sm">
          <span className="fo-label">Piso, depto o referencia (opcional)</span>
          <input className="fo-input w-full" value={detalles} maxLength={100} onChange={(e) => setDetalles(e.target.value)} />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={!elegida || pendiente} onClick={confirmar}>
          {pendiente ? "Enviando…" : "Pedir el envío"}
        </button>
        <button type="button" className="fo-btn fo-btn-ghost text-sm" disabled={pendiente} onClick={() => { setAbierto(false); setElegida(null); setAviso(null); }}>
          Cancelar
        </button>
      </div>
      {aviso ? <p role="alert" className="text-sm">{aviso}</p> : null}
    </div>
  );
}
