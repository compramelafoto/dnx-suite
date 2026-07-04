"use client";

import { useEffect, useMemo, useState } from "react";
import type { AlbumMode } from "@prisma/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  availabilityPhaseOptions,
  packTypeOptions,
} from "@/lib/album-packs/album-pack-options";
import {
  albumPackPresetsByMode,
  albumPackSimpleModeReminder,
  type AlbumPackPreset,
} from "@/lib/album-packs/album-pack-presets";
import { validateAlbumPackConfig } from "@/lib/album-packs/validate-album-pack-config";

type AlbumPack = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  includedPhotoCount: number | null;
  requiresSelection: boolean;
  requiresDesign: boolean;
  templateId: number | null;
  availabilityPhase: string;
  packType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type AlbumTemplate = {
  id: number;
  name: string;
};

type AlbumPackForm = {
  name: string;
  description: string;
  price: string;
  includedPhotoCount: string;
  requiresSelection: boolean;
  requiresDesign: boolean;
  templateId: string;
  availabilityPhase: string;
  packType: string;
  isActive: boolean;
};

const INITIAL_FORM: AlbumPackForm = {
  name: "",
  description: "",
  price: "0",
  includedPhotoCount: "",
  requiresSelection: false,
  requiresDesign: false,
  templateId: "",
  availabilityPhase: "ALWAYS",
  packType: "DIGITAL",
  isActive: true,
};

type Props = {
  albumId: number;
  albumMode: AlbumMode;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function getOptionLabel(
  value: string,
  options: Array<{ value: string; label: string }>,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function getDiagnosticBadgeClasses(badge: string): string {
  switch (badge) {
    case "Listo para prueba interna":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "Falta cantidad de fotos":
    case "Falta plantilla":
      return "bg-red-50 text-red-700 border border-red-200";
    case "Inactivo":
      return "bg-gray-100 text-gray-600 border border-gray-200";
    case "Solo preventa":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "Postventa":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    case "Siempre disponible":
      return "bg-violet-50 text-violet-700 border border-violet-200";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-200";
  }
}

export default function AlbumPacksSection({ albumId, albumMode }: Props) {
  const [packs, setPacks] = useState<AlbumPack[]>([]);
  const [templates, setTemplates] = useState<AlbumTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingPackId, setDeletingPackId] = useState<string | null>(null);
  const [togglingPackId, setTogglingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPack, setEditingPack] = useState<AlbumPack | null>(null);
  const [form, setForm] = useState<AlbumPackForm>(INITIAL_FORM);

  const hasTemplates = templates.length > 0;
  const templateWarning =
    !hasTemplates
      ? "Para crear packs con diseño, primero necesitás tener una plantilla configurada."
      : null;

  const editingTemplateName = useMemo(() => {
    if (!editingPack?.templateId) return null;
    return (
      templates.find((template) => template.id === editingPack.templateId)?.name ??
      null
    );
  }, [editingPack, templates]);
  const presetsForMode = useMemo(
    () => albumPackPresetsByMode[albumMode] ?? [],
    [albumMode],
  );
  const templateIds = useMemo(
    () => new Set(templates.map((template) => template.id)),
    [templates],
  );

  async function loadPacks() {
    const res = await fetch(`/api/dashboard/albums/${albumId}/packs`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "No se pudieron cargar los packs");
    }
    setPacks(Array.isArray(data?.packs) ? data.packs : []);
  }

  async function loadTemplates() {
    const res = await fetch(`/api/dashboard/albums/${albumId}/templates`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        data?.error || "No se pudieron cargar las plantillas del álbum",
      );
    }
    const nextTemplates: AlbumTemplate[] = Array.isArray(data?.templates)
      ? data.templates
          .map((template: { id?: number; name?: string }) => ({
            id: Number(template?.id),
            name: String(template?.name ?? "Plantilla sin nombre"),
          }))
          .filter((template: AlbumTemplate) => Number.isInteger(template.id))
      : [];
    setTemplates(nextTemplates);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadPacks(), loadTemplates()])
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Error cargando packs del álbum";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [albumId]);

  function openCreateForm() {
    setEditingPack(null);
    setForm(INITIAL_FORM);
    setShowForm(true);
    setError(null);
  }

  function applyPresetToForm(preset: AlbumPackPreset) {
    if (preset.requiresDesign && !hasTemplates) {
      setError(
        "Este pack necesita una plantilla. Primero configurá una plantilla para poder crearlo.",
      );
      return;
    }
    setEditingPack(null);
    setForm({
      name: preset.name,
      description: preset.description,
      price: "0",
      includedPhotoCount:
        preset.includedPhotoCount != null ? String(preset.includedPhotoCount) : "",
      requiresSelection: preset.requiresSelection,
      requiresDesign: preset.requiresDesign,
      templateId:
        preset.requiresDesign && templates[0] ? String(templates[0].id) : "",
      availabilityPhase: preset.availabilityPhase,
      packType: preset.packType,
      isActive: true,
    });
    setShowForm(true);
    setError(null);
  }

  function openEditForm(pack: AlbumPack) {
    setEditingPack(pack);
    setForm({
      name: pack.name,
      description: pack.description ?? "",
      price: String(pack.price),
      includedPhotoCount:
        pack.includedPhotoCount != null ? String(pack.includedPhotoCount) : "",
      requiresSelection: pack.requiresSelection,
      requiresDesign: pack.requiresDesign,
      templateId: pack.templateId != null ? String(pack.templateId) : "",
      availabilityPhase: pack.availabilityPhase,
      packType: pack.packType,
      isActive: pack.isActive,
    });
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingPack(null);
    setForm(INITIAL_FORM);
  }

  function updateFormField<K extends keyof AlbumPackForm>(
    key: K,
    value: AlbumPackForm[K],
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function validateForm(): string | null {
    if (!form.name.trim()) return "El nombre del pack es obligatorio.";
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      return "El precio debe ser mayor o igual a 0.";
    }
    if (form.requiresSelection) {
      const includedPhotoCount = Number(form.includedPhotoCount);
      if (
        !Number.isFinite(includedPhotoCount) ||
        Math.trunc(includedPhotoCount) <= 0
      ) {
        return "Si el pack requiere selección, debés indicar una cantidad de fotos mayor a 0.";
      }
    }
    if (form.requiresDesign) {
      if (!form.requiresSelection) {
        return "Si el pack requiere diseño, también debe requerir selección.";
      }
      if (!form.templateId) {
        return "Si el pack requiere diseño, debés elegir una plantilla.";
      }
    }
    return null;
  }

  function buildPayload() {
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Math.max(0, Math.trunc(Number(form.price) || 0)),
      includedPhotoCount: form.requiresSelection
        ? Math.max(1, Math.trunc(Number(form.includedPhotoCount) || 0))
        : null,
      requiresSelection: form.requiresSelection,
      requiresDesign: form.requiresDesign,
      templateId: form.requiresDesign
        ? Number(form.templateId)
        : null,
      availabilityPhase: form.availabilityPhase,
      packType: form.packType,
      isActive: form.isActive,
    };
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const isEditing = Boolean(editingPack);
      const endpoint = isEditing
        ? `/api/dashboard/albums/${albumId}/packs/${editingPack?.id}`
        : `/api/dashboard/albums/${albumId}/packs`;
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar el pack");
      }
      const savedPack = data?.pack as AlbumPack | undefined;
      if (!savedPack) {
        throw new Error("La API no devolvió el pack guardado");
      }
      if (isEditing) {
        setPacks((previous) =>
          previous.map((pack) => (pack.id === savedPack.id ? savedPack : pack)),
        );
      } else {
        setPacks((previous) => [...previous, savedPack]);
      }
      closeForm();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error guardando el pack";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(packId: string) {
    const confirmed = window.confirm(
      "¿Eliminar este pack? Esta acción no se puede deshacer.",
    );
    if (!confirmed) return;
    setDeletingPackId(packId);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/packs/${packId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo eliminar el pack");
      }
      setPacks((previous) => previous.filter((pack) => pack.id !== packId));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error eliminando el pack";
      setError(message);
    } finally {
      setDeletingPackId(null);
    }
  }

  async function togglePackStatus(pack: AlbumPack) {
    setTogglingPackId(pack.id);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/packs/${pack.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !pack.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo actualizar el estado");
      }
      const updatedPack = data?.pack as AlbumPack | undefined;
      if (!updatedPack) {
        throw new Error("La API no devolvió el pack actualizado");
      }
      setPacks((previous) =>
        previous.map((item) => (item.id === updatedPack.id ? updatedPack : item)),
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error actualizando estado";
      setError(message);
    } finally {
      setTogglingPackId(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-[#1a1a1a]">Packs del álbum</h2>
          <p className="text-sm text-[#6b7280]">
            Configurá packs digitales, productos impresos o carpetas escolares
            para este álbum.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={openCreateForm}>
          Crear pack
        </Button>
      </div>

      {templateWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {templateWarning}
        </div>
      )}

      <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3 space-y-3">
        <h3 className="text-sm font-semibold text-[#1a1a1a]">
          Sugerencias para este tipo de álbum
        </h3>
        {albumMode === "SIMPLE" && (
          <p className="text-sm text-[#6b7280]">{albumPackSimpleModeReminder}</p>
        )}
        {presetsForMode.length === 0 ? (
          <p className="text-sm text-[#6b7280]">
            Este tipo de álbum no tiene presets avanzados por defecto.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {presetsForMode.map((preset) => (
              <div
                key={preset.id}
                className="rounded-lg border border-[#e5e7eb] bg-white p-3 space-y-2"
              >
                <p className="text-sm font-medium text-[#1a1a1a]">{preset.name}</p>
                <p className="text-xs text-[#6b7280]">{preset.description}</p>
                <p className="text-xs text-[#6b7280]">
                  {getOptionLabel(preset.packType, packTypeOptions)} ·{" "}
                  {getOptionLabel(
                    preset.availabilityPhase,
                    availabilityPhaseOptions,
                  )}{" "}
                  ·{" "}
                  {preset.requiresSelection
                    ? `Selección (${preset.includedPhotoCount ?? "-"} fotos)`
                    : "Sin selección"}
                  {" · "}
                  {preset.requiresDesign ? "Con diseño" : "Sin diseño"}
                </p>
                {preset.internalNote && (
                  <p className="text-xs text-amber-700">{preset.internalNote}</p>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => applyPresetToForm(preset)}
                >
                  Crear este pack
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#6b7280]">Cargando packs…</p>
      ) : packs.length === 0 ? (
        <p className="text-sm text-[#6b7280]">
          Todavía no hay packs cargados para este álbum.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-left text-[#1a1a1a]">
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Precio</th>
                <th className="py-2 pr-3">Fotos incluidas</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Disponibilidad</th>
                <th className="py-2 pr-3">Selección</th>
                <th className="py-2 pr-3">Diseño</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => (
                (() => {
                  const configStatus = validateAlbumPackConfig({
                    requiresSelection: pack.requiresSelection,
                    includedPhotoCount: pack.includedPhotoCount,
                    requiresDesign: pack.requiresDesign,
                    templateId: pack.templateId,
                    isActive: pack.isActive,
                    availabilityPhase: pack.availabilityPhase,
                    templateExists:
                      pack.templateId == null || templateIds.has(pack.templateId),
                  });
                  return (
                <tr
                  key={pack.id}
                  className="border-b border-[#e5e7eb] align-top last:border-b-0"
                >
                  <td className="py-3 pr-3">
                    <p className="font-medium text-[#1a1a1a]">{pack.name}</p>
                    <p className="text-xs text-[#6b7280] mt-1">
                      {pack.description || "Sin descripción"}
                    </p>
                    <div className="mt-2 rounded-md border border-[#e5e7eb] bg-[#fafafa] p-2 space-y-1">
                      <p className="text-[11px] font-semibold text-[#374151]">
                        Estado de configuración
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {configStatus.badges.map((badge) => (
                          <span
                            key={`${pack.id}-${badge}`}
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${getDiagnosticBadgeClasses(
                              badge,
                            )}`}
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                      {configStatus.errors.length > 0 && (
                        <ul className="space-y-0.5">
                          {configStatus.errors.map((errorMessage) => (
                            <li
                              key={`${pack.id}-error-${errorMessage}`}
                              className="text-[11px] text-red-700"
                            >
                              • {errorMessage}
                            </li>
                          ))}
                        </ul>
                      )}
                      {configStatus.warnings.length > 0 && (
                        <ul className="space-y-0.5">
                          {configStatus.warnings.map((warningMessage) => (
                            <li
                              key={`${pack.id}-warning-${warningMessage}`}
                              className="text-[11px] text-[#6b7280]"
                            >
                              • {warningMessage}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-[#1a1a1a]">
                    {formatCurrency(pack.price)}
                  </td>
                  <td className="py-3 pr-3 text-[#1a1a1a]">
                    {pack.includedPhotoCount ?? "-"}
                  </td>
                  <td className="py-3 pr-3 text-[#1a1a1a]">
                    {getOptionLabel(pack.packType, packTypeOptions)}
                  </td>
                  <td className="py-3 pr-3 text-[#1a1a1a]">
                    {getOptionLabel(
                      pack.availabilityPhase,
                      availabilityPhaseOptions,
                    )}
                  </td>
                  <td className="py-3 pr-3 text-[#1a1a1a]">
                    {pack.requiresSelection ? "Sí" : "No"}
                  </td>
                  <td className="py-3 pr-3 text-[#1a1a1a]">
                    {pack.requiresDesign ? "Sí" : "No"}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        pack.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-gray-100 text-gray-600 border border-gray-200"
                      }`}
                    >
                      {pack.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="text-xs text-[#6b7280] underline hover:text-[#1a1a1a]"
                        onClick={() => openEditForm(pack)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-xs text-[#6b7280] underline hover:text-[#1a1a1a]"
                        disabled={togglingPackId === pack.id}
                        onClick={() => togglePackStatus(pack)}
                      >
                        {togglingPackId === pack.id
                          ? "Guardando…"
                          : pack.isActive
                            ? "Desactivar"
                            : "Activar"}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 underline hover:text-red-700"
                        disabled={deletingPackId === pack.id}
                        onClick={() => handleDelete(pack.id)}
                      >
                        {deletingPackId === pack.id ? "Eliminando…" : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
                  );
                })()
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={closeForm}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#1a1a1a]">
                  {editingPack ? "Editar pack" : "Nuevo pack"}
                </h3>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="text-[#6b7280] hover:text-[#1a1a1a]"
                >
                  <span className="sr-only">Cerrar</span>
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {editingPack && editingPack.requiresDesign && !hasTemplates && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Este pack tenía diseño asociado
                  {editingTemplateName
                    ? ` (${editingTemplateName})`
                    : ""}{" "}
                  pero ahora no hay plantillas disponibles.
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1a1a1a]">
                    Nombre *
                  </label>
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      updateFormField("name", event.target.value)
                    }
                    placeholder="Ej: Pack evento premium"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1a1a1a]">
                    Descripción
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      updateFormField("description", event.target.value)
                    }
                    placeholder="Descripción corta del pack"
                    className="min-h-[88px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#1a1a1a]">
                      Precio (ARS) *
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={form.price}
                      onChange={(event) =>
                        updateFormField("price", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#1a1a1a]">
                      Tipo de pack
                    </label>
                    <select
                      value={form.packType}
                      onChange={(event) =>
                        updateFormField("packType", event.target.value)
                      }
                      className="h-10 w-full rounded-lg border border-[#e5e7eb] px-3 text-sm"
                    >
                      {packTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#1a1a1a]">
                      Disponibilidad
                    </label>
                    <select
                      value={form.availabilityPhase}
                      onChange={(event) =>
                        updateFormField("availabilityPhase", event.target.value)
                      }
                      className="h-10 w-full rounded-lg border border-[#e5e7eb] px-3 text-sm"
                    >
                      {availabilityPhaseOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#1a1a1a]">
                      Cantidad de fotos incluidas
                    </label>
                    <Input
                      type="number"
                      min={1}
                      disabled={!form.requiresSelection}
                      placeholder={
                        form.requiresSelection
                          ? "Ej: 10"
                          : "Activá “Requiere selección”"
                      }
                      value={form.includedPhotoCount}
                      onChange={(event) =>
                        updateFormField("includedPhotoCount", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                    <input
                      type="checkbox"
                      checked={form.requiresSelection}
                      onChange={(event) =>
                        updateFormField("requiresSelection", event.target.checked)
                      }
                    />
                    Requiere selección de fotos
                  </label>

                  <label className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                    <input
                      type="checkbox"
                      checked={form.requiresDesign}
                      disabled={!hasTemplates}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        if (checked) {
                          updateFormField("requiresDesign", true);
                          updateFormField("requiresSelection", true);
                          if (!form.templateId && templates[0]) {
                            updateFormField("templateId", String(templates[0].id));
                          }
                          return;
                        }
                        updateFormField("requiresDesign", false);
                        updateFormField("templateId", "");
                      }}
                    />
                    Requiere diseño
                  </label>
                </div>

                {form.requiresDesign && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#1a1a1a]">
                      Plantilla asociada *
                    </label>
                    <select
                      value={form.templateId}
                      onChange={(event) =>
                        updateFormField("templateId", event.target.value)
                      }
                      className="h-10 w-full rounded-lg border border-[#e5e7eb] px-3 text-sm"
                      required
                    >
                      <option value="">Seleccionar plantilla</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    {!hasTemplates && (
                      <p className="mt-1 text-xs text-amber-700">
                        Para usar diseño, primero cargá una plantilla en el
                        álbum.
                      </p>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      updateFormField("isActive", event.target.checked)
                    }
                  />
                  Pack activo
                </label>

                <div className="flex justify-end gap-2 border-t border-[#e5e7eb] pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={closeForm}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving
                      ? "Guardando…"
                      : editingPack
                        ? "Guardar cambios"
                        : "Crear pack"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </>
      )}
    </Card>
  );
}
