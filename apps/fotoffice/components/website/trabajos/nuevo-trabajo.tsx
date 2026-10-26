"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { crearTrabajoAction } from "@/app/actions/trabajos";
import { TRABAJOS_ADMIN_BASE } from "@/lib/trabajos/reglas";

/**
 * Alta rápida: con el título (y la categoría, si ya hay) alcanza. El resto —fotos, descripción,
 * fecha— se completa en la ficha, adonde se va apenas se crea.
 */
export function NuevoTrabajo({ categorias }: { categorias: { id: string; nombre: string }[] }) {
  const [titulo, setTitulo] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();

  function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    empezar(async () => {
      const r = await crearTrabajoAction({ titulo, categoriaId: categoriaId || null });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`${TRABAJOS_ADMIN_BASE}/${r.valor.id}`);
    });
  }

  return (
    <form onSubmit={crear} className="fo-card space-y-3">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="fo-label">Nuevo trabajo</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Casamiento de Sofi y Juan"
            maxLength={200}
            className="fo-input"
            required
          />
        </label>
        <label className="block">
          <span className="fo-label">Categoría</span>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="fo-input">
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pendiente || !titulo.trim()}>
          <Plus size={16} aria-hidden /> {pendiente ? "Creando…" : "Crear"}
        </button>
      </div>
      {categorias.length === 0 ? (
        <p className="text-xs text-[var(--fo-muted)]">
          Todavía no hay categorías (Casamientos, XV, Books…). Podés crearlas en la pestaña Categorías: un trabajo sin
          categoría no se muestra en el sitio.
        </p>
      ) : null}
      {error ? <p className="fo-alert-error text-sm">{error}</p> : null}
    </form>
  );
}
