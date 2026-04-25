"use client";

import { useActionState } from "react";
import {
  createTeacherAction,
  updateTeacherAction,
  type TeacherFormState,
} from "@/app/actions/teachers";

const initial: TeacherFormState = { error: null };

type TeacherInitial = {
  id: string;
  firstName: string;
  lastName: string;
  slug: string;
  profileImageUrl: string | null;
  shortBio: string | null;
  longBio: string | null;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  specialty: string | null;
  experienceYears: number | null;
  city: string | null;
  country: string | null;
  isPublished: boolean;
};

export function TeacherForm({ teacher }: { teacher?: TeacherInitial }) {
  const [state, action, pending] = useActionState(
    teacher ? updateTeacherAction : createTeacherAction,
    initial,
  );

  const fe = state.fieldErrors;

  return (
    <form action={action} className="fo-section-gap max-w-3xl">
      {teacher ? <input type="hidden" name="id" value={teacher.id} /> : null}

      <section className="fo-card space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Datos personales</h2>
          <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
            Nombre público y URL amigable (slug) para futuras fichas o enlaces.
          </p>
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
              defaultValue={teacher?.firstName}
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
              defaultValue={teacher?.lastName}
              className="fo-input"
              placeholder="Ej. López"
            />
            {fe?.lastName ? <p className="text-xs text-[var(--fo-danger)]">{fe.lastName}</p> : null}
          </div>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="slug">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            defaultValue={teacher?.slug}
            className="fo-input font-mono text-sm"
            placeholder="maria-lopez (se genera del nombre si lo dejás vacío)"
          />
          <p className="fo-helper">Solo minúsculas, números y guiones. Único en este workspace.</p>
          {fe?.slug ? <p className="text-xs text-[var(--fo-danger)]">{fe.slug}</p> : null}
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="profileImageUrl">
            Foto de perfil (URL)
          </label>
          <input
            id="profileImageUrl"
            name="profileImageUrl"
            type="url"
            defaultValue={teacher?.profileImageUrl ?? ""}
            className="fo-input"
            placeholder="https://…"
          />
          <p className="fo-helper">En una siguiente etapa podés conectar almacenamiento propio o CDN.</p>
        </div>
      </section>

      <section className="fo-card space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Biografía</h2>
          <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
            La biografía corta suele mostrarse en cards; la larga en la landing del curso.
          </p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="shortBio">
            Biografía corta
          </label>
          <textarea
            id="shortBio"
            name="shortBio"
            rows={3}
            defaultValue={teacher?.shortBio ?? ""}
            className="fo-input"
            placeholder="Una o dos frases sobre tu enfoque como docente."
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="longBio">
            Biografía larga
          </label>
          <textarea
            id="longBio"
            name="longBio"
            rows={8}
            defaultValue={teacher?.longBio ?? ""}
            className="fo-input"
            placeholder="Trayectoria, estilo de enseñanza, logros relevantes…"
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="specialty">
            Especialidad
          </label>
          <input
            id="specialty"
            name="specialty"
            defaultValue={teacher?.specialty ?? ""}
            className="fo-input"
            placeholder="Ej. Iluminación de retrato"
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="experienceYears">
              Años de experiencia
            </label>
            <input
              id="experienceYears"
              name="experienceYears"
              type="number"
              min={0}
              max={80}
              defaultValue={teacher?.experienceYears ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="city">
              Ciudad
            </label>
            <input id="city" name="city" defaultValue={teacher?.city ?? ""} className="fo-input" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="country">
              País
            </label>
            <input
              id="country"
              name="country"
              defaultValue={teacher?.country ?? ""}
              className="fo-input"
            />
          </div>
        </div>
      </section>

      <section className="fo-card space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Contacto y redes</h2>
          <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
            Opcional. Se pueden mostrar en la landing pública del curso.
          </p>
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
              defaultValue={teacher?.email ?? ""}
              className="fo-input"
            />
            {fe?.email ? <p className="text-xs text-[var(--fo-danger)]">{fe.email}</p> : null}
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="whatsapp">
              WhatsApp (enlace o número)
            </label>
            <input
              id="whatsapp"
              name="whatsapp"
              defaultValue={teacher?.whatsapp ?? ""}
              className="fo-input"
              placeholder="https://wa.me/…"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="instagram">
              Instagram
            </label>
            <input
              id="instagram"
              name="instagram"
              defaultValue={teacher?.instagram ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="website">
              Sitio web
            </label>
            <input
              id="website"
              name="website"
              defaultValue={teacher?.website ?? ""}
              className="fo-input"
            />
          </div>
        </div>
      </section>

      <section className="fo-card">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={teacher?.isPublished ?? false}
            className="mt-1 size-4 rounded border-[var(--fo-border)] text-[var(--fo-accent)] focus:ring-[var(--fo-accent)]"
          />
          <span>
            <span className="fo-label !inline">Visible en fichas públicas</span>
            <span className="fo-helper block mt-1">
              Si está desmarcado, el perfil sigue existiendo para asignar cursos pero podés ocultarlo en
              vistas públicas futuras.
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
          {pending ? "Guardando…" : teacher ? "Guardar cambios" : "Crear docente"}
        </button>
      </div>
    </form>
  );
}
