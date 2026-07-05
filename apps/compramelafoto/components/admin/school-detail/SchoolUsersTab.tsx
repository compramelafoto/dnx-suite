"use client";

import type { Dispatch, SetStateAction } from "react";
import { Mail, UserCircle, UserPlus } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatDate } from "@/lib/admin/school-detail-format";
import type {
  CreateSchoolOrganizerFormState,
  SchoolOrganizerInvitationRow,
  SchoolOrganizerMember,
} from "@/components/admin/school-detail/types";

export type SchoolUsersTabProps = {
  organizersError: string | null;
  schoolOrganizers: SchoolOrganizerMember[];
  organizersLoading: boolean;
  isCreatingOrganizerUser: boolean;
  setIsCreatingOrganizerUser: Dispatch<SetStateAction<boolean>>;
  createOrganizerForm: CreateSchoolOrganizerFormState;
  setCreateOrganizerForm: Dispatch<SetStateAction<CreateSchoolOrganizerFormState>>;
  createOrganizerError: string | null;
  createOrganizerLoading: boolean;
  handleInviteSchoolOrganizerUser: () => void | Promise<void>;
  lastInvitationSent: { email: string; expiresAt: string } | null;
  organizerSearch: string;
  setOrganizerSearch: (v: string) => void;
  organizerCandidates: Array<{ id: number; name: string | null; email: string; role: string }>;
  organizerSearchLoading: boolean;
  selectedOrganizerUserId: string;
  setSelectedOrganizerUserId: (v: string) => void;
  organizerSaveLoading: boolean;
  handleAddSchoolOrganizer: () => void | Promise<void>;
  handleRemoveSchoolOrganizer: (id: string) => void | Promise<void>;
  removingOrganizerId: string | null;
  organizerInvitations: SchoolOrganizerInvitationRow[];
  handleResendInvitation: (id: string) => void | Promise<void>;
  resendingInvitationId: string | null;
  handleCancelInvitation: (id: string) => void | Promise<void>;
  cancellingInvitationId: string | null;
};

const selectClass =
  "min-h-[42px] w-full rounded-xl border border-[#111827]/10 bg-white px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent";

function roleBadge(role: string): string {
  const r = role.toUpperCase();
  if (r.includes("ORGANIZER")) return "bg-violet-50 text-violet-900 ring-1 ring-violet-200";
  if (r.includes("ADMIN")) return "bg-slate-100 text-slate-800 ring-1 ring-slate-200";
  return "bg-gray-50 text-gray-800 ring-1 ring-gray-200";
}

export function SchoolUsersTab(p: SchoolUsersTabProps) {
  return (
    <div className="space-y-8">
      {p.organizersError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{p.organizersError}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border border-[#ebe8e4] p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fdf8f3] text-[#c27b3d] ring-1 ring-[#e8dcc8]">
              <UserPlus className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="text-base font-semibold text-[#111827]">Invitar administrador</h3>
              <p className="text-sm leading-relaxed text-[#6b7280]">
                Enviá una invitación por email para que la persona cree su usuario y acceda como organizador escolar en
                esta institución.
              </p>
              <Button
                type="button"
                variant="primary"
                className="mt-2 w-full sm:w-auto"
                onClick={() => p.setIsCreatingOrganizerUser((prev) => !prev)}
              >
                {p.isCreatingOrganizerUser ? "Ocultar formulario" : "Invitar nuevo administrador"}
              </Button>
            </div>
          </div>
          {p.isCreatingOrganizerUser ? (
            <div className="mt-6 space-y-4 border-t border-[#f3f4f6] pt-6">
              {p.createOrganizerError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {p.createOrganizerError}
                </p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">Nombre</span>
                  <Input
                    value={p.createOrganizerForm.name}
                    onChange={(e) => p.setCreateOrganizerForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre del responsable"
                    className="min-h-[42px]"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">Email</span>
                  <Input
                    type="email"
                    value={p.createOrganizerForm.email}
                    onChange={(e) => p.setCreateOrganizerForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="escuela@dominio.com"
                    className="min-h-[42px]"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void p.handleInviteSchoolOrganizerUser()}
                  disabled={
                    p.createOrganizerLoading ||
                    !p.createOrganizerForm.name.trim() ||
                    !p.createOrganizerForm.email.trim()
                  }
                >
                  {p.createOrganizerLoading ? "Enviando…" : "Enviar invitación"}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="rounded-2xl border border-[#ebe8e4] p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f0f9ff] text-sky-700 ring-1 ring-sky-200">
              <UserCircle className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h3 className="text-base font-semibold text-[#111827]">Asignar usuario existente</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#6b7280]">
                  Buscá un usuario que ya tenga cuenta y enlazalo como organizador de esta escuela.
                </p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">Búsqueda</span>
                <Input
                  placeholder="Nombre o email…"
                  value={p.organizerSearch}
                  onChange={(e) => p.setOrganizerSearch(e.target.value)}
                  className="min-h-[42px]"
                />
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  className={`${selectClass} sm:flex-1`}
                  value={p.selectedOrganizerUserId}
                  onChange={(e) => p.setSelectedOrganizerUserId(e.target.value)}
                >
                  <option value="">
                    {p.organizerSearchLoading
                      ? "Buscando…"
                      : p.organizerCandidates.length
                        ? "Seleccionar usuario"
                        : "Sin resultados"}
                  </option>
                  {p.organizerCandidates.map((candidate) => (
                    <option key={candidate.id} value={String(candidate.id)}>
                      {(candidate.name || candidate.email) + ` · ${candidate.email}`}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="primary"
                  className="w-full min-h-[42px] shrink-0 sm:w-auto"
                  onClick={() => void p.handleAddSchoolOrganizer()}
                  disabled={!p.selectedOrganizerUserId || p.organizerSaveLoading}
                >
                  {p.organizerSaveLoading ? "Asignando…" : "Asignar"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {p.lastInvitationSent ? (
        <Card className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-5 w-5 text-emerald-800" aria-hidden />
            <div className="text-sm text-emerald-950">
              <p className="font-semibold">Última invitación enviada</p>
              <p className="mt-1">
                <span className="text-emerald-800/90">Email:</span>{" "}
                <span className="font-medium">{p.lastInvitationSent.email}</span>
              </p>
              <p className="mt-0.5">
                <span className="text-emerald-800/90">Vence:</span>{" "}
                <span className="font-medium">{formatDate(p.lastInvitationSent.expiresAt)}</span>
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden rounded-2xl border border-[#ebe8e4] shadow-sm">
        <div className="border-b border-[#f3f4f6] bg-[#fafafa] px-5 py-4">
          <h3 className="text-base font-semibold text-[#111827]">Usuarios activos</h3>
          <p className="mt-1 text-sm text-[#6b7280]">Organizadores con acceso actual a esta escuela.</p>
        </div>
        <div className="overflow-x-auto p-4 sm:p-6">
          <table className="min-w-[800px] w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                <th className="border-b border-[#f3f4f6] px-4 pb-3">Usuario</th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3">Email</th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3">Estado</th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3">Rol</th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3">Alta</th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {p.organizersLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-[#6b7280]">
                    Cargando usuarios…
                  </td>
                </tr>
              ) : p.schoolOrganizers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-[#6b7280]">
                    No hay organizadores asignados.
                  </td>
                </tr>
              ) : (
                p.schoolOrganizers.map((member) => (
                  <tr key={member.id} className="align-middle">
                    <td className="border-b border-[#f9fafb] px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3f4f6] text-[#9ca3af]">
                          <UserCircle className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="font-medium text-[#111827]">{member.user.name || "Sin nombre"}</span>
                      </div>
                    </td>
                    <td className="border-b border-[#f9fafb] px-4 py-4 text-[#374151]">{member.user.email}</td>
                    <td className="border-b border-[#f9fafb] px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          member.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
                            : "bg-gray-100 text-gray-700 ring-1 ring-gray-200"
                        }`}
                      >
                        {member.status === "ACTIVE" ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="border-b border-[#f9fafb] px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadge(member.user.role)}`}
                      >
                        {member.user.role}
                      </span>
                    </td>
                    <td className="border-b border-[#f9fafb] px-4 py-4 text-[#374151]">
                      {formatDate(member.createdAt)}
                    </td>
                    <td className="border-b border-[#f9fafb] px-4 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void p.handleRemoveSchoolOrganizer(member.id)}
                        disabled={p.removingOrganizerId === member.id}
                      >
                        {p.removingOrganizerId === member.id ? "…" : "Quitar"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-[#ebe8e4] shadow-sm">
        <div className="border-b border-[#f3f4f6] bg-[#fafafa] px-5 py-4">
          <h3 className="text-base font-semibold text-[#111827]">Invitaciones pendientes</h3>
          <p className="mt-1 text-sm text-[#6b7280]">Reenvío o cancelación de invitaciones en curso.</p>
        </div>
        <div className="overflow-x-auto p-4 sm:p-6">
          <table className="min-w-[720px] w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                <th className="border-b border-[#f3f4f6] px-4 pb-3">Invitación</th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3">Estado</th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3">Vencimiento</th>
                <th className="border-b border-[#f3f4f6] px-4 pb-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {p.organizerInvitations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-[#6b7280]">
                    No hay invitaciones registradas.
                  </td>
                </tr>
              ) : (
                p.organizerInvitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td className="border-b border-[#f9fafb] px-4 py-4">
                      <div className="font-medium text-[#111827]">{invitation.name || invitation.email}</div>
                      <div className="text-xs text-[#6b7280]">{invitation.email}</div>
                    </td>
                    <td className="border-b border-[#f9fafb] px-4 py-4">
                      <span className="inline-flex rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200">
                        {invitation.status}
                      </span>
                    </td>
                    <td className="border-b border-[#f9fafb] px-4 py-4 text-[#374151]">
                      {formatDate(invitation.expiresAt)}
                    </td>
                    <td className="border-b border-[#f9fafb] px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void p.handleResendInvitation(invitation.id)}
                          disabled={
                            (invitation.status !== "PENDING" && invitation.status !== "EXPIRED") ||
                            p.resendingInvitationId === invitation.id
                          }
                        >
                          {p.resendingInvitationId === invitation.id ? "…" : "Reenviar"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void p.handleCancelInvitation(invitation.id)}
                          disabled={
                            invitation.status !== "PENDING" || p.cancellingInvitationId === invitation.id
                          }
                        >
                          {p.cancellingInvitationId === invitation.id ? "…" : "Cancelar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
