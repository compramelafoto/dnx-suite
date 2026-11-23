"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Button from "@/components/ui/Button";
import { dsInputClassName, dsTextareaClassName } from "@/components/ui/form-control-classes";

const input = `${dsInputClassName} !py-2.5 !text-sm`;
const area = `${dsTextareaClassName} !py-2.5 !text-sm`;

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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/admin/marketing/sorteos" className="inline-flex items-center gap-1 text-sm text-[#6b7280] hover:text-[#111827]">
          <ArrowLeft className="h-4 w-4" /> Sorteos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#111827] sm:text-3xl">Nuevo sorteo manual</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Participan los fotógrafos que vendieron en el período que elijas. Se crea en borrador: después cargás los
          premios con sus fotos y logos, y lo anunciás.
        </p>
      </div>
      <form onSubmit={guardar} className="space-y-5 rounded-3xl border border-[#111827]/10 bg-white p-5 shadow-sm sm:p-6">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[#1a1a1a]">Nombre</span>
          <input className={input} value={form.title} onChange={set("title")} placeholder="Sorteo de fin de año" required />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[#1a1a1a]">Descripción (opcional)</span>
          <textarea className={area} rows={3} value={form.description} onChange={set("description")} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#1a1a1a]">Ventas desde</span>
            <input type="date" className={input} value={form.salesFrom} onChange={set("salesFrom")} required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#1a1a1a]">Ventas hasta (inclusive)</span>
            <input type="date" className={input} value={form.salesTo} onChange={set("salesTo")} required />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[#1a1a1a]">Ventas mínimas para participar</span>
          <input type="number" min={1} className={input} value={form.minSales} onChange={set("minSales")} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[#1a1a1a]">Día y hora del sorteo (hora argentina)</span>
          <input type="datetime-local" className={input} value={form.drawsAt} onChange={set("drawsAt")} required />
          <span className="block text-xs text-[#6b7280]">
            La lista de participantes se cierra al terminar el último día de ventas. El sorteo tiene que ser al menos 24
            horas después.
          </span>
        </label>
        {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Creando…" : "Crear borrador"}
        </Button>
      </form>
    </div>
  );
}
