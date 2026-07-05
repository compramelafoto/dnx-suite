"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import {
  Building2,
  Camera,
  CreditCard,
  Fingerprint,
  GraduationCap,
  Hash,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  UserCog,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { formatDate } from "@/lib/admin/school-detail-format";
import {
  formatStudentIdentificationModeLabel,
} from "@/lib/school-roster/student-identification-mode-ui";
import type {
  AlbumRow,
  DetailResponse,
  DiagnosticAlert,
  PhotographerOption,
  SchoolFormState,
} from "@/components/admin/school-detail/types";
import type { StudentIdentificationModeValue } from "@/lib/school-roster/student-identification-mode-ui";
import {
  getAlbumIdFromIdentModeDiagnostic,
  getAlbumIdFromNoActivePacksDiagnostic,
  getOrderIdFromDiagnostic,
  getPackIdFromDiagnostic,
} from "@/lib/admin/school-detail-diagnostics";

export type SchoolInstitutionTabDiagnosticsProps = {
  diagnosticsSeverityFilter: "all" | "warning" | "error";
  setDiagnosticsSeverityFilter: Dispatch<SetStateAction<"all" | "warning" | "error">>;
  diagnosticsFilteredAndGrouped: {
    configuracion: DiagnosticAlert[];
    packs: DiagnosticAlert[];
    pedidos: DiagnosticAlert[];
  };
  handleConfigureStudentIdentificationNow: (code: string) => void;
  handleOpenPackFromDiagnostic: (
    packId: number,
    focusField?: "name" | "availabilityPhase" | "validUntil"
  ) => void;
  handleOpenAlbumFromDiagnostic: (albumId: number) => void;
  handleCreatePackFromDiagnostic: (albumId: number) => void;
  openOrderDetail: (orderId: number) => void;
};

export type SchoolInstitutionTabProps = {
  detail: DetailResponse;
  schoolOrganizerActiveCount: number;
  /** School datos */
  isEditingSchool: boolean;
  schoolForm: SchoolFormState | null;
  schoolSaveError: string | null;
  schoolSaveLoading: boolean;
  setSchoolSaveError: (v: string | null) => void;
  setIsEditingSchool: (v: boolean) => void;
  setSchoolForm: Dispatch<SetStateAction<SchoolFormState | null>>;
  handleSaveSchool: () => void | Promise<void>;
  buildSchoolFormState: (school: DetailResponse["school"]) => SchoolFormState;
  /** Owner */
  isEditingSchoolOwner: boolean;
  startEditingSchoolOwner: () => void;
  cancelEditingSchoolOwner: () => void;
  ownerSearchQuery: string;
  setOwnerSearchQuery: (v: string) => void;
  ownerSearchResults: PhotographerOption[];
  ownerSearchLoading: boolean;
  ownerSearchError: string | null;
  selectedOwnerUser: PhotographerOption | null;
  setSelectedOwnerUser: (v: PhotographerOption | null) => void;
  ownerSaveLoading: boolean;
  ownerSaveError: string | null;
  handleSaveSchoolOwner: () => void | Promise<void>;
  hasAlbumsOwnedByDifferentPhotographer: boolean;
  isSchoolOwnerChanged: boolean;
  diagnostics: SchoolInstitutionTabDiagnosticsProps;
};

export function SchoolInstitutionTab({
  detail,
  schoolOrganizerActiveCount,
  isEditingSchool,
  schoolForm,
  schoolSaveError,
  schoolSaveLoading,
  setSchoolSaveError,
  setIsEditingSchool,
  setSchoolForm,
  handleSaveSchool,
  buildSchoolFormState,
  isEditingSchoolOwner,
  startEditingSchoolOwner,
  cancelEditingSchoolOwner,
  ownerSearchQuery,
  setOwnerSearchQuery,
  ownerSearchResults,
  ownerSearchLoading,
  ownerSearchError,
  selectedOwnerUser,
  setSelectedOwnerUser,
  ownerSaveLoading,
  ownerSaveError,
  handleSaveSchoolOwner,
  hasAlbumsOwnedByDifferentPhotographer,
  isSchoolOwnerChanged,
  diagnostics: d,
}: SchoolInstitutionTabProps) {
  const primarySlug = detail.albums[0]?.publicSlug ?? null;

  function identSummaryRows(albums: AlbumRow[]) {
    return albums.map((a) => ({
      id: a.id,
      title: a.title,
      mode: a.studentIdentificationMode,
      fallback: a.allowManualStudentFallback,
      commission: a.organizerCommissionEnabled,
    }));
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border border-[#ebe8e4] p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdf8f3] text-[#c27b3d] ring-1 ring-[#e8dcc8]">
              <Camera className="h-5 w-5 shrink-0" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Álbumes</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">{detail.summary.albumsCount}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-[#ebe8e4] p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eff6ff] text-sky-700 ring-1 ring-sky-100">
              <GraduationCap className="h-5 w-5 shrink-0" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Alumnos</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">{detail.summary.studentsCount}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-[#ebe8e4] p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
              <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Pedidos</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">{detail.summary.ordersCount}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-[#ebe8e4] p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-800 ring-1 ring-violet-100">
              <ImageIcon className="h-5 w-5 shrink-0" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Packs activos</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">{detail.summary.activePacksCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl border border-[#ebe8e4] p-6 shadow-sm xl:col-span-2">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f9fafb] text-[#374151] ring-1 ring-[#e5e7eb]">
                <Building2 className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">Institución</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#6b7280]">
                  Datos generales del colegio y métricas de alcance para soporte ADMIN.
                </p>
              </div>
            </div>
            {!isEditingSchool ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSchoolSaveError(null);
                  setSchoolForm(buildSchoolFormState(detail.school));
                  setIsEditingSchool(true);
                }}
              >
                Editar datos
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingSchool(false);
                    setSchoolSaveError(null);
                    setSchoolForm(buildSchoolFormState(detail.school));
                  }}
                >
                  Cancelar
                </Button>
                <Button variant="primary" onClick={() => void handleSaveSchool()} disabled={schoolSaveLoading}>
                  {schoolSaveLoading ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            )}
          </div>

          {!isEditingSchool ? (
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                  <Hash className="h-3.5 w-3.5" aria-hidden />
                  Id interno
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#111827]">{detail.school.id}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">Nombre</dt>
                <dd className="mt-1 text-sm font-semibold text-[#111827]">{detail.school.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">Slug público (referencia)</dt>
                <dd className="mt-1 text-sm text-[#374151]">{primarySlug || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">Estado</dt>
                <dd className="mt-2">
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
                    Activa · panel admin
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">Alta</dt>
                <dd className="mt-1 text-sm text-[#374151]">{formatDate(detail.school.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">Organizadores (activos)</dt>
                <dd className="mt-1 text-sm font-medium tabular-nums text-[#111827]">{schoolOrganizerActiveCount}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">Fotógrafo principal</dt>
                <dd className="mt-1 text-sm text-[#374151]">
                  {detail.school.owner.name || "Sin nombre"} · {detail.school.owner.email}
                </dd>
              </div>
            </dl>
          ) : schoolForm ? (
            <div className="space-y-4">
              {schoolSaveError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{schoolSaveError}</p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-[#6b7280]">Nombre *</span>
                  <Input
                    className="min-h-[42px]"
                    value={schoolForm.name}
                    onChange={(e) => setSchoolForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-[#6b7280]">Logo URL</span>
                  <Input
                    className="min-h-[42px]"
                    value={schoolForm.logoUrl}
                    onChange={(e) => setSchoolForm((prev) => (prev ? { ...prev, logoUrl: e.target.value } : prev))}
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-[#6b7280]">Email contacto</span>
                  <Input
                    type="email"
                    className="min-h-[42px]"
                    value={schoolForm.contactEmail}
                    onChange={(e) =>
                      setSchoolForm((prev) => (prev ? { ...prev, contactEmail: e.target.value } : prev))
                    }
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-[#6b7280]">Teléfono</span>
                  <Input
                    className="min-h-[42px]"
                    value={schoolForm.contactPhone}
                    onChange={(e) =>
                      setSchoolForm((prev) => (prev ? { ...prev, contactPhone: e.target.value } : prev))
                    }
                  />
                </label>
              </div>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-[#6b7280]">Dirección</span>
                <Input
                  className="min-h-[42px]"
                  value={schoolForm.address}
                  onChange={(e) => setSchoolForm((prev) => (prev ? { ...prev, address: e.target.value } : prev))}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-[#6b7280]">Ciudad</span>
                  <Input
                    className="min-h-[42px]"
                    value={schoolForm.city}
                    onChange={(e) => setSchoolForm((prev) => (prev ? { ...prev, city: e.target.value } : prev))}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-[#6b7280]">Provincia</span>
                  <Input
                    className="min-h-[42px]"
                    value={schoolForm.province}
                    onChange={(e) => setSchoolForm((prev) => (prev ? { ...prev, province: e.target.value } : prev))}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-[#6b7280]">País</span>
                  <Input
                    className="min-h-[42px]"
                    value={schoolForm.country}
                    onChange={(e) => setSchoolForm((prev) => (prev ? { ...prev, country: e.target.value } : prev))}
                  />
                </label>
              </div>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-[#6b7280]">Observaciones internas</span>
                <Textarea
                  value={schoolForm.notes}
                  onChange={(e) => setSchoolForm((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                  rows={3}
                  className="text-sm"
                />
              </label>
            </div>
          ) : null}
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl border border-[#ebe8e4] p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-[#374151]">
              <Fingerprint className="h-5 w-5 text-[#c27b3d]" aria-hidden />
              <h3 className="text-sm font-semibold text-[#111827]">Identificación de alumnos</h3>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-[#6b7280]">
              La configuración es <strong className="text-[#374151]">por álbum</strong>. Editá cada álbum en la pestaña
              Álbumes.
            </p>
            {detail.albums.length === 0 ? (
              <p className="text-sm text-[#6b7280]">Sin álbumes asociados.</p>
            ) : (
              <ul className="space-y-3">
                {identSummaryRows(detail.albums).map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-[#f3f4f6] bg-[#fafafa] px-3 py-2.5 text-sm text-[#374151]"
                  >
                    <p className="font-medium text-[#111827]">{row.title}</p>
                    <p className="mt-1 text-xs text-[#6b7280]">
                      Modo:{" "}
                      {row.mode
                        ? formatStudentIdentificationModeLabel(row.mode as StudentIdentificationModeValue)
                        : "Sin definir"}{" "}
                      · Carga manual: {row.fallback ? "Sí" : "No"}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6b7280]">
                      Preventa/org.: {row.commission ? "Comisión habilitada" : "Sin comisión escuela"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="rounded-2xl border border-[#ebe8e4] p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[#374151]">
              <Mail className="h-5 w-5 text-[#c27b3d]" aria-hidden />
              <h3 className="text-sm font-semibold text-[#111827]">Contacto (vista rápida)</h3>
            </div>
            {!isEditingSchool ? (
              <ul className="space-y-3 text-sm text-[#374151]">
                <li className="flex gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#9ca3af]" aria-hidden />
                  <span>{detail.school.contactEmail || "—"}</span>
                </li>
                <li className="flex gap-2">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#9ca3af]" aria-hidden />
                  <span>{detail.school.contactPhone || "—"}</span>
                </li>
                <li className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#9ca3af]" aria-hidden />
                  <span>
                    {[detail.school.address, detail.school.city, detail.school.province, detail.school.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                </li>
              </ul>
            ) : (
              <p className="text-xs text-[#6b7280]">Editá estos campos en el formulario principal de institución.</p>
            )}
          </Card>
        </div>
      </div>

      <Card className="rounded-2xl border border-[#ebe8e4] p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fdf8f3] text-[#c27b3d] ring-1 ring-[#e8dcc8]">
              <UserCog className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-[#111827]">Fotógrafo responsable</h3>
              <p className="mt-1 text-sm text-[#6b7280]">Dueño operativo default de nuevos vínculos con la escuela.</p>
            </div>
          </div>
          {!isEditingSchoolOwner ? (
            <Button variant="secondary" size="sm" onClick={startEditingSchoolOwner}>
              Cambiar fotógrafo
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={cancelEditingSchoolOwner}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleSaveSchoolOwner()}
                disabled={ownerSaveLoading || !selectedOwnerUser || !isSchoolOwnerChanged}
              >
                {ownerSaveLoading ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          )}
        </div>

        {!isEditingSchoolOwner ? (
          <dl className="grid gap-3 text-sm text-[#374151] sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-[#6b7280]">Nombre</dt>
              <dd className="mt-1 font-medium text-[#111827]">{detail.school.owner.name || "Sin nombre"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[#6b7280]">Email</dt>
              <dd className="mt-1">{detail.school.owner.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[#6b7280]">Rol</dt>
              <dd className="mt-1">{detail.school.owner.role}</dd>
            </div>
          </dl>
        ) : (
          <div className="space-y-4">
            {ownerSaveError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{ownerSaveError}</p>
            ) : null}
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-[#6b7280]">Buscar fotógrafo</span>
              <Input
                className="min-h-[42px]"
                placeholder="Nombre o email"
                value={ownerSearchQuery}
                onChange={(e) => setOwnerSearchQuery(e.target.value)}
              />
            </label>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-[#e5e7eb]">
              {ownerSearchLoading ? (
                <p className="px-3 py-3 text-sm text-[#6b7280]">Buscando…</p>
              ) : ownerSearchResults.length === 0 ? (
                <p className="px-3 py-3 text-sm text-[#6b7280]">Sin resultados.</p>
              ) : (
                <ul className="divide-y divide-[#f3f4f6]">
                  {ownerSearchResults.map((c) => {
                    const sel = selectedOwnerUser?.id === c.id;
                    return (
                      <li key={c.id} className="px-2 py-1">
                        <button
                          type="button"
                          className={`w-full rounded-lg px-2 py-2 text-left text-sm transition ${
                            sel ? "bg-[#f7efe6] text-[#8a5a2b]" : "text-[#111827] hover:bg-[#fafafa]"
                          }`}
                          onClick={() => setSelectedOwnerUser(c)}
                        >
                          <span className="font-medium">{c.name || "Sin nombre"}</span>
                          <span className="block text-xs text-[#6b7280]">{c.email}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {ownerSearchError ? <p className="text-sm text-red-700">{ownerSearchError}</p> : null}
            <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
              Cambiar el responsable no transfiere automáticamente álbumes ni histórico.
            </p>
            {hasAlbumsOwnedByDifferentPhotographer ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
                Hay álbumes con otro fotógrafo como dueño · el alta de esta escuela no modifica ese ownership.
              </p>
            ) : null}
          </div>
        )}
      </Card>

      <Card className="rounded-2xl border border-[#ebe8e4] shadow-sm overflow-hidden">
        <div className="border-b border-[#f3f4f6] bg-[#fafafa] px-5 py-4">
          <h3 className="text-base font-semibold text-[#111827]">Diagnóstico operativo</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#6b7280]">
            Alertas automáticas de configuración, packs y pedidos. Podés navegar desde aquí al área correspondiente en
            otras pestañas.
          </p>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Severidad</span>
            <Button
              size="sm"
              variant={d.diagnosticsSeverityFilter === "all" ? "primary" : "secondary"}
              onClick={() => d.setDiagnosticsSeverityFilter("all")}
            >
              Todas
            </Button>
            <Button
              size="sm"
              variant={d.diagnosticsSeverityFilter === "warning" ? "primary" : "secondary"}
              onClick={() => d.setDiagnosticsSeverityFilter("warning")}
            >
              Warnings
            </Button>
            <Button
              size="sm"
              variant={d.diagnosticsSeverityFilter === "error" ? "primary" : "secondary"}
              onClick={() => d.setDiagnosticsSeverityFilter("error")}
            >
              Errores
            </Button>
          </div>

          {d.diagnosticsFilteredAndGrouped.configuracion.length === 0 &&
          d.diagnosticsFilteredAndGrouped.packs.length === 0 &&
          d.diagnosticsFilteredAndGrouped.pedidos.length === 0 ? (
            <Card className="rounded-xl border border-emerald-100 bg-emerald-50/35 p-4">
              <p className="text-sm text-emerald-900">No se detectaron inconsistencias para los filtros actuales.</p>
            </Card>
          ) : (
            <>
              {(
                [
                  ["configuracion", "Configuración"],
                  ["packs", "Packs"],
                  ["pedidos", "Pedidos"],
                ] as const
              ).map(([key, title]) => {
                const alerts = d.diagnosticsFilteredAndGrouped[key];
                if (!alerts.length) return null;
                return (
                  <Card key={key} className="rounded-xl border border-[#f3f4f6] p-5">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{title}</h4>
                    <div className="mt-4 space-y-4">
                      {alerts.map((alert) => {
                        const severityClass =
                          alert.severity === "error"
                            ? "border-red-200 bg-red-50 text-red-900"
                            : "border-amber-200 bg-amber-50 text-amber-950";
                        const albumIdIdent = getAlbumIdFromIdentModeDiagnostic(alert.code);
                        const albumIdNoPacks = getAlbumIdFromNoActivePacksDiagnostic(alert.code);
                        const packId = getPackIdFromDiagnostic(alert.code);
                        const orderId = getOrderIdFromDiagnostic(alert.code);
                        return (
                          <div key={alert.code} className={`rounded-xl border px-4 py-3 ${severityClass}`}>
                            <p className="text-sm leading-relaxed">{alert.message}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {albumIdIdent ? (
                                <Button size="sm" variant="secondary" onClick={() => d.handleConfigureStudentIdentificationNow(alert.code)}>
                                  Configurar identificación
                                </Button>
                              ) : null}
                              {packId && alert.code.startsWith("pack_active_without_products_") ? (
                                <Button size="sm" variant="secondary" onClick={() => d.handleOpenPackFromDiagnostic(packId, "name")}>
                                  Editar pack
                                </Button>
                              ) : null}
                              {packId && alert.code.startsWith("pack_without_phase_") ? (
                                <Button size="sm" variant="secondary" onClick={() => d.handleOpenPackFromDiagnostic(packId, "availabilityPhase")}>
                                  Configurar fase
                                </Button>
                              ) : null}
                              {packId && alert.code.startsWith("pack_active_out_of_validity_") ? (
                                <Button size="sm" variant="secondary" onClick={() => d.handleOpenPackFromDiagnostic(packId, "validUntil")}>
                                  Vigencia
                                </Button>
                              ) : null}
                              {albumIdNoPacks ? (
                                <>
                                  <Button size="sm" variant="secondary" onClick={() => d.handleOpenAlbumFromDiagnostic(albumIdNoPacks)}>
                                    Ir a álbum
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => d.handleCreatePackFromDiagnostic(albumIdNoPacks)}>
                                    Crear pack
                                  </Button>
                                </>
                              ) : null}
                              {orderId ? (
                                <Button size="sm" variant="secondary" onClick={() => void d.openOrderDetail(orderId)}>
                                  Ver pedido
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      </Card>

      <p className="text-center text-xs text-[#9ca3af]">
        Panel de soporte ADMIN · Solo lectura operativa donde no se indique edición ·{" "}
        <Link href="/admin/escuelas" className="text-[#c27b3d] hover:underline">
          Volver al listado
        </Link>
      </p>
    </div>
  );
}
