"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import type { VendorJson } from "@/lib/finance-dnx/vendor-json";
import { PLATFORM_KEYS, type PlatformKey } from "@repo/finance-control";
import { isAllocationComplete, sumSharePercent } from "@/lib/finance-dnx/allocation-total";

const CATEGORIA_LABEL: Record<string, string> = {
  INFRA: "Infraestructura",
  IA: "Inteligencia artificial",
  EMAIL: "Email",
  DOMINIO: "Dominio",
  PUBLICIDAD: "Publicidad",
  LEGAL_CONTABLE: "Legal / Contable",
  COBROS: "Cobros",
  OTRO: "Otro",
};

const CICLO_LABEL: Record<string, string> = {
  MENSUAL: "Mensual",
  ANUAL: "Anual",
  USO: "Por uso",
  UNICO: "Único",
};

const PLATFORM_LABEL: Record<PlatformKey, string> = {
  clf: "CLF (CompraMeLaFoto)",
  fotoffice: "Fotoffice",
  fotorank: "FotoRank",
  clickaton: "Clickatón",
  infospot: "InfoSpot",
  suite: "Suite (estructura no atribuible)",
};

type SharesState = Record<PlatformKey, string>;

function sharesVacias(): SharesState {
  return Object.fromEntries(PLATFORM_KEYS.map((k) => [k, ""])) as SharesState;
}

type VendorFormState = {
  key: string;
  name: string;
  category: string;
  billingCurrency: "USD" | "ARS";
  billingCycle: string;
  paymentMethod: string;
  notes: string;
  active: boolean;
  shares: SharesState;
};

function formVacio(): VendorFormState {
  return {
    key: "",
    name: "",
    category: "INFRA",
    billingCurrency: "USD",
    billingCycle: "MENSUAL",
    paymentMethod: "",
    notes: "",
    active: true,
    shares: sharesVacias(),
  };
}

function formDesdeVendor(vendor: VendorJson): VendorFormState {
  const shares = sharesVacias();
  for (const asignacion of vendor.allocations) {
    if (asignacion.platformKey in shares) {
      shares[asignacion.platformKey as PlatformKey] = String(asignacion.sharePercent);
    }
  }
  return {
    key: vendor.key,
    name: vendor.name,
    category: vendor.category,
    billingCurrency: vendor.billingCurrency as "USD" | "ARS",
    billingCycle: vendor.billingCycle,
    paymentMethod: vendor.paymentMethod ?? "",
    notes: vendor.notes ?? "",
    active: vendor.active,
    shares,
  };
}

export default function FinanzasDnxProveedoresPage() {
  const [vendors, setVendors] = useState<VendorJson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<VendorFormState>(formVacio());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/finance-dnx/vendors", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los proveedores.");
        return;
      }
      setVendors(data.vendors || []);
    } catch {
      setError("Error de conexión al cargar los proveedores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const totalPercent = sumSharePercent(
    PLATFORM_KEYS.map((k) => ({ sharePercent: Number(form.shares[k]) || 0 })),
  );
  const repartoCompleto = isAllocationComplete(totalPercent);

  function iniciarNuevo() {
    setEditingId(null);
    setForm(formVacio());
    setFormError(null);
  }

  function iniciarEdicion(vendor: VendorJson) {
    setEditingId(vendor.id);
    setForm(formDesdeVendor(vendor));
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.key.trim()) {
      setFormError("Falta la clave del proveedor.");
      return;
    }
    if (!form.name.trim()) {
      setFormError("Falta el nombre del proveedor.");
      return;
    }

    const allocations = PLATFORM_KEYS
      .filter((k) => Number(form.shares[k]) > 0)
      .map((k) => ({ platformKey: k, sharePercent: Number(form.shares[k]) }));

    const body = {
      key: form.key.trim(),
      name: form.name.trim(),
      category: form.category,
      billingCurrency: form.billingCurrency,
      billingCycle: form.billingCycle,
      paymentMethod: form.paymentMethod.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
      allocations,
    };

    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/finance-dnx/vendors/${editingId}`
        : "/api/admin/finance-dnx/vendors";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || "No se pudo guardar el proveedor.");
        return;
      }
      iniciarNuevo();
      await loadVendors();
    } catch {
      setFormError("Error de conexión al guardar el proveedor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzas DNX — Proveedores</h1>
          <p className="text-gray-600 mt-1">
            Cada proveedor tiene un reparto fijo entre plataformas que se hereda mes a mes.
          </p>
        </div>
        <Button variant="secondary" onClick={iniciarNuevo}>
          Nuevo proveedor
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Moneda / Ciclo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reparto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Cargando...</td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No hay proveedores cargados</td>
                </tr>
              ) : (
                vendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {vendor.name}
                      <div className="text-xs text-gray-500">{vendor.key}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {CATEGORIA_LABEL[vendor.category] ?? vendor.category}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {vendor.billingCurrency} · {CICLO_LABEL[vendor.billingCycle] ?? vendor.billingCycle}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {vendor.allocations.length === 0
                        ? "Sin reparto"
                        : vendor.allocations
                            .map((a) => `${PLATFORM_LABEL[a.platformKey as PlatformKey] ?? a.platformKey} ${a.sharePercent}%`)
                            .join(" · ")}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${vendor.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                        {vendor.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => iniciarEdicion(vendor)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editingId ? "Editar proveedor" : "Nuevo proveedor"}
        </h2>

        {formError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm mb-4">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clave</label>
              <Input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="Ej: vercel"
                disabled={editingId !== null}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Vercel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {Object.entries(CATEGORIA_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciclo de facturación</label>
              <Select
                value={form.billingCycle}
                onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
              >
                {Object.entries(CICLO_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moneda de facturación</label>
              <Select
                value={form.billingCurrency}
                onChange={(e) => setForm({ ...form, billingCurrency: e.target.value as "USD" | "ARS" })}
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medio de pago (opcional)</label>
              <Input
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                placeholder="Ej: tarjeta terminada en 1234"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <Select
                value={form.active ? "true" : "false"}
                onChange={(e) => setForm({ ...form, active: e.target.value === "true" })}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Reparto entre plataformas
              </label>
              <span className={`text-sm font-semibold ${repartoCompleto ? "text-green-700" : "text-red-700"}`}>
                Suma: {totalPercent}% {repartoCompleto ? "" : "— tiene que dar 100%"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PLATFORM_KEYS.map((platformKey) => (
                <div key={platformKey} className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 flex-1">{PLATFORM_LABEL[platformKey]}</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.shares[platformKey]}
                    onChange={(e) =>
                      setForm({ ...form, shares: { ...form.shares, [platformKey]: e.target.value } })
                    }
                    className="w-24"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear proveedor"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={iniciarNuevo}>
                Cancelar edición
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
