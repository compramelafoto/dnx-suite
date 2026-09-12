"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { formatARS, formatDateOnly } from "@/lib/admin/helpers";
import { isOverdueUnpaid } from "@/lib/finance-dnx/due-date";
import type { VendorJson } from "@/lib/finance-dnx/vendor-json";
import type { ExpenseEntryJson } from "@/lib/finance-dnx/expense-json";
import type { ExpenseStatus } from "@repo/finance-control";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const AHORA = new Date();
const ANIOS = Array.from({ length: 5 }, (_, i) => AHORA.getFullYear() - 3 + i);

const ESTADOS: { value: ExpenseStatus; label: string }[] = [
  { value: "ESTIMADO", label: "Estimado" },
  { value: "FACTURADO", label: "Facturado" },
  { value: "PAGADO", label: "Pagado" },
  { value: "RECHAZADO", label: "Rechazado" },
  { value: "IMPAGO", label: "Impago" },
  { value: "REEMBOLSADO", label: "Reembolsado" },
];

const ESTADO_LABEL: Record<string, string> = Object.fromEntries(
  ESTADOS.map((e) => [e.value, e.label]),
);

const ESTADO_COLOR: Record<string, string> = {
  ESTIMADO: "bg-gray-100 text-gray-800",
  FACTURADO: "bg-blue-100 text-blue-800",
  PAGADO: "bg-green-100 text-green-800",
  RECHAZADO: "bg-red-100 text-red-800",
  IMPAGO: "bg-red-100 text-red-800",
  REEMBOLSADO: "bg-yellow-100 text-yellow-800",
};

type FormState = {
  vendorId: string;
  currency: "ARS" | "USD";
  amountOriginal: string;
  fxRate: string;
  taxPercent: string;
  status: ExpenseStatus;
  notes: string;
  dueDate: string;
};

const FORM_VACIO: FormState = {
  vendorId: "",
  currency: "ARS",
  amountOriginal: "",
  fxRate: "",
  taxPercent: "0",
  status: "FACTURADO",
  notes: "",
  dueDate: "",
};

/** yyyy-mm-dd para el input type="date"; acepta lo que llegue de la API (una fecha ISO como string, o null). */
function fechaParaInput(dueDate: string | Date | null | undefined): string {
  if (!dueDate) return "";
  const fecha = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toISOString().slice(0, 10);
}

function formDesdeEntry(entry: ExpenseEntryJson): FormState {
  return {
    vendorId: String(entry.vendorId),
    currency: entry.currency as "ARS" | "USD",
    amountOriginal: String(entry.amountOriginalMinor / 100),
    fxRate: entry.fxRate != null ? String(entry.fxRate) : "",
    taxPercent: String(entry.taxPercent),
    status: entry.status as ExpenseStatus,
    notes: entry.notes ?? "",
    dueDate: fechaParaInput(entry.dueDate as unknown as string | Date | null),
  };
}

export default function FinanzasDnxGastosPage() {
  const [year, setYear] = useState(AHORA.getFullYear());
  const [month, setMonth] = useState(AHORA.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ExpenseEntryJson[]>([]);
  const [vendors, setVendors] = useState<VendorJson[]>([]);
  const [copiando, setCopiando] = useState(false);
  const [copiaMensaje, setCopiaMensaje] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Tipo de cambio del período: bloque propio, separado del formulario de
  // carga. Éste es el que de verdad se guarda con PUT /fx.
  const [fxValue, setFxValue] = useState("");
  const [fxError, setFxError] = useState<string | null>(null);
  const [fxMessage, setFxMessage] = useState<string | null>(null);
  const [fxSaving, setFxSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/finance-dnx/expenses?year=${year}&month=${month}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los gastos.");
        setEntries([]);
        return;
      }
      setEntries(data.entries || []);
    } catch {
      setError("Error de conexión al cargar los gastos.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  const loadVendors = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/finance-dnx/vendors", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setVendors(data.vendors || []);
    } catch {
      // La lista de proveedores es para el formulario de alta; si falla, el
      // formulario queda sin opciones pero la tabla del mes igual se ve.
    }
  }, []);

  // El tipo de cambio del período se propone solo en el formulario de carga,
  // pero queda editable: es el valor por defecto, no una imposición. También
  // alimenta el bloque de "dólar del mes" de más abajo.
  const loadFx = useCallback(async () => {
    setFxError(null);
    try {
      const res = await fetch(`/api/admin/finance-dnx/fx?year=${year}&month=${month}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFxError(data.error || "No se pudo cargar el tipo de cambio.");
        setFxValue("");
        return;
      }
      const valor = data.usdToArs != null ? String(data.usdToArs) : "";
      setFxValue(valor);
      if (data.usdToArs != null) {
        setForm((f) => ({ ...f, fxRate: valor }));
      }
    } catch {
      setFxError("Error de conexión al cargar el tipo de cambio.");
    }
  }, [year, month]);

  useEffect(() => {
    loadEntries();
    loadFx();
  }, [loadEntries, loadFx]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  async function handleCopiarMesAnterior() {
    setCopiando(true);
    setCopiaMensaje(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/finance-dnx/expenses/copy-previous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ year, month }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo copiar el mes anterior.");
        return;
      }
      setCopiaMensaje(`Se copiaron ${data.copiados} gastos. Se omitieron ${data.omitidos} porque ya tenían uno cargado este mes.`);
      await loadEntries();
    } catch {
      setError("Error de conexión al copiar el mes anterior.");
    } finally {
      setCopiando(false);
    }
  }

  function iniciarNuevo() {
    setEditingId(null);
    setForm(FORM_VACIO);
    setFormError(null);
    // Sin esto, el formulario de carga queda con el dólar en blanco: se
    // vuelve a proponer el tipo de cambio del período.
    loadFx();
  }

  function iniciarEdicion(entry: ExpenseEntryJson) {
    setEditingId(entry.id);
    setForm(formDesdeEntry(entry));
    setFormError(null);
  }

  async function handleDelete(entry: ExpenseEntryJson) {
    const proveedor = entry.vendor?.name ?? "este proveedor";
    const periodo = `${MESES[entry.periodMonth - 1]} ${entry.periodYear}`;
    const confirmado = window.confirm(
      `¿Borrar el gasto de ${proveedor} de ${periodo}? No se puede deshacer.`,
    );
    if (!confirmado) return;

    setError(null);
    setDeletingId(entry.id);
    try {
      const res = await fetch(`/api/admin/finance-dnx/expenses/${entry.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo borrar el gasto.");
        return;
      }
      if (editingId === entry.id) iniciarNuevo();
      await loadEntries();
    } catch {
      setError("Error de conexión al borrar el gasto.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.vendorId) {
      setFormError("Elegí un proveedor.");
      return;
    }
    const amountOriginal = Number(form.amountOriginal);
    if (!Number.isFinite(amountOriginal) || amountOriginal <= 0) {
      setFormError("El importe original tiene que ser un número mayor a 0.");
      return;
    }
    const fxRate = form.currency === "USD" ? Number(form.fxRate) : null;
    if (form.currency === "USD" && (!Number.isFinite(fxRate) || (fxRate ?? 0) <= 0)) {
      setFormError("Una factura en dólares necesita un tipo de cambio válido.");
      return;
    }

    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/finance-dnx/expenses/${editingId}`
        : "/api/admin/finance-dnx/expenses";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vendorId: Number(form.vendorId),
          periodYear: year,
          periodMonth: month,
          currency: form.currency,
          amountOriginal,
          fxRate,
          taxPercent: Number(form.taxPercent) || 0,
          status: form.status,
          notes: form.notes.trim() || null,
          dueDate: form.dueDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || (editingId ? "No se pudo editar el gasto." : "No se pudo crear el gasto."));
        return;
      }
      setEditingId(null);
      setForm({ ...FORM_VACIO, fxRate: form.currency === "USD" ? form.fxRate : "" });
      await loadEntries();
    } catch {
      setFormError(editingId ? "Error de conexión al editar el gasto." : "Error de conexión al crear el gasto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGuardarFx(e: React.FormEvent) {
    e.preventDefault();
    setFxError(null);
    setFxMessage(null);

    const usdToArs = Number(fxValue);
    if (!Number.isFinite(usdToArs) || usdToArs <= 0) {
      setFxError("El tipo de cambio tiene que ser un número mayor a 0.");
      return;
    }

    setFxSaving(true);
    try {
      const res = await fetch("/api/admin/finance-dnx/fx", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ year, month, usdToArs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFxError(data.error || "No se pudo guardar el tipo de cambio.");
        return;
      }
      const valor = String(data.usdToArs);
      setFxValue(valor);
      setForm((f) => ({ ...f, fxRate: valor }));
      setFxMessage("Tipo de cambio guardado.");
    } catch {
      setFxError("Error de conexión al guardar el tipo de cambio.");
    } finally {
      setFxSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzas DNX — Gastos</h1>
          <p className="text-gray-600 mt-1">Gastos cargados para {MESES[month - 1]} {year}.</p>
        </div>
        <div className="flex gap-2">
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-auto">
            {MESES.map((nombre, i) => (
              <option key={nombre} value={i + 1}>{nombre}</option>
            ))}
          </Select>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-auto">
            {ANIOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      {copiaMensaje && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-blue-800 text-sm">
          {copiaMensaje}
        </div>
      )}

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Dólar de {MESES[month - 1]} {year}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Es el dólar tarjeta, que ya incluye impuestos — por eso el impuesto de la factura
              queda en 0% cuando se usa este valor. No sumarle el 30% de nuevo.
            </p>
          </div>
          <form onSubmit={handleGuardarFx} className="flex items-end gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pesos por dólar</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={fxValue}
                onChange={(e) => setFxValue(e.target.value)}
                placeholder="Ej: 1450.00"
                className="w-40"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={fxSaving}>
              {fxSaving ? "Guardando..." : "Guardar"}
            </Button>
          </form>
        </div>
        {fxError && <p className="text-sm text-red-700 mt-2">{fxError}</p>}
        {fxMessage && <p className="text-sm text-green-700 mt-2">{fxMessage}</p>}
      </Card>

      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={handleCopiarMesAnterior}
          disabled={copiando}
        >
          {copiando ? "Copiando..." : "Copiar del mes anterior"}
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Importe original</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Moneda</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Dólar</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impuesto</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo real</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimiento</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">Cargando...</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No hay gastos cargados este mes</td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const vencida = isOverdueUnpaid(
                    entry.dueDate as unknown as string | null,
                    entry.status as ExpenseStatus,
                  );
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{entry.vendor?.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {(entry.amountOriginalMinor / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{entry.currency}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-right">
                        {entry.fxRate != null ? entry.fxRate.toLocaleString("es-AR") : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-right">{entry.taxPercent}%</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right">
                        {formatARS(entry.amountArsMinor / 100)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${ESTADO_COLOR[entry.status] ?? "bg-gray-100 text-gray-800"}`}>
                          {ESTADO_LABEL[entry.status] ?? entry.status}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm ${vencida ? "text-red-700 font-semibold" : "text-gray-500"}`}>
                        {entry.dueDate ? formatDateOnly(entry.dueDate as unknown as string) : "—"}
                        {vencida ? " · vencida" : ""}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => iniciarEdicion(entry)}>
                          Editar
                        </Button>{" "}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleDelete(entry)}
                          disabled={deletingId === entry.id}
                        >
                          {deletingId === entry.id ? "Borrando..." : "Borrar"}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editingId ? "Editar gasto" : "Cargar un gasto"}
        </h2>

        {formError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm mb-4">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <Select
                value={form.vendorId}
                onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
              >
                <option value="">Elegir proveedor…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}{v.active ? "" : " (inactivo)"}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ExpenseStatus })}
              >
                {ESTADOS.map((estado) => (
                  <option key={estado.value} value={estado.value}>{estado.label}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
              <Select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value as "ARS" | "USD" })}
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Importe original</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.amountOriginal}
                onChange={(e) => setForm({ ...form, amountOriginal: e.target.value })}
                placeholder="Ej: 20.00"
              />
            </div>

            {form.currency === "USD" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de cambio (pesos por dólar)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.fxRate}
                  onChange={(e) => setForm({ ...form, fxRate: e.target.value })}
                  placeholder="Se propone con el dólar del mes, editable"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Impuesto (%)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.taxPercent}
                onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de vencimiento (opcional)
              </label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Cualquier aclaración sobre esta factura"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Cargar gasto"}
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
