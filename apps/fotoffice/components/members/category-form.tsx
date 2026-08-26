"use client";

import { useActionState } from "react";
import {
  createMemberCategoryAction,
  updateMemberCategoryAction,
  type MemberFormState,
} from "@/app/actions/members";

const initial: MemberFormState = { error: null };

type CategoryInitial = {
  id: string;
  name: string;
  description: string | null;
  order: number;
  isActive: boolean;
};

export function CategoryForm({ category }: { category?: CategoryInitial }) {
  const [state, action, pending] = useActionState(
    category ? updateMemberCategoryAction : createMemberCategoryAction,
    initial,
  );
  const fe = state.fieldErrors;

  return (
    <form action={action} className="fo-section-gap max-w-xl">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}

      <section className="fo-card space-y-6">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="name">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={category?.name}
            className="fo-input"
            placeholder="Ej. Socio activo"
          />
          {fe?.name ? <p className="text-xs text-[var(--fo-danger)]">{fe.name}</p> : null}
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="description">
            Descripción
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={category?.description ?? ""}
            className="fo-input"
            placeholder="Opcional — qué distingue a esta categoría."
          />
        </div>
        <div className="fo-field-stack sm:max-w-xs">
          <label className="fo-label" htmlFor="order">
            Orden
          </label>
          <input
            id="order"
            name="order"
            type="number"
            min={0}
            max={10000}
            defaultValue={category?.order ?? 0}
            className="fo-input"
          />
          <p className="fo-helper">Categorías con número más bajo aparecen primero.</p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={category?.isActive ?? true}
            className="mt-1 size-4 rounded border-[var(--fo-border)] text-[var(--fo-accent)] focus:ring-[var(--fo-accent)]"
          />
          <span>
            <span className="fo-label !inline">Activa</span>
            <span className="fo-helper block mt-1">
              Una categoría desactivada no se ofrece para socios nuevos, pero los socios que ya la
              tienen la conservan.
            </span>
          </span>
        </label>
      </section>

      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
          {pending ? "Guardando…" : category ? "Guardar cambios" : "Crear categoría"}
        </button>
      </div>
    </form>
  );
}
