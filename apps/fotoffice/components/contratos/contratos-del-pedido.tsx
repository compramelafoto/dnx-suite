"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generarContratoAction } from "@/app/actions/contratos";
import type { ContratoDeTarjeta } from "@/lib/contratos/tarjeta-tipos";
import { ListaContratos } from "./lista-contratos";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

/**
 * Contratos del pedido y "Generar contrato" (con "Gestionar"): se elige una plantilla activa y se crea un
 * borrador con los datos del pedido y de los contratantes. Después se revisa, se edita y se manda a firmar
 * desde la ficha del contrato.
 */
export function ContratosDelPedido({
  pedidoId,
  contratos,
  plantillas,
  puedeGenerar,
}: {
  pedidoId: string;
  contratos: ContratoDeTarjeta[];
  plantillas: { id: string; nombre: string }[];
  puedeGenerar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [plantilla, setPlantilla] = useState(plantillas[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  function generar() {
    if (!plantilla) return;
    setError(null);
    iniciar(async () => {
      const r = await generarContratoAction(pedidoId, plantilla).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) router.push(`/contratos/${encodeURIComponent(r.id)}`);
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <ListaContratos contratos={contratos} vacio="Este pedido todavía no tiene contratos." />
      {puedeGenerar ? (
        plantillas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            No hay plantillas de contrato activas. Cargá una en Configuración → Contratos para poder generar contratos.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-sm">
              <span className="block text-xs text-[var(--fo-muted)]">Plantilla</span>
              <select className="fo-input" value={plantilla} disabled={pendiente} onChange={(e) => setPlantilla(e.target.value)}>
                {plantillas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || !plantilla} onClick={generar}>
              {pendiente ? "Generando…" : "Generar contrato"}
            </button>
          </div>
        )
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
