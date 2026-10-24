"use client";

import { useState, useTransition } from "react";
import { Truck } from "lucide-react";
import { guardarProveedorPorDefectoAction } from "./presupuesto-actions";

/**
 * «Proveedor por defecto»: a qué laboratorio va este producto. Al cargar un pedido, el trabajo se
 * le manda por correo a ese proveedor en el momento. Es el mismo dato que «Proyecto que genera»
 * (más abajo), puesto arriba y a la vista.
 */
export function ProveedorPorDefecto({
  productId,
  actual,
  proveedores,
  generaTrabajo,
}: {
  productId: string;
  /** null = se hace en el estudio; "varios" si sus reglas tienen proveedores distintos. */
  actual: string | null;
  proveedores: { id: string; name: string; email: string | null }[];
  generaTrabajo: boolean;
}) {
  const [valor, setValor] = useState(actual ?? "");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, start] = useTransition();
  const elegido = proveedores.find((p) => p.id === valor);

  function cambiar(v: string) {
    setValor(v);
    setAviso(null);
    start(async () => {
      const r = await guardarProveedorPorDefectoAction(productId, v);
      setAviso(r.ok ? { ok: true, texto: "Guardado." } : { ok: false, texto: r.error });
    });
  }

  return (
    <section className="fo-card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Truck className="size-5 text-[var(--fo-accent)]" aria-hidden />
        <h2 className="text-base font-semibold">Proveedor por defecto</h2>
      </div>
      {!generaTrabajo ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Este producto se entrega en el momento (no genera un trabajo). Para mandarlo a un laboratorio, activá «Proyecto que genera» más abajo.
        </p>
      ) : (
        <>
          <p className="text-sm text-[var(--fo-muted)]">
            Al cargar un pedido con este producto, el trabajo se le manda por correo a este proveedor en el momento, con el enlace a la carpeta de
            archivos.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select value={valor} onChange={(e) => cambiar(e.target.value)} disabled={guardando} className="fo-input h-10 w-72 text-sm" aria-label="Proveedor por defecto">
              <option value="">Se hace en el estudio (sin proveedor)</option>
              {actual === "varios" ? <option value="varios" disabled>Varios proveedores</option> : null}
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {guardando ? <span className="text-xs text-[var(--fo-muted)]">Guardando…</span> : null}
            {aviso ? <span className={`text-xs ${aviso.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`}>{aviso.texto}</span> : null}
          </div>
          {elegido && !elegido.email ? (
            <p className="text-xs text-[var(--fo-danger)]">{elegido.name} no tiene correo cargado (Configuración → Proveedores): el pedido no le va a llegar.</p>
          ) : elegido?.email ? (
            <p className="text-xs text-[var(--fo-muted)]">Le llega a {elegido.email}.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
