"use client";

import { useState, useTransition } from "react";
import { Truck } from "lucide-react";
import { guardarEnvioSinArchivosAction, guardarProveedorPorDefectoAction } from "./presupuesto-actions";

/**
 * «Proveedor por defecto»: a qué laboratorio va este producto. El pedido le sale por correo cuando
 * está completo: con los archivos subidos o, si el material es físico (un rollo), al cobrar. Es el
 * mismo dato que «Proyecto que genera» (más abajo), puesto arriba y a la vista.
 */
export function ProveedorPorDefecto({
  productId,
  actual,
  proveedores,
  generaTrabajo,
  envioSinArchivos,
}: {
  productId: string;
  /** null = se hace en el estudio; "varios" si sus reglas tienen proveedores distintos. */
  actual: string | null;
  proveedores: { id: string; name: string; email: string | null }[];
  generaTrabajo: boolean;
  envioSinArchivos: boolean;
}) {
  const [fisico, setFisico] = useState(envioSinArchivos);
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

  function cambiarFisico(v: boolean) {
    setFisico(v);
    setAviso(null);
    start(async () => {
      const r = await guardarEnvioSinArchivosAction(productId, v);
      if (!r.ok) setFisico(!v);
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
            {fisico
              ? "Al cobrar, el pedido se le manda por correo a este proveedor en el momento (sin archivos: el material se lo llevan al local)."
              : "El pedido se le manda por correo a este proveedor cuando el trabajo tiene los archivos subidos: si se cobra sin archivos, queda «Faltan los archivos» y sale solo a los pocos minutos de subirlos."}
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
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={fisico} onChange={(e) => cambiarFisico(e.target.checked)} disabled={guardando} className="mt-0.5 size-4" />
            <span>
              El material es físico (se manda sin archivos)
              <span className="block text-xs text-[var(--fo-muted)]">Por ejemplo, un rollo para revelar. Sin marcar, el pedido espera a que se suban los archivos.</span>
            </span>
          </label>
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
