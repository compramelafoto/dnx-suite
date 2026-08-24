"use client";

import { useActionState, useState } from "react";
import { PlatformFeeBreakdown } from "@/components/platform-fee/fee-breakdown";
import {
  createCourseInstanceAction,
  type PresentialCourseActionState,
} from "@/app/actions/presential-courses";

const initialState: PresentialCourseActionState = { error: null };

export function CourseInstanceForm({
  courseId,
  platformFeeBps,
}: {
  courseId: string;
  /** Comisión vigente del módulo de cursos, para el desglose en vivo. */
  platformFeeBps: number;
}) {
  const [state, action, pending] = useActionState(createCourseInstanceAction, initialState);
  const [priceArs, setPriceArs] = useState("");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="fo-field-stack md:col-span-2">
          <label className="fo-label" htmlFor="instance-title">
            Título (opcional)
          </label>
          <input id="instance-title" name="title" className="fo-input" placeholder="Ej: Comisión mayo 2026" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="startDateTime">
            Fecha y hora de inicio
          </label>
          <input id="startDateTime" type="datetime-local" name="startDateTime" className="fo-input" required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="endDateTime">
            Fecha y hora de fin
          </label>
          <input id="endDateTime" type="datetime-local" name="endDateTime" className="fo-input" required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="locationName">
            Lugar
          </label>
          <input id="locationName" name="locationName" className="fo-input" required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="locationAddress">
            Dirección
          </label>
          <input id="locationAddress" name="locationAddress" className="fo-input" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="priceArs">
            Precio ARS
          </label>
          <input
            id="priceArs"
            name="priceArs"
            type="number"
            min={0}
            step="0.01"
            className="fo-input"
            required
            value={priceArs}
            onChange={(e) => setPriceArs(e.target.value)}
          />
          <PlatformFeeBreakdown amountArs={priceArs} feeBps={platformFeeBps} />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="capacity">
            Cupo
          </label>
          <input id="capacity" name="capacity" type="number" min={1} step={1} className="fo-input" required />
        </div>
        <div className="fo-field-stack md:col-span-2">
          <label className="fo-label" htmlFor="instance-status">
            Estado
          </label>
          <select id="instance-status" name="status" defaultValue="ACTIVE" className="fo-input">
            <option value="ACTIVE">Activa</option>
            <option value="FULL">Completa</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-[var(--fo-success)]" role="status">
          Edición creada.
        </p>
      ) : null}
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pending}>
        {pending ? "Creando..." : "Crear edición"}
      </button>
    </form>
  );
}
