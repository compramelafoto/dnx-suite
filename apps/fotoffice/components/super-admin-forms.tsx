"use client";

import { useActionState } from "react";
import {
  assignOwnerToWorkspaceAction,
  createOwnerUserAction,
  createWorkspaceAction,
  type SuperAdminActionState,
  updateUserGlobalRoleAction,
} from "@/app/actions/super-admin";

const initial: SuperAdminActionState = { error: null, ok: null };

function ActionFeedback({ state }: { state: SuperAdminActionState }) {
  if (state.error) return <p className="text-sm text-[var(--fo-danger)]">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-[var(--fo-success)]">{state.ok}</p>;
  return null;
}

export function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState(createWorkspaceAction, initial);
  return (
    <form action={action} className="fo-card space-y-4">
      <h2 className="text-base font-semibold text-[var(--fo-text)]">Crear workspace</h2>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="workspace-name">
          Nombre del workspace
        </label>
        <input id="workspace-name" name="name" className="fo-input" placeholder="DNX Academy" required />
      </div>
      <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
        {pending ? "Creando..." : "Crear workspace"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function CreateOwnerUserForm() {
  const [state, action, pending] = useActionState(createOwnerUserAction, initial);
  return (
    <form action={action} className="fo-card space-y-4">
      <h2 className="text-base font-semibold text-[var(--fo-text)]">Crear usuario owner</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="owner-name">
            Nombre
          </label>
          <input id="owner-name" name="name" className="fo-input" placeholder="Nombre y apellido" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="owner-email">
            Email
          </label>
          <input id="owner-email" name="email" type="email" className="fo-input" required />
        </div>
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="owner-password">
          Contraseña inicial
        </label>
        <input id="owner-password" name="password" type="password" className="fo-input" minLength={8} required />
      </div>
      <p className="fo-helper">
        Se crea con rol global <code className="text-xs">WORKSPACE_ADMIN</code> (sin permisos de panel global).
      </p>
      <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
        {pending ? "Creando..." : "Crear usuario owner"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function AssignOwnerForm({
  users,
  workspaces,
}: {
  users: { id: number; email: string; name: string | null }[];
  workspaces: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(assignOwnerToWorkspaceAction, initial);
  return (
    <form action={action} className="fo-card space-y-4">
      <h2 className="text-base font-semibold text-[var(--fo-text)]">Asignar owner a workspace</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="assign-user">
            Usuario
          </label>
          <select id="assign-user" name="userId" className="fo-input" required defaultValue="">
            <option value="" disabled>
              Seleccionar usuario
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ? `${u.name} · ${u.email}` : u.email}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="assign-workspace">
            Workspace
          </label>
          <select id="assign-workspace" name="workspaceId" className="fo-input" required defaultValue="">
            <option value="" disabled>
              Seleccionar workspace
            </option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="fo-helper">
        La asignación crea/actualiza membresía con rol <code className="text-xs">ADMIN</code> (owner del
        workspace).
      </p>
      <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
        {pending ? "Asignando..." : "Asignar owner"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function UpdateGlobalRoleForm({
  users,
}: {
  users: { id: number; email: string; role: string; name: string | null }[];
}) {
  const [state, action, pending] = useActionState(updateUserGlobalRoleAction, initial);
  return (
    <form action={action} className="fo-card space-y-4">
      <h2 className="text-base font-semibold text-[var(--fo-text)]">Cambiar rol global</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="role-user">
            Usuario
          </label>
          <select id="role-user" name="userId" className="fo-input" defaultValue="" required>
            <option value="" disabled>
              Seleccionar usuario
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ? `${u.name} · ${u.email}` : u.email} ({u.role})
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="role-next">
            Nuevo rol
          </label>
          <select id="role-next" name="role" className="fo-input" defaultValue="WORKSPACE_ADMIN" required>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="WORKSPACE_ADMIN">WORKSPACE_ADMIN</option>
            <option value="STAFF">STAFF</option>
          </select>
        </div>
      </div>
      <p className="fo-helper">Al cambiar el rol se invalidan sesiones activas del usuario.</p>
      <button type="submit" className="fo-btn fo-btn-secondary" disabled={pending}>
        {pending ? "Actualizando..." : "Actualizar rol global"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}
