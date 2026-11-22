"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

type Premio = {
  title: string;
  description?: string | null;
  sponsorName?: string | null;
  deliveryInstructions?: string | null;
  estimatedValueArs?: number | null;
};
type Settings = {
  monthlyEnabled: boolean;
  autoAnnounce: boolean;
  drawDay: number;
  drawHour: number;
  minSales: number;
  monthlyPrizes: Premio[];
  excludedUserIds: number[];
};

const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

export default function SorteoMensualPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [excluidos, setExcluidos] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/sorteos/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setS(d.settings);
          setExcluidos((d.settings.excludedUserIds || []).join(", "));
        } else setMsg({ ok: false, text: d.error || "No se pudo cargar la configuración." });
      });
  }, []);

  if (!s) return <p className="text-gray-500">{msg?.text ?? "Cargando…"}</p>;

  const premio = (i: number, k: keyof Premio, v: string) =>
    setS({
      ...s,
      monthlyPrizes: s.monthlyPrizes.map((p, j) =>
        j === i ? { ...p, [k]: k === "estimatedValueArs" ? (v ? Number(v) : null) : v } : p,
      ),
    });

  async function guardar() {
    if (!s) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/sorteos/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...s,
        excludedUserIds: excluidos.split(/[\s,;]+/).filter(Boolean).map(Number),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "No se pudo guardar." });
    setS(d.settings);
    setExcluidos((d.settings.excludedUserIds || []).join(", "));
    setMsg({ ok: true, text: "Guardado." });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/marketing/sorteos" className="text-sm text-gray-500 hover:underline">
          ← Sorteos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Sorteo mensual automático</h1>
        <p className="text-sm text-gray-500">
          Encendido, el sistema crea solo el sorteo de cada mes con estos premios. Participan los fotógrafos que vendan
          fotos ese mes. La lista se cierra el día 1 del mes siguiente a las 0 h y el sorteo se hace solo el día que
          elijas. Los ganadores reciben un correo.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 text-sm">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={s.monthlyEnabled} onChange={(e) => setS({ ...s, monthlyEnabled: e.target.checked })} />
          <span className="font-medium text-gray-900">Crear el sorteo de cada mes automáticamente</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={s.autoAnnounce} onChange={(e) => setS({ ...s, autoAnnounce: e.target.checked })} />
          <span className="text-gray-700">Anunciarlo solo apenas se crea (apagado, queda en borrador para revisarlo)</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="font-medium text-gray-700">Día del sorteo (del mes siguiente)</span>
            <input type="number" min={2} max={28} className={input} value={s.drawDay} onChange={(e) => setS({ ...s, drawDay: Number(e.target.value) })} />
          </label>
          <label className="block space-y-1">
            <span className="font-medium text-gray-700">Hora (hora argentina)</span>
            <input type="number" min={0} max={23} className={input} value={s.drawHour} onChange={(e) => setS({ ...s, drawHour: Number(e.target.value) })} />
          </label>
          <label className="block space-y-1">
            <span className="font-medium text-gray-700">Ventas mínimas en el mes</span>
            <input type="number" min={1} className={input} value={s.minSales} onChange={(e) => setS({ ...s, minSales: Number(e.target.value) })} />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="font-medium text-gray-700">Cuentas que nunca participan (números de cuenta, separados por coma)</span>
          <input className={input} value={excluidos} onChange={(e) => setExcluidos(e.target.value)} placeholder="Ej.: 1, 25" />
          <span className="block text-xs text-gray-500">
            Para dejar afuera las cuentas propias de DNX. Vale para todos los sorteos, también los manuales. Las cuentas de
            demo, bloqueadas y de administradores ya quedan afuera solas.
          </span>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Premios de cada mes</h2>
        {s.monthlyPrizes.length === 0 && (
          <p className="text-sm text-gray-500">Sin premios el sorteo se crea igual, pero queda en borrador hasta que cargues alguno.</p>
        )}
        {s.monthlyPrizes.map((p, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Premio {i + 1}</span>
              <button type="button" className="text-red-600 hover:underline" onClick={() => setS({ ...s, monthlyPrizes: s.monthlyPrizes.filter((_, j) => j !== i) })}>
                Quitar
              </button>
            </div>
            <input className={input} placeholder="Premio" value={p.title} onChange={(e) => premio(i, "title", e.target.value)} />
            <input className={input} placeholder="Quién lo da (opcional)" value={p.sponsorName ?? ""} onChange={(e) => premio(i, "sponsorName", e.target.value)} />
            <textarea className={input} rows={2} placeholder="Descripción (opcional)" value={p.description ?? ""} onChange={(e) => premio(i, "description", e.target.value)} />
            <input className={input} placeholder="Cómo se entrega (va en el correo al ganador)" value={p.deliveryInstructions ?? ""} onChange={(e) => premio(i, "deliveryInstructions", e.target.value)} />
            <input className={input} type="number" min={0} placeholder="Valor estimado en pesos (opcional)" value={p.estimatedValueArs ?? ""} onChange={(e) => premio(i, "estimatedValueArs", e.target.value)} />
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setS({ ...s, monthlyPrizes: [...s.monthlyPrizes, { title: "" }] })}>
          Agregar premio
        </Button>
      </section>

      {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <Button onClick={guardar} disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </Button>
      <p className="text-xs text-gray-500">
        Los cambios valen para los sorteos que se creen desde ahora. El sorteo del mes que ya existe se edita desde su
        página (mientras esté en borrador).
      </p>
    </div>
  );
}
