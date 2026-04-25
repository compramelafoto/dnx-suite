"use client";

import { useActionState } from "react";
import { createPublicCourseEnrollmentAction } from "@/app/actions/public-course-enrollment";

type InstanceOption = {
  id: string;
  label: string;
  priceArs: string;
  availableSpots: number;
  soldOut: boolean;
  disabled: boolean;
};

const initial = { error: null };

export function PublicCourseEnrollmentForm({
  workspaceSlug,
  courseSlug,
  instanceOptions,
  defaultInstanceId,
}: {
  workspaceSlug: string;
  courseSlug: string;
  instanceOptions: InstanceOption[];
  defaultInstanceId?: string;
}) {
  const action = createPublicCourseEnrollmentAction.bind(null, workspaceSlug, courseSlug);
  const [state, formAction, pending] = useActionState(action, initial);
  const singleInstance = instanceOptions.length === 1 ? instanceOptions[0] : null;

  return (
    <form action={formAction} className="space-y-4">
      {singleInstance ? (
        <input type="hidden" name="courseInstanceId" value={defaultInstanceId ?? singleInstance.id} />
      ) : (
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="instance">
            Edición presencial
          </label>
          <select id="instance" name="courseInstanceId" className="fo-input" required defaultValue={defaultInstanceId ?? ""}>
            <option value="">Seleccioná una edición</option>
            {instanceOptions.map((instance) => (
              <option key={instance.id} value={instance.id} disabled={instance.disabled}>
                {instance.label} · ${instance.priceArs} · {instance.soldOut ? "Sin cupos disponibles" : `${instance.availableSpots} cupos`}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="fo-field-stack md:col-span-2">
          <label className="fo-label" htmlFor="enroll-name">
            Nombre y apellido
          </label>
          <input id="enroll-name" name="name" required className="fo-input" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="enroll-email">
            Gmail/email
          </label>
          <input id="enroll-email" name="email" type="email" required className="fo-input" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="enroll-whatsapp">
            WhatsApp
          </label>
          <input id="enroll-whatsapp" name="whatsapp" required className="fo-input" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="enroll-dni">
            DNI
          </label>
          <input id="enroll-dni" name="dni" required className="fo-input" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="enroll-city">
            Ciudad
          </label>
          <input id="enroll-city" name="city" className="fo-input" />
        </div>
        <div className="fo-field-stack md:col-span-2">
          <label className="fo-label" htmlFor="enroll-instagram">
            Instagram
          </label>
          <input id="enroll-instagram" name="instagram" className="fo-input" />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="fo-btn fo-btn-primary w-full" disabled={pending}>
        {pending ? "Enviando inscripción..." : "Inscribirme"}
      </button>
    </form>
  );
}
