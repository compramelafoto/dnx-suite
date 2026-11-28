"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { agregarItemAlPedidoAction } from "@/app/actions/pedidos";
import { InputMoneda } from "@/components/campos/input-moneda";
import { BuscadorCatalogo } from "@/components/presupuestos/buscador-catalogo";
import type { ProductoParaEditor } from "@/lib/presupuestos/editor";
import { pesosPedido } from "@/lib/pedidos/pantalla";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

type Renglon = { productId: string | null; nombre: string; cantidad: string; precio: string };

const nuevaClave = () => `a${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

/**
 * «Agregar producto» en la ficha de un pedido ya tomado: un producto del catálogo (o un renglón de
 * texto libre) que se suma al mismo pedido. Sube el saldo y crea su trabajo en el tablero, como si
 * hubiera estado desde el principio. El servidor vuelve a calcular y validar todo.
 */
export function AgregarAlPedido({ pedidoId, numero, catalogo }: { pedidoId: string; numero: string; catalogo: ProductoParaEditor[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [r, setR] = useState<Renglon | null>(null);
  const [entrega, setEntrega] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  // Una clave por renglón: un doble clic o un reintento no suman dos veces.
  const clave = useRef(nuevaClave());

  const cantidad = r ? Number(r.cantidad) : 0;
  const precio = r ? Number(r.precio) : 0;
  const neto = Number.isFinite(cantidad) && Number.isFinite(precio) ? Math.round(cantidad * precio * 100) / 100 : 0;

  function empezar(nuevo: Renglon) {
    clave.current = nuevaClave();
    setR(nuevo);
    setError(null);
    setHecho(null);
  }

  function agregar() {
    if (!r) return;
    if (!r.nombre.trim()) return setError("Escribí qué se agrega.");
    if (!Number.isInteger(cantidad) || cantidad < 1) return setError("La cantidad tiene que ser un número entero mayor que cero.");
    if (!Number.isFinite(precio) || precio < 0) return setError("El precio no es válido.");
    setError(null);
    iniciar(async () => {
      const res = await agregarItemAlPedidoAction({
        pedidoId,
        productId: r.productId,
        nombre: r.nombre.trim(),
        cantidad,
        precioUnitario: precio,
        entrega: entrega || null,
        clave: clave.current,
      }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const trabajos = res.trabajos === 1 ? " Se creó su trabajo en el tablero." : res.trabajos > 1 ? ` Se crearon ${res.trabajos} trabajos en el tablero.` : "";
      setHecho(`${r.nombre.trim()} se sumó al pedido ${numero}${res.saldoAgregadoArs > 0 ? `: el saldo subió ${pesosPedido(res.saldoAgregadoArs)}` : ""}.${trabajos}`);
      setR(null);
      setEntrega("");
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <div className="space-y-1">
        <button type="button" className="fo-btn fo-btn-secondary inline-flex items-center gap-1.5 text-sm" onClick={() => setAbierto(true)}>
          <Plus className="size-4" aria-hidden />
          Agregar producto
        </button>
        {hecho ? (
          <p role="status" className="text-sm text-[var(--fo-success)]">
            {hecho}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section aria-labelledby="agregar-al-pedido" className="fo-card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="agregar-al-pedido" className="text-base font-semibold text-[var(--fo-text)]">
            Agregar producto al pedido {numero}
          </h2>
          <p className="text-xs text-[var(--fo-muted)]">
            Por ejemplo, un cassette más o un portarretrato. Se suma a este mismo pedido: sube el saldo a cobrar y, si lleva proceso, aparece su trabajo
            en el tablero.
          </p>
        </div>
        <button
          type="button"
          className="fo-btn fo-btn-ghost text-xs"
          onClick={() => {
            setAbierto(false);
            setR(null);
            setError(null);
          }}
        >
          Cerrar
        </button>
      </div>

      {hecho ? (
        <p role="status" className="text-sm text-[var(--fo-success)]">
          {hecho}
        </p>
      ) : null}

      {!r ? (
        <div className="space-y-2">
          <BuscadorCatalogo
            id="agregar-al-pedido-buscar"
            catalogo={catalogo}
            onElegir={(p) => empezar({ productId: p.id, nombre: p.nombre, cantidad: "1", precio: String(p.precio) })}
          />
          <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => empezar({ productId: null, nombre: "", cantidad: "1", precio: "" })}>
            O agregar un renglón de texto libre
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_9rem]">
            <label className="fo-field-stack text-sm">
              <span className="text-xs text-[var(--fo-muted)]">Qué se agrega</span>
              <input className="fo-input" value={r.nombre} maxLength={200} onChange={(e) => setR({ ...r, nombre: e.target.value })} />
            </label>
            <label className="fo-field-stack text-sm">
              <span className="text-xs text-[var(--fo-muted)]">Cantidad</span>
              <input
                type="number"
                min={1}
                step={1}
                className="fo-input tabular-nums"
                value={r.cantidad}
                onChange={(e) => setR({ ...r, cantidad: e.target.value })}
              />
            </label>
            <label className="fo-field-stack text-sm">
              <span className="text-xs text-[var(--fo-muted)]">Precio unitario</span>
              <InputMoneda envio="punto" className="fo-input w-full" value={r.precio} onChange={(v) => setR({ ...r, precio: v })} aria-label="Precio unitario" />
            </label>
          </div>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[var(--fo-muted)]">Entrega prometida (opcional)</span>
            <input type="date" className="fo-input h-9 w-44 text-sm" value={entrega} onChange={(e) => setEntrega(e.target.value)} aria-label="Entrega prometida" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setR(null)} disabled={pendiente}>
              Elegir otro
            </button>
            <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={agregar} disabled={pendiente}>
              {pendiente ? "Agregando…" : `Agregar ${pesosPedido(neto)} al pedido`}
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="rounded-[var(--fo-radius-sm)] bg-[var(--fo-danger-soft)] p-3 text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
