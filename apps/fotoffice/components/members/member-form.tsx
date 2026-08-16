"use client";

import { useActionState } from "react";
import {
  createMemberAction,
  updateMemberAction,
  type MemberFormState,
} from "@/app/actions/members";
import { MEMBER_STATUS_OPTIONS } from "@/lib/members/status-labels";

const initial: MemberFormState = { error: null };

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

function initials(firstName?: string, lastName?: string): string {
  const a = firstName?.trim()?.[0] ?? "";
  const b = lastName?.trim()?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

type MemberInitial = {
  id: string;
  memberNumber: string;
  categoryId: string | null;
  firstName: string;
  lastName: string;
  status: string;
  joinedAt: Date | string;
  leftAt: Date | string | null;
  documentType: string | null;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  birthDate: Date | string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  notes: string | null;
};

export function MemberForm({
  member,
  categories,
}: {
  member?: MemberInitial;
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(
    member ? updateMemberAction : createMemberAction,
    initial,
  );
  const fe = state.fieldErrors;

  return (
    <form action={action} className="fo-section-gap max-w-3xl">
      {member ? <input type="hidden" name="id" value={member.id} /> : null}

      <section className="fo-card space-y-6">
        <div className="flex items-start gap-4">
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-lg font-semibold text-[var(--fo-accent)]"
            aria-hidden
          >
            {initials(member?.firstName, member?.lastName)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--fo-text)]">Identidad</h2>
            <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
              La foto de perfil todavía no se puede subir desde acá — es la próxima mejora del
              módulo.
            </p>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="firstName">
              Nombre
            </label>
            <input
              id="firstName"
              name="firstName"
              required
              defaultValue={member?.firstName}
              className="fo-input"
              placeholder="Ej. María"
            />
            {fe?.firstName ? <p className="text-xs text-[var(--fo-danger)]">{fe.firstName}</p> : null}
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="lastName">
              Apellido
            </label>
            <input
              id="lastName"
              name="lastName"
              required
              defaultValue={member?.lastName}
              className="fo-input"
              placeholder="Ej. López"
            />
            {fe?.lastName ? <p className="text-xs text-[var(--fo-danger)]">{fe.lastName}</p> : null}
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="documentType">
              Tipo de documento
            </label>
            <input
              id="documentType"
              name="documentType"
              defaultValue={member?.documentType ?? ""}
              className="fo-input"
              placeholder="Ej. DNI"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="documentNumber">
              Número de documento
            </label>
            <input
              id="documentNumber"
              name="documentNumber"
              defaultValue={member?.documentNumber ?? ""}
              className="fo-input"
            />
            {fe?.documentNumber ? (
              <p className="text-xs text-[var(--fo-danger)]">{fe.documentNumber}</p>
            ) : null}
          </div>
        </div>
        <div className="fo-field-stack sm:max-w-xs">
          <label className="fo-label" htmlFor="birthDate">
            Fecha de nacimiento
          </label>
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={toDateInput(member?.birthDate)}
            className="fo-input"
          />
        </div>
      </section>

      <section className="fo-card space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Contacto</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={member?.email ?? ""}
              className="fo-input"
            />
            {fe?.email ? <p className="text-xs text-[var(--fo-danger)]">{fe.email}</p> : null}
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="phone">
              Teléfono
            </label>
            <input id="phone" name="phone" defaultValue={member?.phone ?? ""} className="fo-input" />
          </div>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="address">
            Dirección
          </label>
          <input
            id="address"
            name="address"
            defaultValue={member?.address ?? ""}
            className="fo-input"
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="city">
              Ciudad
            </label>
            <input id="city" name="city" defaultValue={member?.city ?? ""} className="fo-input" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="province">
              Provincia
            </label>
            <input
              id="province"
              name="province"
              defaultValue={member?.province ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="postalCode">
              Código postal
            </label>
            <input
              id="postalCode"
              name="postalCode"
              defaultValue={member?.postalCode ?? ""}
              className="fo-input"
            />
          </div>
        </div>
      </section>

      <section className="fo-card space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Información societaria</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="memberNumber">
              Número de socio
            </label>
            <input
              id="memberNumber"
              name="memberNumber"
              required
              defaultValue={member?.memberNumber}
              className="fo-input"
            />
            {fe?.memberNumber ? (
              <p className="text-xs text-[var(--fo-danger)]">{fe.memberNumber}</p>
            ) : null}
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="categoryId">
              Categoría
            </label>
            {categories.length === 0 ? (
              <p className="fo-helper">
                Todavía no hay categorías activas. Creá una antes de cargar socios.
              </p>
            ) : (
              <select
                id="categoryId"
                name="categoryId"
                required
                defaultValue={member?.categoryId ?? ""}
                className="fo-input"
              >
                <option value="" disabled>
                  Elegí una categoría
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {fe?.categoryId ? <p className="text-xs text-[var(--fo-danger)]">{fe.categoryId}</p> : null}
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="status">
              Estado
            </label>
            <select
              id="status"
              name="status"
              defaultValue={member?.status ?? "ACTIVE"}
              className="fo-input"
            >
              {MEMBER_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="joinedAt">
              Fecha de ingreso
            </label>
            <input
              id="joinedAt"
              name="joinedAt"
              type="date"
              required
              defaultValue={toDateInput(member?.joinedAt) || toDateInput(new Date())}
              className="fo-input"
            />
            {fe?.joinedAt ? <p className="text-xs text-[var(--fo-danger)]">{fe.joinedAt}</p> : null}
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="leftAt">
              Fecha de baja
            </label>
            <input
              id="leftAt"
              name="leftAt"
              type="date"
              defaultValue={toDateInput(member?.leftAt)}
              className="fo-input"
            />
            <p className="fo-helper">Solo si corresponde. Se completa sola al pasar a Inactivo.</p>
          </div>
        </div>
      </section>

      <section className="fo-card space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Observaciones</h2>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="notes">
            Notas internas
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={member?.notes ?? ""}
            className="fo-input"
            placeholder="Solo visible para administradores del workspace."
          />
        </div>
      </section>

      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
          {pending ? "Guardando…" : member ? "Guardar cambios" : "Crear socio"}
        </button>
      </div>
    </form>
  );
}
