"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

function siguienteDia(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function NuevoSorteoPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    salesFrom: "",
    salesTo: "",
    minSales: "1",
    drawsAt: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    // "Hasta" es un día completo: las ventas cuentan hasta el final de ese día.
    const hasta = form.salesTo ? siguienteDia(form.salesTo) : "";
    const res = await fetch("/api/admin/sorteos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, salesTo: hasta, entriesCloseAt: hasta }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(d.error || "No se pudo crear el sorteo.");
    router.push(`/admin/marketing/sorteos/${d.id}`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/marketing/sorteos" className="text-sm text-gray-500 hover:underline">
          ← Sorteos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Nuevo sorteo manual</h1>
        <p className="text-sm text-gray-500">
          Participan los fotógrafos que vendieron en el período que elijas. Se crea en borrador: después cargás los
          premios y lo anunciás.
        </p>
      </div>
      <form onSubmit={guardar} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Nombre</span>
          <input className={input} value={form.title} onChange={set("title")} placeholder="Sorteo de fin de año" required />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Descripción (opcional)</span>
          <textarea className={input} rows={3} value={form.description} onChange={set("description")} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Ventas desde</span>
            <input type="date" className={input} value={form.salesFrom} onChange={set("salesFrom")} required />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Ventas hasta (inclusive)</span>
            <input type="date" className={input} value={form.salesTo} onChange={set("salesTo")} required />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Ventas mínimas para participar</span>
          <input type="number" min={1} className={input} value={form.minSales} onChange={set("minSales")} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Día y hora del sorteo (hora argentina)</span>
          <input type="datetime-local" className={input} value={form.drawsAt} onChange={set("drawsAt")} required />
          <span className="block text-xs text-gray-500">
            La lista de participantes se cierra al terminar el último día de ventas. El sorteo tiene que ser al menos 24
            horas después.
          </span>
        </label>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Creando…" : "Crear borrador"}
        </Button>
      </form>
    </div>
  );
}
