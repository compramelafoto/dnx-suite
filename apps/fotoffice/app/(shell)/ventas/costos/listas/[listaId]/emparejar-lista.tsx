"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMinorArs } from "@/lib/membership/money";
import { normalizarTexto } from "@/lib/precios-proveedor/clave";
import type { DetalleLista, ItemLista } from "@/lib/precios-proveedor/repositorio";
import type { FilaVistaPrevia, MarcaVistaPrevia } from "@/lib/precios-proveedor/vista-previa";
import { aplicarListaAction, descartarListaAction, emparejarProductoAction, soltarProductoAction } from "../../actions";

type Producto = { id: string; name: string; categoryName: string | null; deEsteProveedor: boolean };

const MARCAS: Record<MarcaVistaPrevia, string> = {
  SIN_MARGEN: "sin margen: sólo cambia el costo",
  BAJA: "el precio baja",
  SUBE_MUCHO: "sube más de 30 %",
  OTRO_PROVEEDOR: "su proveedor preferido es otro: no cambia",
  VARIANTES: "tiene talles con precio propio",
};

function detalle(i: ItemLista): string {
  return [i.tipo !== "PRODUCTO" ? i.tipo.toLowerCase() : null, i.modelo, i.medida, i.variante, i.cantidadMinima ? `desde ${i.cantidadMinima}` : null, i.unidad !== "unidad" ? `por ${i.unidad}` : null]
    .filter(Boolean)
    .join(" · ");
}

function SelectorProducto({ productos, onElegir, onCancelar }: { productos: Producto[]; onElegir: (id: string) => void; onCancelar: () => void }) {
  const [q, setQ] = useState("");
  const resultados = useMemo(() => {
    const n = normalizarTexto(q);
    if (n === "") return productos.filter((p) => p.deEsteProveedor).slice(0, 8);
    return productos.filter((p) => normalizarTexto(`${p.name} ${p.categoryName ?? ""}`).includes(n)).slice(0, 8);
  }, [q, productos]);
  return (
    <div className="space-y-1">
      <input autoFocus className="fo-input w-full" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar producto" />
      <ul className="rounded border border-[var(--fo-border)] bg-[var(--fo-surface)]">
        {resultados.map((p) => (
          <li key={p.id}>
            <button type="button" className="w-full px-2 py-1 text-left text-xs hover:bg-[var(--fo-surface-hover)]" onClick={() => onElegir(p.id)}>
              {p.name}
              {p.categoryName ? <span className="text-[var(--fo-muted)]"> · {p.categoryName}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Emparejar renglón ↔ producto, con la vista previa al lado. Lo emparejado se recuerda al
 * aplicar, y la próxima lista del mismo proveedor ya llega emparejada.
 */
export function EmparejarLista({ lista, vistaInicial, productos }: { lista: DetalleLista; vistaInicial: FilaVistaPrevia[]; productos: Producto[] }) {
  const router = useRouter();
  const editable = lista.estado === "BORRADOR";
  const [items, setItems] = useState(lista.items);
  const [vista, setVista] = useState(vistaInicial);
  const [editando, setEditando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "con" | "sin">("todos");
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const nombre = useMemo(() => new Map(productos.map((p) => [p.id, p.name])), [productos]);
  const visibles = items.filter((i) => (filtro === "con" ? i.productos.length > 0 : filtro === "sin" ? i.productos.length === 0 : true));
  const conProducto = items.filter((i) => i.productos.length > 0).length;
  const aplican = vista.filter((f) => f.aplica);
  const cambianPrecio = aplican.filter((f) => f.precioNuevoMinor !== f.precioAntesMinor);

  function emparejar(item: ItemLista, productId: string, factor: number) {
    setError(null);
    startTransition(async () => {
      const r = await emparejarProductoAction(lista.id, item.id, productId, factor);
      if (!r.ok) return setError(r.error);
      setItems((prev) =>
        prev.map((i) => {
          const sin = i.productos.filter((p) => p.productId !== productId);
          return i.id === item.id ? { ...i, productos: [...sin, { productId, factor, recordado: false }] } : { ...i, productos: sin };
        }),
      );
      setVista(r.vista);
      setEditando(null);
    });
  }

  function soltar(item: ItemLista, productId: string) {
    setError(null);
    startTransition(async () => {
      const r = await soltarProductoAction(lista.id, item.id, productId);
      if (!r.ok) return setError(r.error);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, productos: i.productos.filter((p) => p.productId !== productId) } : i)));
      setVista(r.vista);
    });
  }

  function aplicar() {
    startTransition(async () => {
      const r = await aplicarListaAction(lista.id);
      if (!r.ok) return setError(r.error);
      router.push(`/ventas/costos?ok=${r.actualizados}`);
    });
  }

  function descartar() {
    startTransition(async () => {
      const r = await descartarListaAction(lista.id);
      if (!r.ok) return setError(r.error);
      router.push("/ventas/costos/listas");
    });
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="fo-card p-3 text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            Renglones ({items.length} · {conProducto} con producto)
          </h2>
          <div className="flex gap-1 text-sm">
            {(["todos", "con", "sin"] as const).map((f) => (
              <button key={f} type="button" className={`fo-btn text-xs ${filtro === f ? "fo-btn-secondary" : "fo-btn-ghost"}`} onClick={() => setFiltro(f)}>
                {f === "todos" ? "Todos" : f === "con" ? "Con producto" : "Sin producto"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-3 py-2 font-semibold">Renglón del proveedor</th>
                <th className="px-3 py-2 font-semibold">Costo</th>
                <th className="w-[420px] px-3 py-2 font-semibold">Tus productos (× factor)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {visibles.map((i) => (
                <tr key={i.id} className="align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{i.producto}</div>
                    <div className="text-xs text-[var(--fo-muted)]">{[i.categoria, detalle(i)].filter(Boolean).join(" · ")}</div>
                    {i.notas ? <div className="text-xs text-[var(--fo-muted)]">{i.notas}</div> : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatMinorArs(i.costoMinor)}</td>
                  <td className="space-y-1 px-3 py-2">
                    {i.productos.map((p) => (
                      <div key={p.productId} className="flex items-center justify-between gap-2">
                        <span>
                          {nombre.get(p.productId) ?? "(producto inactivo)"}
                          <span className="text-xs text-[var(--fo-muted)]"> · {p.recordado ? "recordado" : "sugerido"}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          {editable ? (
                            <>
                              <input
                                key={`${p.productId}-${p.factor}`}
                                className="fo-input w-16 tabular-nums"
                                inputMode="decimal"
                                defaultValue={String(p.factor).replace(".", ",")}
                                aria-label={`Factor de ${nombre.get(p.productId) ?? "producto"}`}
                                title="Costo del producto = costo del renglón × factor (por ejemplo 0,6 para un 60x100 si el precio es por m²)"
                                onBlur={(e) => {
                                  const n = Number(e.target.value.replace(",", "."));
                                  if (Number.isFinite(n) && n > 0 && n !== p.factor) emparejar(i, p.productId, n);
                                }}
                              />
                              <button type="button" className="fo-btn fo-btn-ghost text-xs" aria-label="Quitar" onClick={() => soltar(i, p.productId)}>
                                ×
                              </button>
                            </>
                          ) : (
                            <span className="text-xs tabular-nums">× {String(p.factor).replace(".", ",")}</span>
                          )}
                        </span>
                      </div>
                    ))}
                    {editable ? (
                      editando === i.id ? (
                        <SelectorProducto productos={productos} onElegir={(id) => emparejar(i, id, 1)} onCancelar={() => setEditando(null)} />
                      ) : (
                        <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setEditando(i.id)}>
                          + Agregar producto
                        </button>
                      )
                    ) : i.productos.length === 0 ? (
                      <span className="text-[var(--fo-muted)]">—</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Vista previa</h2>
        {vista.length === 0 ? (
          <p className="fo-helper">Ningún renglón tiene producto todavía.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Producto</th>
                  <th className="px-3 py-2 font-semibold">Costo</th>
                  <th className="px-3 py-2 font-semibold">Precio</th>
                  <th className="px-3 py-2 font-semibold">Avisos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
                {vista.map((f) => (
                  <tr key={f.productId} className={f.aplica ? "" : "opacity-60"}>
                    <td className="px-3 py-2 font-medium">{f.nombre}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {f.costoAntesMinor === null ? "—" : formatMinorArs(f.costoAntesMinor)} → {formatMinorArs(f.costoNuevoMinor)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMinorArs(f.precioAntesMinor)}
                      {f.precioNuevoMinor !== f.precioAntesMinor ? (
                        <>
                          {" → "}
                          <strong>{formatMinorArs(f.precioNuevoMinor)}</strong>
                          <span className="text-xs text-[var(--fo-muted)]"> ({Math.round(((f.precioNuevoMinor - f.precioAntesMinor) / Math.max(f.precioAntesMinor, 1)) * 100)} %)</span>
                        </>
                      ) : null}
                    </td>
                    <td className={`px-3 py-2 text-xs ${f.marcas.some((m) => m === "BAJA" || m === "SUBE_MUCHO") ? "text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}`}>
                      {f.marcas.map((m) => MARCAS[m]).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editable ? (
        <section className="fo-card space-y-3 p-5">
          {confirmar ? (
            <>
              <p className="text-sm">
                Se va a actualizar el costo de <strong>{aplican.length}</strong> productos y el precio de <strong>{cambianPrecio.length}</strong>. Los
                emparejamientos quedan guardados para la próxima lista de {lista.proveedor}. ¿Confirmás?
              </p>
              <div className="flex gap-2">
                <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={aplicar}>
                  {pendiente ? "Aplicando…" : "Sí, aplicar"}
                </button>
                <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setConfirmar(false)}>
                  Volver
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || conProducto === 0} onClick={() => setConfirmar(true)}>
                Aplicar la lista
              </button>
              <button type="button" className="fo-btn fo-btn-ghost text-sm" disabled={pendiente} onClick={descartar}>
                Descartar
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
