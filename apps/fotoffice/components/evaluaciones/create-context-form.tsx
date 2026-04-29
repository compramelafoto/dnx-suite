"use client";

import { useActionState } from "react";
import {
  createEvaluationContextAction,
  type EvaluationContextFormState,
} from "@/app/actions/evaluaciones";

const initialState: EvaluationContextFormState = { error: null };

export function CreateEvaluationContextForm() {
  const [state, action, pending] = useActionState(createEvaluationContextAction, initialState);

  return (
    <form action={action} className="fo-card space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--fo-text)]">Crear contexto manual</h2>
        <p className="text-sm text-[var(--fo-muted)]">Creá un curso o grupo base para comenzar a evaluar.</p>
      </header>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="name">
          Nombre del curso/grupo
        </label>
        <input
          id="name"
          name="name"
          required
          className="fo-input"
          placeholder="Ej: 1A Turno noche"
          maxLength={200}
        />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="description">
          Descripción (opcional)
        </label>
        <textarea
          id="description"
          name="description"
          className="fo-input"
          placeholder="Notas internas para identificar este contexto"
          maxLength={2000}
        />
      </div>

      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-[var(--fo-success)]" role="status">
          Contexto creado.
        </p>
      ) : null}

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
          {pending ? "Creando..." : "Crear contexto"}
        </button>
      </div>
    </form>
  );
}
