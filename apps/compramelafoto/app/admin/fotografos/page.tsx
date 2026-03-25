"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatDate, getRoleLabel } from "@/lib/admin/helpers";

interface UserRow {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  city: string | null;
  province: string | null;
  createdAt: string;
  isBlocked: boolean;
  platformCommissionPercentOverride?: number | null;
  mpAccessToken: string | null;
  mpUserId: string | null;
  publicPageHandler: string | null;
  isPublicPageEnabled: boolean | null;
}

export default function AdminFotografosPage() {
  const [loading, setLoading] = useState(true);
  const [photographers, setPhotographers] = useState<UserRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [platformDefaultPercent, setPlatformDefaultPercent] = useState(10);
  const [bulkFeeValue, setBulkFeeValue] = useState("");
  const [bulkFeeBusy, setBulkFeeBusy] = useState(false);

  useEffect(() => {
    loadPhotographers();
  }, [searchQuery]);

  useEffect(() => {
    loadPlatformDefault();
  }, []);

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

  async function loadPhotographers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);

      const [resPhotographer, resLabPhotographer] = await Promise.all([
        fetch(`/api/admin/users?role=PHOTOGRAPHER&${params.toString()}`, { credentials: "include" }),
        fetch(`/api/admin/users?role=LAB_PHOTOGRAPHER&${params.toString()}`, { credentials: "include" }),
      ]);

      const dataPhotographer = resPhotographer.ok ? await resPhotographer.json() : [];
      const dataLabPhotographer = resLabPhotographer.ok ? await resLabPhotographer.json() : [];

      const combined = [...dataPhotographer, ...dataLabPhotographer] as UserRow[];
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPhotographers(combined);
      setSelected(new Set());
    } catch (err) {
      console.error("Error cargando fotógrafos:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(photographers.map((u) => u.id)));
    } else {
      setSelected(new Set());
    }
  }

  function toggleSelectOne(userId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function deleteSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`¿Eliminar ${ids.length} fotógrafo(s)? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error eliminando fotógrafos");
      }
      await loadPhotographers();
    } catch (err: any) {
      alert(err?.message || "Error eliminando fotógrafos");
    }
  }

  async function deleteOne(userId: number, email: string) {
    if (!confirm(`¿Eliminar al fotógrafo ${email}? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error eliminando fotógrafo");
      }
      await loadPhotographers();
    } catch (err: any) {
      alert(err?.message || "Error eliminando fotógrafo");
    }
  }

  async function updatePhotographerFee(
    userId: number,
    platformCommissionPercentOverride: number | null,
    options?: { skipReload?: boolean }
  ) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ platformCommissionPercentOverride }),
      });
      if (res.ok) {
        if (!options?.skipReload) {
          loadPhotographers();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert("Error: " + (data.error || "Error desconocido"));
      }
    } catch (err: any) {
      alert(err?.message || "Error actualizando fee");
    }
  }

  async function applyBulkFee() {
    if (bulkFeeBusy) return;
    const ids = Array.from(selected);
    if (!ids.length) return;
    const raw = bulkFeeValue.trim();
    const parsed = Number(raw);
    if (!raw || !Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      alert("El fee masivo debe estar entre 0 y 100");
      return;
    }
    const nextValue = Math.round(parsed);
    setBulkFeeBusy(true);
    try {
      await Promise.all(ids.map((id) => updatePhotographerFee(id, nextValue, { skipReload: true })));
      await loadPhotographers();
      setBulkFeeValue("");
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

  async function resetBulkFeeToDefault() {
    if (bulkFeeBusy) return;
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBulkFeeBusy(true);
    try {
      await Promise.all(ids.map((id) => updatePhotographerFee(id, null, { skipReload: true })));
      await loadPhotographers();
    } finally {
      setBulkFeeBusy(false);
    }
  }

  const allSelected = useMemo(
    () => photographers.length > 0 && selected.size === photographers.length,
    [photographers, selected]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando fotógrafos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fotógrafos</h1>
        <p className="text-gray-600 mt-1">Total: {photographers.length} fotógrafos registrados</p>
      </div>

      {selected.size > 0 && (
        <Card className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-gray-700">
            {selected.size} seleccionado(s) · Default plataforma: {platformDefaultPercent}%
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())}>
              Limpiar selección
            </Button>
            <Button variant="secondary" size="sm" onClick={deleteSelected}>
              Eliminar seleccionados
            </Button>
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
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

      <Card className="p-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Búsqueda</label>
          <Input
            type="text"
            placeholder="Email, nombre, teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ubicación</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee (%)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mercado Pago</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Alta</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {photographers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron fotógrafos
                  </td>
                </tr>
              ) : (
                photographers.map((user) => {
                  const hasMercadoPago = !!(user.mpAccessToken && user.mpUserId);
                  const whatsappUrl = buildWhatsappWebUrl(user.phone, user.name);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.has(user.id)}
                          onChange={() => toggleSelectOne(user.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">#{user.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{user.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{user.name || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{user.phone || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {[user.city, user.province].filter(Boolean).join(", ") || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{getRoleLabel(user.role)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.isBlocked ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                          {user.isBlocked ? "Bloqueado" : "Activo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          key={`${user.id}-${user.platformCommissionPercentOverride ?? "default"}-${platformDefaultPercent}`}
                          defaultValue={user.platformCommissionPercentOverride ?? platformDefaultPercent}
                          onBlur={(e) => {
                            const raw = e.currentTarget.value.trim();
                            const current = user.platformCommissionPercentOverride ?? null;
                            if (!raw) {
                              if (current === null) return;
                              updatePhotographerFee(user.id, null);
                              return;
                            }
                            const parsed = Number(raw);
                            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
                              alert("El fee debe estar entre 0 y 100");
                              e.currentTarget.value = current != null
                                ? String(current)
                                : String(platformDefaultPercent);
                              return;
                            }
                            if (current === null && parsed === platformDefaultPercent) {
                              return;
                            }
                            const nextValue = Math.round(parsed);
                            if (nextValue === current) return;
                            updatePhotographerFee(user.id, nextValue);
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
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(user.createdAt)}</td>
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
                          {user.publicPageHandler && user.isPublicPageEnabled && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const url = `${typeof window !== "undefined" ? window.location.origin : ""}/${user.publicPageHandler}`;
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
                            onClick={() => deleteOne(user.id, user.email)}
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
    </div>
  );
}
