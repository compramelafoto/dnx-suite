"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatDate, getStatusBadgeColor, getStatusLabel } from "@/lib/admin/helpers";

interface Lab {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  approvalStatus: string;
  isActive: boolean;
  isSuspended: boolean;
  commissionOverrideBps?: number | null;
  createdAt: string;
  mpAccessToken: string | null;
  mpUserId: string | null;
  mpConnectedAt: string | null;
  publicPageHandler: string | null;
  user: {
    id: number;
    email: string;
    name: string | null;
    phone: string | null;
  } | null;
}

export default function LaboratoriosClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedLabs, setSelectedLabs] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState(searchParams?.get("status") || "");
  const [showNewLabModal, setShowNewLabModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [platformDefaultPercent, setPlatformDefaultPercent] = useState(10);
  const [bulkFeeValue, setBulkFeeValue] = useState("");
  const [bulkFeeBusy, setBulkFeeBusy] = useState(false);
  
  // Formulario nuevo laboratorio
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    country: "Argentina",
    labType: "TYPE_B",
    approvalStatus: "PENDING",
  });

  useEffect(() => {
    loadLabs();
  }, [statusFilter]);

  useEffect(() => {
    loadPlatformDefault();
  }, []);

  // Cerrar modal de nuevo laboratorio con ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && showNewLabModal) {
        setShowNewLabModal(false);
      }
    }
    if (showNewLabModal) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [showNewLabModal]);

  async function loadPlatformDefault() {
    try {
      const res = await fetch("/api/admin/config", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const percent = Number(data?.platformCommissionPercent);
      if (Number.isFinite(percent)) {
        setPlatformDefaultPercent(Math.min(100, Math.max(0, percent)));
      }
    } catch (err) {
      console.error("Error cargando configuración de fee:", err);
    }
  }

  async function loadLabs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/labs?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Error cargando laboratorios:", errorData);
        return;
      }

      const data = await res.json();
      setLabs(data || []);
      setSelectedLabs(new Set());
    } catch (err) {
      console.error("Error cargando laboratorios:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedLabs(new Set(labs.map((l) => l.id)));
    } else {
      setSelectedLabs(new Set());
    }
  }

  function toggleSelectOne(labId: number) {
    setSelectedLabs((prev) => {
      const next = new Set(prev);
      if (next.has(labId)) {
        next.delete(labId);
      } else {
        next.add(labId);
      }
      return next;
    });
  }

  async function deleteSelectedLabs() {
    const ids = Array.from(selectedLabs);
    if (ids.length === 0) return;
    if (!confirm(`¿Eliminar ${ids.length} laboratorio(s)? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin/labs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Error eliminando laboratorios");
      }
      await loadLabs();
    } catch (err: any) {
      alert(err?.message || "Error eliminando laboratorios");
    }
  }

  async function updateLabStatus(labId: number, approvalStatus: string, reason?: string) {
    if (!confirm(`¿Estás seguro de cambiar el estado a ${approvalStatus}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/labs/${labId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          approvalStatus,
          ...(reason && { suspendedReason: reason }),
        }),
      });

      if (res.ok) {
        loadLabs();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert("Error: " + (errorData.error || "Error desconocido"));
      }
    } catch (err: any) {
      alert("Error: " + (err?.message || "Error desconocido"));
    }
  }

  async function updateLabFee(
    labId: number,
    commissionOverrideBps: number | null,
    options?: { skipReload?: boolean }
  ) {
    try {
      const res = await fetch(`/api/admin/labs/${labId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ commissionOverrideBps }),
      });
      if (res.ok) {
        if (!options?.skipReload) {
          loadLabs();
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert("Error: " + (errorData.error || "Error desconocido"));
      }
    } catch (err: any) {
      alert("Error: " + (err?.message || "Error desconocido"));
    }
  }

  async function applyBulkFee() {
    if (bulkFeeBusy) return;
    const ids = Array.from(selectedLabs);
    if (!ids.length) return;
    const raw = bulkFeeValue.trim();
    const parsed = Number(raw);
    if (!raw || !Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      alert("El fee masivo debe estar entre 0 y 100");
      return;
    }
    const bps = Math.round(parsed * 100);
    setBulkFeeBusy(true);
    try {
      await Promise.all(ids.map((id) => updateLabFee(id, bps, { skipReload: true })));
      await loadLabs();
      setBulkFeeValue("");
    } finally {
      setBulkFeeBusy(false);
    }
  }

  async function resetBulkFeeToDefault() {
    if (bulkFeeBusy) return;
    const ids = Array.from(selectedLabs);
    if (!ids.length) return;
    setBulkFeeBusy(true);
    try {
      await Promise.all(ids.map((id) => updateLabFee(id, null, { skipReload: true })));
      await loadLabs();
    } finally {
      setBulkFeeBusy(false);
    }
  }

  function buildWhatsappWebUrl(phone: string | null, name?: string | null) {
    if (!phone) return null;
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) return null;
    const firstName = (name || "").trim().split(" ")[0];
    const greetingName = firstName || "hola";
    const message = `Hola ${greetingName}, ¿cómo estás? Te escribo desde ComprameLaFoto para ver si necesitás ayuda o colaboración para usar la app.`;
    return `https://web.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(message)}`;
  }

  async function toggleSuspend(labId: number, currentStatus: boolean) {
    const action = currentStatus ? "reactivar" : "suspender";
    const reason = currentStatus ? "" : prompt("Motivo de la suspensión (opcional):") || "";

    if (!confirm(`¿Estás seguro de ${action} este laboratorio?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/labs/${labId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isSuspended: !currentStatus,
          suspendedReason: reason || null,
        }),
      });

      if (res.ok) {
        loadLabs();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert("Error: " + (errorData.error || "Error desconocido"));
      }
    } catch (err: any) {
      alert("Error: " + (err?.message || "Error desconocido"));
    }
  }

  async function deleteLab(labId: number, labName: string) {
    if (!confirm(`¿Estás seguro de eliminar el laboratorio "${labName}"?\n\nEsta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/labs/${labId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        loadLabs();
        alert("Laboratorio eliminado correctamente");
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert("Error: " + (errorData.error || "Error desconocido"));
      }
    } catch (err: any) {
      alert("Error: " + (err?.message || "Error desconocido"));
    }
  }

  async function handleCreateLab() {
    if (!formData.name.trim()) {
      alert("El nombre es requerido");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowNewLabModal(false);
        setFormData({
          name: "",
          email: "",
          phone: "",
          address: "",
          city: "",
          province: "",
          country: "Argentina",
          labType: "TYPE_B",
          approvalStatus: "PENDING",
        });
        loadLabs();
        alert("Laboratorio creado correctamente");
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert("Error: " + (errorData.error || "Error desconocido"));
      }
    } catch (err: any) {
      alert("Error: " + (err?.message || "Error desconocido"));
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando laboratorios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laboratorios</h1>
          <p className="text-gray-600 mt-1">Total: {labs.length} laboratorios</p>
        </div>
        <Button variant="primary" onClick={() => setShowNewLabModal(true)}>
          + Nuevo Laboratorio
        </Button>
      </div>

      {selectedLabs.size > 0 && (
        <Card className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-gray-700">
            {selectedLabs.size} seleccionado(s) · Default plataforma: {platformDefaultPercent}%
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelectedLabs(new Set())}>
              Limpiar selección
            </Button>
            <Button variant="secondary" size="sm" onClick={deleteSelectedLabs}>
              Eliminar seleccionados
            </Button>
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={bulkFeeValue}
                onChange={(e) => setBulkFeeValue(e.target.value)}
                placeholder="Fee masivo (%)"
                className="w-32"
              />
              <Button variant="primary" size="sm" onClick={applyBulkFee} disabled={bulkFeeBusy}>
                Aplicar
              </Button>
              <Button variant="secondary" size="sm" onClick={resetBulkFeeToDefault} disabled={bulkFeeBusy}>
                Default
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado de Aprobación
            </label>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="APPROVED">Aprobado</option>
              <option value="REJECTED">Rechazado</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tabla de laboratorios */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <input
                    type="checkbox"
                    checked={labs.length > 0 && selectedLabs.size === labs.length}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Teléfono
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ubicación
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Activo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fee (%)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Mercado Pago
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha Alta
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {labs.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron laboratorios
                  </td>
                </tr>
              ) : (
                labs.map((lab) => {
                  const hasMercadoPago = !!(lab.mpAccessToken && lab.mpUserId);
                  const whatsappUrl = buildWhatsappWebUrl(lab.phone || lab.user?.phone || null, lab.user?.name || lab.name);
                  
                  return (
                    <tr key={lab.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedLabs.has(lab.id)}
                          onChange={() => toggleSelectOne(lab.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        #{lab.id}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {lab.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {lab.email || lab.user?.email || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {lab.phone || lab.user?.phone || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {[lab.city, lab.province, lab.country].filter(Boolean).join(", ") || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(lab.approvalStatus)}`}>
                          {getStatusLabel(lab.approvalStatus)}
                        </span>
                        {lab.isSuspended && (
                          <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Suspendido
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${lab.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                          {lab.isActive ? "Sí" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          key={`${lab.id}-${lab.commissionOverrideBps ?? "default"}-${platformDefaultPercent}`}
                          defaultValue={lab.commissionOverrideBps != null ? lab.commissionOverrideBps / 100 : platformDefaultPercent}
                          onBlur={(e) => {
                            const raw = e.currentTarget.value.trim();
                            const currentBps = lab.commissionOverrideBps ?? null;
                            if (!raw) {
                              if (currentBps === null) return;
                              updateLabFee(lab.id, null);
                              return;
                            }
                            const parsed = Number(raw);
                            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
                              alert("El fee debe estar entre 0 y 100");
                              e.currentTarget.value = currentBps != null
                                ? String(currentBps / 100)
                                : String(platformDefaultPercent);
                              return;
                            }
                            if (currentBps === null && parsed === platformDefaultPercent) {
                              return;
                            }
                            const nextBps = Math.round(parsed * 100);
                            if (nextBps === currentBps) return;
                            updateLabFee(lab.id, nextBps);
                          }}
                          className="w-24"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {hasMercadoPago ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
                            <span>✓</span> Conectado
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1">
                            <span>⚠</span> Sin conectar
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(lab.createdAt)}
                      </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        {whatsappUrl && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
                          >
                            WhatsApp
                          </Button>
                        )}
                        {lab.publicPageHandler && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const url = `${typeof window !== "undefined" ? window.location.origin : ""}/l/${lab.publicPageHandler}`;
                              navigator.clipboard.writeText(url).then(
                                () => alert("URL copiada al portapapeles"),
                                () => alert("No se pudo copiar la URL")
                              );
                            }}
                          >
                            Copiar URL landing
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => router.push(`/admin/laboratorios/${lab.id}`)}
                        >
                          Ver
                        </Button>
                        {lab.approvalStatus === "PENDING" && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => updateLabStatus(lab.id, "APPROVED")}
                            >
                              Aprobar
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => updateLabStatus(lab.id, "REJECTED")}
                            >
                              Rechazar
                            </Button>
                          </>
                        )}
                        <Button
                          variant={lab.isSuspended ? "primary" : "secondary"}
                          size="sm"
                          onClick={() => toggleSuspend(lab.id, lab.isSuspended)}
                        >
                          {lab.isSuspended ? "Reactivar" : "Suspender"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => deleteLab(lab.id, lab.name)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal para nuevo laboratorio */}
      {showNewLabModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Nuevo Laboratorio</h2>
                <button
                  onClick={() => setShowNewLabModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nombre del laboratorio"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@ejemplo.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+54 11 1234-5678"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <Input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Calle y número"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ciudad
                    </label>
                    <Input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Ciudad"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Provincia
                    </label>
                    <Input
                      type="text"
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      placeholder="Provincia"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      País
                    </label>
                    <Input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="País"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Laboratorio
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.labType}
                      onChange={(e) => setFormData({ ...formData, labType: e.target.value })}
                    >
                      <option value="TYPE_B">Tipo B (Solo precio público)</option>
                      <option value="TYPE_A">Tipo A (Precio profesional + público)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estado de Aprobación
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.approvalStatus}
                      onChange={(e) => setFormData({ ...formData, approvalStatus: e.target.value })}
                    >
                      <option value="PENDING">Pendiente</option>
                      <option value="APPROVED">Aprobado</option>
                      <option value="REJECTED">Rechazado</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="primary"
                    onClick={handleCreateLab}
                    disabled={creating || !formData.name.trim()}
                    className="flex-1"
                  >
                    {creating ? "Creando..." : "Crear Laboratorio"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowNewLabModal(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
