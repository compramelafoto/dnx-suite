"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMinorArs, parseArsToMinor } from "@/lib/membership/money";
import type { CambiosFilaCosto, FilaCosto } from "@/lib/precios-proveedor/repositorio";
import { aplicarPrecioSugeridoAction, asignarProveedorMasivoAction, calibrarMargenesAction, guardarFilaCostoAction } from "./actions";

/** "7.500" para el campo; vacío si no hay importe. */
function aTexto(minor: number | null): string {
  if (minor === null) return "";
  return formatMinorArs(minor).replace("$", "").replace(/,00$/, "").trim();
}

function margenATexto(m: number | null): string {
  return m === null ? "" : String(m).replace(".", ",");
}

function textoAMargen(t: string): number | null | "error" {
  const limpio = t.replace("%", "").trim().replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : "error";
}

type Proveedor = { id: string; name: string };

/**
 * La tabla de costos: cada celda se guarda al salir de ella. Cambiar costo o margen recalcula
 * el precio de esa fila; cambiar el precio a mano recalcula el margen. Las acciones sobre
 * varios productos (calibrar, llevar al sugerido) muestran antes qué van a cambiar.
 */
export function TablaCostos({ filasIniciales, proveedores }: { filasIniciales: FilaCosto[]; proveedores: Proveedor[] }) {
  const router = useRouter();
  const [filas, setFilas] = useState(filasIniciales);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [proveedorMasivo, setProveedorMasivo] = useState("");
  const [confirmando, setConfirmando] = useState<"sugerido" | "calibrar" | null>(null);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    setFilas(filasIniciales);
    setElegidos((prev) => new Set([...prev].filter((id) => filasIniciales.some((f) => f.id === id))));
  }, [filasIniciales]);

  const nombreProveedor = useMemo(() => new Map(proveedores.map((p) => [p.id, p.name])), [proveedores]);
  const seleccion = filas.filter((f) => elegidos.has(f.id));
  const cambiosSugeridos = seleccion.filter((f) => f.precioSugeridoMinor !== null && f.precioSugeridoMinor !== f.priceMinor);
  const calibrables = seleccion.filter((f) => f.costMinor !== null && f.costMinor > 0);

  function guardar(fila: FilaCosto, cambios: CambiosFilaCosto) {
    startTransition(async () => {
      const r = await guardarFilaCostoAction(fila.id, cambios);
      if (r.ok) {
        setFilas((prev) => prev.map((f) => (f.id === fila.id ? r.fila : f)));
        setErrores((prev) => {
          const resto = { ...prev };
          delete resto[fila.id];
          return resto;
        });
      } else {
        setErrores((prev) => ({ ...prev, [fila.id]: r.error }));
      }
    });
  }

  function alSalirDeCosto(fila: FilaCosto, texto: string) {
    const minor = texto.trim() === "" ? null : parseArsToMinor(texto);
    if (texto.trim() !== "" && minor === null) return setErrores((p) => ({ ...p, [fila.id]: "El costo no se entiende." }));
    if (minor !== fila.costMinor) guardar(fila, { costMinor: minor });
  }

  function alSalirDeMargen(fila: FilaCosto, texto: string) {
    const m = textoAMargen(texto);
    if (m === "error") return setErrores((p) => ({ ...p, [fila.id]: "El margen no se entiende." }));
    if (m !== fila.marginPct) guardar(fila, { marginPct: m });
  }

  function alSalirDePrecio(fila: FilaCosto, texto: string) {
    const minor = parseArsToMinor(texto);
    if (minor === null) return setErrores((p) => ({ ...p, [fila.id]: "El precio no se entiende." }));
    if (minor !== fila.priceMinor) guardar(fila, { priceMinor: minor });
  }

  function alternar(id: string) {
    setElegidos((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function masivo(accion: () => Promise<string>) {
    startTransition(async () => {
      setAviso(await accion());
      setConfirmando(null);
      router.refresh();
    });
  }

  const todos = filas.length > 0 && filas.every((f) => elegidos.has(f.id));

  return (
    <section className="space-y-3">
      {elegidos.size > 0 ? (
        <div className="fo-card sticky top-2 z-10 flex flex-wrap items-center gap-2 !p-3 text-sm">
          <span className="font-medium">{elegidos.size} elegidos</span>
          <select className="fo-input max-w-[200px]" value={proveedorMasivo} onChange={(e) => setProveedorMasivo(e.target.value)} aria-label="Proveedor para los elegidos">
            <option value="">Proveedor preferido…</option>
            <option value="ninguno">Sin proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="fo-btn fo-btn-secondary text-sm"
            disabled={pendiente || proveedorMasivo === ""}
            onClick={() =>
              masivo(async () => {
                const r = await asignarProveedorMasivoAction([...elegidos], proveedorMasivo === "ninguno" ? null : proveedorMasivo);
                return r.ok ? `Proveedor asignado a ${r.cantidad} productos.` : r.error;
              })
            }
          >
            Asignar
          </button>
          <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => setConfirmando("calibrar")}>
            Calibrar margen
          </button>
          <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => setConfirmando("sugerido")}>
            Llevar al precio sugerido
          </button>
          <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setElegidos(new Set())}>
            Soltar
          </button>
        </div>
      ) : null}

      {confirmando === "calibrar" ? (
        <div className="fo-card space-y-3 p-4 text-sm">
          <p>
            Se va a calcular el margen de <strong>{calibrables.length}</strong> productos a partir de su precio de hoy y su costo. No cambia
            ningún precio.
            {seleccion.length - calibrables.length > 0 ? ` ${seleccion.length - calibrables.length} no tienen costo y quedan como están.` : ""}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="fo-btn fo-btn-primary text-sm"
              disabled={pendiente || calibrables.length === 0}
              onClick={() =>
                masivo(async () => {
                  const r = await calibrarMargenesAction(calibrables.map((f) => f.id));
                  return r.ok ? `Margen calculado en ${r.calibrados} productos.` : r.error;
                })
              }
            >
              Calibrar
            </button>
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setConfirmando(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {confirmando === "sugerido" ? (
        <div className="fo-card space-y-3 p-4 text-sm">
          {cambiosSugeridos.length === 0 ? (
            <p>Ninguno de los elegidos cambia: o ya están en su precio sugerido, o les falta costo o margen.</p>
          ) : (
            <>
              <p>Estos precios van a cambiar:</p>
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {cambiosSugeridos.map((f) => (
                  <li key={f.id} className="flex justify-between gap-4">
                    <span>{f.name}</span>
                    <span className="tabular-nums">
                      {formatMinorArs(f.priceMinor)} → <strong>{formatMinorArs(f.precioSugeridoMinor!)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="fo-btn fo-btn-primary text-sm"
              disabled={pendiente || cambiosSugeridos.length === 0}
              onClick={() =>
                masivo(async () => {
                  const r = await aplicarPrecioSugeridoAction(cambiosSugeridos.map((f) => f.id));
                  return r.ok ? `Listo: ${r.cantidad} precios actualizados.` : r.error;
                })
              }
            >
              Confirmar {cambiosSugeridos.length} cambios
            </button>
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setConfirmando(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {aviso ? <p className="fo-card p-3 text-sm text-[var(--fo-success)]">{aviso}</p> : null}

      {filas.length === 0 ? (
        <div className="fo-card px-6 py-12 text-center text-sm text-[var(--fo-muted)]">Ningún producto activo coincide con el filtro.</div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Elegir todos"
                    checked={todos}
                    onChange={() => setElegidos(todos ? new Set() : new Set(filas.map((f) => f.id)))}
                  />
                </th>
                <th className="px-3 py-3 font-semibold">Producto</th>
                <th className="px-3 py-3 font-semibold">Proveedor preferido</th>
                <th className="px-3 py-3 font-semibold">Costo</th>
                <th className="px-3 py-3 font-semibold">Margen %</th>
                <th className="px-3 py-3 font-semibold">Precio</th>
                <th className="px-3 py-3 font-semibold">Sugerido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {filas.map((f) => {
                const distinto = f.precioSugeridoMinor !== null && f.precioSugeridoMinor !== f.priceMinor;
                return (
                  <tr key={f.id} className="align-top">
                    <td className="px-3 py-2">
                      <input type="checkbox" aria-label={`Elegir ${f.name}`} checked={elegidos.has(f.id)} onChange={() => alternar(f.id)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-[var(--fo-text)]">{f.name}</div>
                      <div className="text-xs text-[var(--fo-muted)]">
                        {[f.categoryName, f.supplierName && !f.preferredProveedorId ? `escrito: ${f.supplierName}` : null].filter(Boolean).join(" · ")}
                        {f.variantesConPrecio ? " · tiene talles con precio propio" : ""}
                      </div>
                      {errores[f.id] ? <div className="text-xs text-[var(--fo-danger)]">{errores[f.id]}</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="fo-input min-w-[140px]"
                        aria-label={`Proveedor de ${f.name}`}
                        value={f.preferredProveedorId ?? ""}
                        onChange={(e) => guardar(f, { preferredProveedorId: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {proveedores.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                        {f.preferredProveedorId && !nombreProveedor.has(f.preferredProveedorId) ? (
                          <option value={f.preferredProveedorId}>(proveedor inactivo)</option>
                        ) : null}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        key={`c-${f.id}-${f.costMinor}`}
                        className="fo-input w-28 tabular-nums"
                        inputMode="decimal"
                        defaultValue={aTexto(f.costMinor)}
                        aria-label={`Costo de ${f.name}`}
                        onBlur={(e) => alSalirDeCosto(f, e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        key={`m-${f.id}-${f.marginPct}`}
                        className="fo-input w-20 tabular-nums"
                        inputMode="decimal"
                        defaultValue={margenATexto(f.marginPct)}
                        aria-label={`Margen de ${f.name}`}
                        onBlur={(e) => alSalirDeMargen(f, e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        key={`p-${f.id}-${f.priceMinor}`}
                        className="fo-input w-28 tabular-nums"
                        inputMode="decimal"
                        defaultValue={aTexto(f.priceMinor)}
                        aria-label={`Precio de ${f.name}`}
                        onBlur={(e) => alSalirDePrecio(f, e.target.value)}
                      />
                    </td>
                    <td className={`px-3 py-2 tabular-nums ${distinto ? "font-semibold text-[var(--fo-accent)]" : "text-[var(--fo-muted)]"}`}>
                      {f.precioSugeridoMinor === null ? "—" : formatMinorArs(f.precioSugeridoMinor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="fo-helper">
        Cada celda se guarda al salir de ella. Con costo y margen cargados, el precio se recalcula solo. Si cambiás el precio a mano,
        el margen se ajusta a ese precio.
      </p>
    </section>
  );
}
