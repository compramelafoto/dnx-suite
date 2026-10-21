"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SugerenciaUnion } from "@/lib/precios-proveedor/repositorio";
import { unirProveedoresAction } from "./actions";

const CREAR = "__crear__";

/**
 * Los productos traen el proveedor como texto libre ("LA ISLA", "FOTOLAG"). Esto los une con
 * la lista de Proveedores para que el costo pueda salir de ahí. Sólo toca productos sin
 * proveedor preferido.
 */
export function UnionProveedores({ sugerencias, proveedores }: { sugerencias: SugerenciaUnion[]; proveedores: { id: string; name: string }[] }) {
  const router = useRouter();
  const [eleccion, setEleccion] = useState<Record<string, string>>(() =>
    Object.fromEntries(sugerencias.map((s) => [s.texto, s.proveedorId ?? ""])),
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function unir() {
    const pares = sugerencias
      .filter((s) => eleccion[s.texto])
      .map((s) => (eleccion[s.texto] === CREAR ? { texto: s.texto, proveedorId: null, crear: true } : { texto: s.texto, proveedorId: eleccion[s.texto]! }));
    if (pares.length === 0) return;
    startTransition(async () => {
      const r = await unirProveedoresAction(pares);
      setAviso(r.ok ? `Listo: ${r.cantidad} productos quedaron con su proveedor preferido.` : r.error);
      router.refresh();
    });
  }

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Unir los proveedores escritos a mano</h2>
        <p className="fo-helper">
          Estos productos tienen el proveedor escrito como texto y todavía no tienen proveedor preferido. Elegí a cuál de tus
          proveedores corresponde cada uno (o crealo) y unilos de una vez.
        </p>
      </div>
      <div className="divide-y divide-[var(--fo-border)]">
        {sugerencias.map((s) => (
          <div key={s.texto} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <div className="text-sm">
              <span className="font-medium">{s.texto}</span>{" "}
              <span className="text-[var(--fo-muted)]">· {s.productos} productos</span>
            </div>
            <select
              className="fo-input max-w-[260px]"
              aria-label={`Proveedor para ${s.texto}`}
              value={eleccion[s.texto] ?? ""}
              onChange={(e) => setEleccion((prev) => ({ ...prev, [s.texto]: e.target.value }))}
            >
              <option value="">No unir (producción propia u otro)</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value={CREAR}>Crear el proveedor «{s.texto}»</option>
            </select>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={unir}>
          {pendiente ? "Uniendo…" : "Unir proveedores"}
        </button>
        {aviso ? <p className="text-sm text-[var(--fo-muted)]">{aviso}</p> : null}
      </div>
    </section>
  );
}
