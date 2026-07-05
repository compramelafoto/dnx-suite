"use client";

import type { Dispatch, SetStateAction } from "react";
import { Fragment, useMemo } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import type {
  AlbumConfigFormState,
  AlbumRow,
  DetailResponse,
  PackFormState,
  PackRow,
  SchoolOption,
} from "@/components/admin/school-detail/types";
import { formatCurrencyArs, formatDate, formatPackPhase } from "@/lib/admin/school-detail-format";
import {
  filterSchoolAlbumsByTab,
  type SchoolAlbumListFilter,
} from "@/lib/admin/school-albums-filter";
import {
  formatStudentIdentificationModeDescription,
  formatStudentIdentificationModeLabel,
  STUDENT_IDENTIFICATION_MODE_VALUES,
  type StudentIdentificationModeValue,
} from "@/lib/school-roster/student-identification-mode-ui";

const FILTER_BUTTONS: Array<[SchoolAlbumListFilter, string]> = [
  ["all", "Todos"],
  ["active", "Activos"],
  ["test", "Test"],
  ["commission", "Colaborativos"],
  ["preventa", "Preventa activa"],
  ["stocked", "Con fotos + alumnos"],
  ["completos", "Completos (fotos+alumnos+pedidos)"],
];

export type SchoolAlbumsTabProps = {
  detail: DetailResponse;
  albumListFilter: SchoolAlbumListFilter;
  setAlbumListFilter: Dispatch<SetStateAction<SchoolAlbumListFilter>>;
  schoolOptionsForSelect: SchoolOption[];

  editingAlbumId: number | null;
  albumConfigForm: AlbumConfigFormState | null;
  setAlbumConfigForm: Dispatch<SetStateAction<AlbumConfigFormState | null>>;
  albumSaveError: string | null;
  albumSaveLoading: boolean;
  isChangingSchoolAssociation: boolean;
  startEditingAlbum: (album: AlbumRow) => void;
  cancelEditingAlbum: () => void;
  handleSaveAlbumConfig: () => void | Promise<void>;

  editingPackId: number | null;
  packForm: PackFormState | null;
  setPackForm: Dispatch<SetStateAction<PackFormState | null>>;
  packSaveError: string | null;
  packSaveLoading: boolean;
  currentEditingPack: PackRow | null;
  startEditingPack: (pack: PackRow) => void;
  cancelEditingPack: () => void;
  handleSavePack: (pack: PackRow) => void | Promise<void>;

  openOrderDetail: (orderId: number) => void | Promise<void>;
  orderDetailLoading: boolean;
  selectedOrderId: number | null;
};

export function SchoolAlbumsTab(p: SchoolAlbumsTabProps) {
  const albumsFiltered = useMemo(
    () => filterSchoolAlbumsByTab(p.detail, p.albumListFilter),
    [p.detail, p.albumListFilter]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#ebe8e4] bg-[#fafafa] px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Filtros</span>
        {FILTER_BUTTONS.map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={p.albumListFilter === id ? "primary" : "outline"}
            onClick={() => p.setAlbumListFilter(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden rounded-2xl border border-[#ebe8e4] p-0 shadow-sm">
        <div className="border-b border-[#f3f4f6] px-5 py-4">
          <h3 className="text-base font-semibold text-[#111827]">Álbumes</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#6b7280]">
            Portada del operativo · editá configuración escolar y slugs públicos.
          </p>
        </div>
        <div className="overflow-x-auto p-4 sm:p-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Fotógrafo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Fotos</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Alumnos</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Pedidos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {albumsFiltered.map((album) => (
                <Fragment key={album.id}>
                  <tr id={`album-row-${album.id}`}>
                    <td className="px-4 py-3 text-sm text-gray-900">{album.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{album.publicSlug || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {album.ownerUser.name || album.ownerUser.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(album.eventDate || album.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {album.isTest ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          TEST
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                          ACTIVO
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{album.metrics.photoCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{album.metrics.studentCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{album.metrics.orderCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" disabled>
                          Ver
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => p.startEditingAlbum(album)}>
                          Editar configuración
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {p.editingAlbumId === album.id && p.albumConfigForm ? (
                    <tr>
                      <td colSpan={9} className="bg-gray-50 px-4 py-4">
                        <div
                          id={`album-config-form-${album.id}`}
                          className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
                        >
                          <h4 className="font-medium text-gray-900">Editar configuración escolar del álbum</h4>
                          {p.albumSaveError ? (
                            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                              {p.albumSaveError}
                            </p>
                          ) : null}
                          {p.isChangingSchoolAssociation ? (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                              Cambiar la escuela asociada puede afectar el listado de alumnos, preventas, operativo escolar
                              y reportes. Usar solo si se cargó mal originalmente.
                            </p>
                          ) : null}
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Nombre del álbum
                              </label>
                              <Input
                                id={`album-config-title-input-${album.id}`}
                                value={p.albumConfigForm.title}
                                onChange={(event) =>
                                  p.setAlbumConfigForm((prev) =>
                                    prev ? { ...prev, title: event.target.value } : prev
                                  )
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Slug público</label>
                              <Input
                                value={p.albumConfigForm.publicSlug}
                                onChange={(event) =>
                                  p.setAlbumConfigForm((prev) =>
                                    prev ? { ...prev, publicSlug: event.target.value } : prev
                                  )
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Fecha del evento
                              </label>
                              <Input
                                type="date"
                                value={p.albumConfigForm.eventDate}
                                onChange={(event) =>
                                  p.setAlbumConfigForm((prev) =>
                                    prev ? { ...prev, eventDate: event.target.value } : prev
                                  )
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Escuela asociada
                              </label>
                              <select
                                value={p.albumConfigForm.schoolId}
                                onChange={(event) =>
                                  p.setAlbumConfigForm((prev) =>
                                    prev ? { ...prev, schoolId: event.target.value } : prev
                                  )
                                }
                                className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                              >
                                <option value="">Sin escuela</option>
                                {p.schoolOptionsForSelect.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Identificación de alumnos
                              </label>
                              <select
                                id={`album-config-student-identification-mode-${album.id}`}
                                value={p.albumConfigForm.studentIdentificationMode}
                                onChange={(event) =>
                                  p.setAlbumConfigForm((prev) =>
                                    prev ? { ...prev, studentIdentificationMode: event.target.value } : prev
                                  )
                                }
                                className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                              >
                                <option value="">Sin definir</option>
                                {STUDENT_IDENTIFICATION_MODE_VALUES.map((mode) => (
                                  <option key={mode} value={mode}>
                                    {formatStudentIdentificationModeLabel(mode)}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-1 text-xs text-gray-500">
                                {formatStudentIdentificationModeDescription(
                                  (p.albumConfigForm.studentIdentificationMode as StudentIdentificationModeValue) ||
                                    null
                                )}
                              </p>
                            </div>
                            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                                Comisión organizador de escuela
                              </p>
                              <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={p.albumConfigForm.organizerCommissionEnabled}
                                  onChange={(event) =>
                                    p.setAlbumConfigForm((prev) =>
                                      prev ? { ...prev, organizerCommissionEnabled: event.target.checked } : prev
                                    )
                                  }
                                />
                                Activar comisión para ventas desde link de escuela
                              </label>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-600">
                                    Porcentaje (%)
                                  </label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.01"
                                    value={p.albumConfigForm.organizerCommissionPercentage}
                                    onChange={(event) =>
                                      p.setAlbumConfigForm((prev) =>
                                        prev
                                          ? { ...prev, organizerCommissionPercentage: event.target.value }
                                          : prev
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-600">Aplica a</label>
                                  <div className="space-y-1 text-sm">
                                    {(
                                      [
                                        ["PREVENTA", "Preventa"],
                                        ["POST_EVENT", "Post evento"],
                                        ["EXTRAS", "Extras/canje"],
                                      ] as const
                                    ).map(([value, label]) => (
                                      <label key={value} className="inline-flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={(p.albumConfigForm?.organizerCommissionAppliesTo ?? []).includes(
                                            value
                                          )}
                                          onChange={(event) =>
                                            p.setAlbumConfigForm((prev) => {
                                              if (!prev) return prev;
                                              const nextSet = new Set(prev.organizerCommissionAppliesTo);
                                              if (event.target.checked) {
                                                nextSet.add(value);
                                              } else {
                                                nextSet.delete(value);
                                              }
                                              return {
                                                ...prev,
                                                organizerCommissionAppliesTo: Array.from(nextSet),
                                              };
                                            })
                                          }
                                        />
                                        {label}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500">
                                La comisión se calcula sobre el precio del servicio sin incluir el costo de la
                                plataforma. La plataforma no realiza el pago; lo paga el fotógrafo.
                              </p>
                            </div>
                            <div className="flex items-center gap-5 pt-2 text-sm">
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={p.albumConfigForm.isTest}
                                  onChange={(event) =>
                                    p.setAlbumConfigForm((prev) =>
                                      prev ? { ...prev, isTest: event.target.checked } : prev
                                    )
                                  }
                                />
                                Modo TEST
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={p.albumConfigForm.allowManualStudentFallback}
                                  onChange={(event) =>
                                    p.setAlbumConfigForm((prev) =>
                                      prev ? { ...prev, allowManualStudentFallback: event.target.checked } : prev
                                    )
                                  }
                                />
                                Permitir carga manual
                              </label>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={p.cancelEditingAlbum}>
                              Cancelar
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => void p.handleSaveAlbumConfig()}
                              disabled={p.albumSaveLoading}
                            >
                              {p.albumSaveLoading ? "Guardando..." : "Guardar"}
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-[#ebe8e4] p-0 shadow-sm">
        <div className="border-b border-[#f3f4f6] px-5 py-4">
          <h3 className="text-base font-semibold text-[#111827]">Packs</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#6b7280]">
            Fases PRE/POST, vigencias y estado de uso.
          </p>
        </div>
        <div className="overflow-x-auto p-4 sm:p-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Álbum</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Precio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Fase</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Activo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                  Requiere diseño
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                  Pedidos asociados
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                  Fecha de creación
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {p.detail.packs.map((pack) => (
                <Fragment key={`${pack.source}-${pack.id}`}>
                  <tr id={`pack-row-${pack.id}`}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{pack.name}</span>
                        {pack.source === "ALBUM_PRODUCT" ? (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                            legacy
                          </span>
                        ) : null}
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            pack.orderCount > 0
                              ? "bg-amber-100 text-amber-900"
                              : "bg-emerald-100 text-emerald-900"
                          }`}
                        >
                          {pack.orderCount > 0 ? "Con ventas" : "Sin ventas"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{pack.albumTitle}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatCurrencyArs(pack.priceClientArs)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatPackPhase(pack.availabilityPhase)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          pack.isActive ? "bg-emerald-100 text-emerald-900" : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {pack.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          pack.requiresDesign ? "bg-violet-100 text-violet-900" : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {pack.requiresDesign ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{pack.orderCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(pack.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          pack.inUse ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {pack.inUse ? "En uso" : "Sin uso"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => p.startEditingPack(pack)}
                        disabled={pack.source !== "PACK_DEFINITION"}
                        title={
                          pack.source !== "PACK_DEFINITION"
                            ? "Este ítem legacy no se edita desde este módulo."
                            : undefined
                        }
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                  {p.editingPackId === pack.id && p.packForm ? (
                    <tr>
                      <td colSpan={10} className="bg-gray-50 px-4 py-4">
                        <div
                          id={`pack-config-form-${pack.id}`}
                          className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
                        >
                          <h4 className="font-medium text-gray-900">Editar pack</h4>
                          {p.packSaveError ? (
                            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                              {p.packSaveError}
                            </p>
                          ) : null}
                          {p.currentEditingPack?.inUse ? (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                              Este pack ya tiene ventas. Solo podés modificar disponibilidad y vigencia para no afectar
                              compras existentes.
                            </p>
                          ) : null}
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Nombre</label>
                              <Input
                                id={`pack-config-name-input-${pack.id}`}
                                value={p.packForm.name}
                                disabled={Boolean(p.currentEditingPack?.inUse)}
                                onChange={(event) =>
                                  p.setPackForm((prev) =>
                                    prev ? { ...prev, name: event.target.value } : prev
                                  )
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Precio (ARS)</label>
                              <Input
                                type="number"
                                min={0}
                                value={p.packForm.priceClientArs}
                                disabled={Boolean(p.currentEditingPack?.inUse)}
                                onChange={(event) =>
                                  p.setPackForm((prev) =>
                                    prev ? { ...prev, priceClientArs: event.target.value } : prev
                                  )
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">Fase</label>
                              <select
                                id={`pack-config-phase-input-${pack.id}`}
                                value={p.packForm.availabilityPhase}
                                disabled={Boolean(p.currentEditingPack?.inUse)}
                                onChange={(event) =>
                                  p.setPackForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          availabilityPhase: event.target.value as
                                            | ""
                                            | "PRE_UPLOAD"
                                            | "POST_UPLOAD",
                                        }
                                      : prev
                                  )
                                }
                                className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                              >
                                <option value="">Sin fase</option>
                                <option value="PRE_UPLOAD">Antes de fotos</option>
                                <option value="POST_UPLOAD">Después de fotos</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                              <input
                                id={`pack-active-${pack.id}`}
                                type="checkbox"
                                checked={p.packForm.isActive}
                                onChange={(event) =>
                                  p.setPackForm((prev) =>
                                    prev ? { ...prev, isActive: event.target.checked } : prev
                                  )
                                }
                              />
                              <label htmlFor={`pack-active-${pack.id}`} className="text-sm text-gray-700">
                                Activo
                              </label>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Vigencia desde
                              </label>
                              <Input
                                type="date"
                                value={p.packForm.validFrom}
                                disabled={Boolean(p.currentEditingPack?.inUse)}
                                onChange={(event) =>
                                  p.setPackForm((prev) =>
                                    prev ? { ...prev, validFrom: event.target.value } : prev
                                  )
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Vigencia hasta
                              </label>
                              <Input
                                type="date"
                                id={`pack-config-valid-until-input-${pack.id}`}
                                value={p.packForm.validUntil}
                                onChange={(event) =>
                                  p.setPackForm((prev) =>
                                    prev ? { ...prev, validUntil: event.target.value } : prev
                                  )
                                }
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="mb-1 block text-xs font-medium text-gray-600">Descripción</label>
                              <Textarea
                                rows={3}
                                value={p.packForm.description}
                                disabled={Boolean(p.currentEditingPack?.inUse)}
                                onChange={(event) =>
                                  p.setPackForm((prev) =>
                                    prev ? { ...prev, description: event.target.value } : prev
                                  )
                                }
                                className="text-sm"
                              />
                            </div>
                          </div>
                          {p.currentEditingPack?.inUse ? (
                            <p className="text-xs text-gray-600">
                              Campos bloqueados por historial: nombre, precio, fase, descripción y
                              estructura/beneficios.
                            </p>
                          ) : null}
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={p.cancelEditingPack}>
                              Cancelar
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={p.packSaveLoading}
                              onClick={() => void p.handleSavePack(pack)}
                            >
                              {p.packSaveLoading ? "Guardando..." : "Guardar"}
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-[#ebe8e4] p-0 shadow-sm">
        <div className="border-b border-[#f3f4f6] px-5 py-4">
          <h3 className="text-base font-semibold text-[#111827]">Pedidos recientes</h3>
          <p className="mt-1 text-sm text-[#6b7280]">
            Hasta {p.detail.limits.orders} pedidos cargados en este resumen operativo.
          </p>
        </div>
        <div className="overflow-x-auto p-4 sm:p-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Alumno</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Pack</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Estado pago</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Fecha</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {p.detail.orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">{order.studentName}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{order.clientEmail}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{order.packName}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{order.paymentStatus}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void p.openOrderDetail(order.id)}
                      disabled={p.orderDetailLoading && p.selectedOrderId === order.id}
                    >
                      {p.orderDetailLoading && p.selectedOrderId === order.id ? "Cargando..." : "Ver detalle"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
