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
  bookingCreditsPerPayment: number;
  bookingCreditValidityDays: number;
  bookingCreditLabel: string | null;
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
            placeholder="Ej. Activo"
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
            {/* Reformulado: "socios nuevos" concordaba "nuevos" en masculino con la palabra
                configurada, y "los socios" con el mismo problema en el artículo. "altas
                nuevas" y "quienes" no dependen del género de la palabra elegida. */}
            <span className="fo-helper block mt-1">
              Una categoría desactivada no se ofrece en altas nuevas, pero quienes ya la tienen
              la conservan.
            </span>
          </span>
        </label>
      </section>

      <section className="fo-card space-y-4">
        <div>
          <h2 className="text-base font-semibold">Turnos incluidos</h2>
          <p className="fo-helper mt-1">
            Para un club con turnos incluidos, como el VIP de una barbería: cada pago acreditado
            abre una bolsa con estos turnos, que vence a los días indicados desde ese pago. No se
            acumulan: si paga de nuevo, lo que no usó se pierde. Dejá 0 si la categoría no incluye
            turnos.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="bookingCreditsPerPayment">
              Turnos por pago
            </label>
            <input
              id="bookingCreditsPerPayment"
              name="bookingCreditsPerPayment"
              type="number"
              min={0}
              max={100}
              defaultValue={category?.bookingCreditsPerPayment ?? 0}
              className="fo-input"
            />
            {fe?.bookingCreditsPerPayment ? (
              <p className="text-xs text-[var(--fo-danger)]">{fe.bookingCreditsPerPayment}</p>
            ) : null}
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="bookingCreditValidityDays">
              Vencen a los (días)
            </label>
            <input
              id="bookingCreditValidityDays"
              name="bookingCreditValidityDays"
              type="number"
              min={1}
              max={366}
              defaultValue={category?.bookingCreditValidityDays ?? 30}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="bookingCreditLabel">
              Cómo se llaman
            </label>
            <input
              id="bookingCreditLabel"
              name="bookingCreditLabel"
              maxLength={40}
              defaultValue={category?.bookingCreditLabel ?? ""}
              className="fo-input"
              placeholder="turnos, cortes…"
            />
          </div>
        </div>
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
