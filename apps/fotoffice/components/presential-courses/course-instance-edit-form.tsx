"use client";

import { useActionState } from "react";
import {
  updateCourseInstanceAction,
  type PresentialCourseActionState,
} from "@/app/actions/presential-courses";

const initialState: PresentialCourseActionState = { error: null };

type CourseInstanceEditFormProps = {
  courseId: string;
  instance: {
    id: string;
    title: string | null;
    startDateTime: Date;
    endDateTime: Date;
    locationName: string;
    locationAddress: string | null;
    priceArs: string;
    capacity: number;
    status: "ACTIVE" | "FULL" | "CANCELLED";
  };
};

function toDateTimeLocal(value: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hours = pad(value.getHours());
  const minutes = pad(value.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function CourseInstanceEditForm({ courseId, instance }: CourseInstanceEditFormProps) {
  const [state, action, pending] = useActionState(updateCourseInstanceAction, initialState);

  return (
    <form action={action} className="space-y-3 border-t border-[var(--fo-border)] pt-4">
      <input type="hidden" name="instanceId" value={instance.id} />
      <input type="hidden" name="courseId" value={courseId} />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="fo-field-stack md:col-span-2">
          <label className="fo-label" htmlFor={`edit-instance-title-${instance.id}`}>
            Título (opcional)
          </label>
          <input
            id={`edit-instance-title-${instance.id}`}
            name="title"
            className="fo-input"
            defaultValue={instance.title ?? ""}
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`edit-instance-start-${instance.id}`}>
            Fecha y hora de inicio
          </label>
          <input
            id={`edit-instance-start-${instance.id}`}
            type="datetime-local"
            name="startDateTime"
            className="fo-input"
            defaultValue={toDateTimeLocal(instance.startDateTime)}
            required
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`edit-instance-end-${instance.id}`}>
            Fecha y hora de fin
          </label>
          <input
            id={`edit-instance-end-${instance.id}`}
            type="datetime-local"
            name="endDateTime"
            className="fo-input"
            defaultValue={toDateTimeLocal(instance.endDateTime)}
            required
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`edit-instance-location-${instance.id}`}>
            Nombre / lugar
          </label>
          <input
            id={`edit-instance-location-${instance.id}`}
            name="locationName"
            className="fo-input"
            defaultValue={instance.locationName}
            required
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`edit-instance-address-${instance.id}`}>
            Dirección
          </label>
          <input
            id={`edit-instance-address-${instance.id}`}
            name="locationAddress"
            className="fo-input"
            defaultValue={instance.locationAddress ?? ""}
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`edit-instance-price-${instance.id}`}>
            Precio ARS
          </label>
          <input
            id={`edit-instance-price-${instance.id}`}
            name="priceArs"
            type="number"
            min={0}
            step="0.01"
            className="fo-input"
            defaultValue={instance.priceArs}
            required
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`edit-instance-capacity-${instance.id}`}>
            Cupo
          </label>
          <input
            id={`edit-instance-capacity-${instance.id}`}
            name="capacity"
            type="number"
            min={1}
            step={1}
            className="fo-input"
            defaultValue={instance.capacity}
            required
          />
        </div>
        <div className="fo-field-stack md:col-span-2">
          <label className="fo-label" htmlFor={`edit-instance-status-${instance.id}`}>
            Estado
          </label>
          <select
            id={`edit-instance-status-${instance.id}`}
            name="status"
            className="fo-input"
            defaultValue={instance.status}
          >
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
          Edición actualizada.
        </p>
      ) : null}

      <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={pending}>
        {pending ? "Guardando..." : "Guardar edición"}
      </button>
    </form>
  );
}
