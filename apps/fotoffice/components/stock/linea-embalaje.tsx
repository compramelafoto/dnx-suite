"use client";

import { useEffect, useRef, useState } from "react";
import { previsualizarEmbalajeAction, type VistaEmbalaje } from "@/app/(shell)/ventas/actions";

type Elegido = { insumoId: string; qty: number };

/**
 * «Embalaje: 1 sobre 19x24 + 1 bolsa 30x45 · Cambiar», debajo del total del Cobrador. Lo calcula el
 * servidor con las mismas reglas que al cobrar. Cambiarlo es la excepción: lo editado viaja en el
 * cobro (`elegido`); `null` = lo calcula el sistema. Si el ticket cambia, vuelve a lo calculado.
 * Con un pedido en el ticket no se cambia acá: se descuenta al tomar el pedido y se corrige desde él.
 */
export function LineaEmbalaje({
  lineas,
  conPedido,
  elegido,
  onElegido,
}: {
  lineas: { productId: string | null; qty: number }[];
  conPedido: boolean;
  elegido: Elegido[] | null;
  onElegido: (e: Elegido[] | null) => void;
}) {
  const [vista, setVista] = useState<VistaEmbalaje | null>(null);
  const [editando, setEditando] = useState(false);
  const clave = JSON.stringify(lineas);
  const ultimaClave = useRef(clave);
  const pedido = useRef(0);

  useEffect(() => {
    if (ultimaClave.current !== clave) {
      ultimaClave.current = clave;
      onElegido(null);
      setEditando(false);
    }
    if (lineas.every((l) => !l.productId)) {
      setVista(null);
      return;
    }
    const n = ++pedido.current;
    const t = setTimeout(async () => {
      try {
        const v = await previsualizarEmbalajeAction(lineas);
        if (n === pedido.current) setVista(v);
      } catch {
        if (n === pedido.current) setVista(null);
      }
    }, 300);
    return () => clearTimeout(t);
    // `lineas` se compara por su texto (`clave`): un arreglo nuevo con lo mismo no recalcula.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  if (!vista || vista.opciones.length === 0) return null;
  const nombre = new Map(vista.opciones.map((o) => [o.insumoId, o.nombre]));
  const actual = elegido ?? vista.propuesto.map((p) => ({ insumoId: p.insumoId, qty: p.qty }));
  const texto = actual.filter((e) => e.qty > 0).map((e) => `${e.qty} ${nombre.get(e.insumoId) ?? ""}`).join(" + ") || "nada";

  if (conPedido) {
    return <p className="text-xs text-[var(--fo-muted)]">Embalaje: se descuenta al tomar el pedido; se cambia desde el pedido.</p>;
  }

  if (!editando) {
    return (
      <p className="text-xs text-[var(--fo-muted)]">
        Embalaje: <span className="text-[var(--fo-text)]">{texto}</span>
        {elegido ? " (cambiado a mano)" : ""} ·{" "}
        <button type="button" className="underline hover:text-[var(--fo-text)]" onClick={() => setEditando(true)}>
          Cambiar
        </button>
      </p>
    );
  }

  const cantidad = (id: string) => actual.find((e) => e.insumoId === id)?.qty ?? 0;
  const poner = (id: string, qty: number) => {
    const sin = actual.filter((e) => e.insumoId !== id);
    onElegido([...sin, { insumoId: id, qty: Math.max(0, Math.min(999, Math.trunc(qty) || 0)) }]);
  };

  return (
    <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-2 text-xs">
      <p className="font-medium text-[var(--fo-muted)]">Embalaje de esta venta</p>
      {vista.opciones.map((o) => (
        <label key={o.insumoId} className="flex items-center justify-between gap-2">
          <span className="text-[var(--fo-text)]">{o.nombre}</span>
          <input
            type="number"
            min={0}
            max={999}
            className="fo-input h-8 w-16 text-right"
            value={cantidad(o.insumoId)}
            onChange={(e) => poner(o.insumoId, Number(e.target.value))}
            aria-label={`Cantidad de ${o.nombre}`}
          />
        </label>
      ))}
      <div className="flex justify-between gap-2">
        <button
          type="button"
          className="underline text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
          onClick={() => {
            onElegido(null);
            setEditando(false);
          }}
        >
          Volver a lo calculado
        </button>
        <button type="button" className="fo-btn h-8 text-xs" onClick={() => setEditando(false)}>
          Listo
        </button>
      </div>
    </div>
  );
}
