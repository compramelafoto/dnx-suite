"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Gift, Pencil, Plus, Trash2, UserX } from "lucide-react";
import Button from "@/components/ui/Button";
import AppModal from "@/components/ui/AppModal";
import { dsInputClassName } from "@/components/ui/form-control-classes";
import ImageUpload from "@/components/raffles/ImageUpload";
import PrizeForm, { emptyPrize, type PrizeDraft } from "@/components/raffles/PrizeForm";
import SponsorsEditor, { type SponsorDraft } from "@/components/raffles/SponsorsEditor";

type Settings = {
  monthlyEnabled: boolean;
  autoAnnounce: boolean;
  drawDay: number;
  drawHour: number;
  minSales: number;
  monthlyPrizes: PrizeDraft[];
  excludedUserIds: number[];
  monthlyCoverImageUrl: string | null;
  monthlySponsors: SponsorDraft[];
};

const campo = `${dsInputClassName} !py-2.5 !text-sm`;

function Interruptor({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-semibold text-[#111827]">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-[#6b7280]">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-[#d1d5db] transition peer-checked:bg-[#c27b3d] peer-focus-visible:ring-2 peer-focus-visible:ring-[#c27b3d]/40" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function Seccion({ title, icon, children, actions }: { title: string; icon?: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#111827]/10 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#111827]">
          {icon}
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default function SorteoMensualPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [excluidos, setExcluidos] = useState("");
  const [saving, setSaving] = useState(false);
  const [cambios, setCambios] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editando, setEditando] = useState<{ i: number | null; p: PrizeDraft } | null>(null);

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

  if (!s) return <p className="p-6 text-[#6b7280]">{msg?.text ?? "Cargando…"}</p>;

  const cambiar = (patch: Partial<Settings>) => {
    setS({ ...s, ...patch });
    setCambios(true);
    setMsg(null);
  };

  async function guardar() {
    if (!s) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/sorteos/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...s,
        monthlySponsors: s.monthlySponsors.filter((x) => x.logoUrl),
        excludedUserIds: excluidos.split(/[\s,;]+/).filter(Boolean).map(Number),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "No se pudo guardar." });
    setS(d.settings);
    setExcluidos((d.settings.excludedUserIds || []).join(", "));
    setCambios(false);
    setMsg({ ok: true, text: "Guardado. Vale para los sorteos que se creen desde ahora." });
  }

  const sinPremios = s.monthlyPrizes.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <div>
        <Link href="/admin/marketing/sorteos" className="inline-flex items-center gap-1 text-sm text-[#6b7280] hover:text-[#111827]">
          <ArrowLeft className="h-4 w-4" /> Sorteos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#111827] sm:text-3xl">Sorteo mensual automático</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Cada mes el sistema arma solo el sorteo con estos premios. Participan los fotógrafos que vendan fotos ese mes, sin
          anotarse. Los ganadores reciben un correo.
        </p>
      </div>

      <Seccion title="Funcionamiento" icon={<CalendarClock className="h-5 w-5 text-[#c27b3d]" />}>
        <div className="space-y-5">
          <Interruptor
            checked={s.monthlyEnabled}
            onChange={(v) => cambiar({ monthlyEnabled: v })}
            label="Crear el sorteo de cada mes"
            hint="Apagado, no se crea ningún sorteo nuevo."
          />
          {s.monthlyEnabled && sinPremios && (
            <p className="rounded-2xl bg-[#fffbeb] p-3 text-sm text-[#92400e]">
              Sin premios el sorteo del mes se crea, pero queda en borrador hasta que cargues alguno.
            </p>
          )}
          <Interruptor
            checked={s.autoAnnounce}
            onChange={(v) => cambiar({ autoAnnounce: v })}
            label="Anunciarlo solo"
            hint="Apagado, queda en borrador para que lo revises y lo anuncies vos."
          />
          <div className="grid gap-4 border-t border-[#111827]/5 pt-5 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[#1a1a1a]">Día del sorteo</span>
              <input type="number" min={2} max={28} className={campo} value={s.drawDay} onChange={(e) => cambiar({ drawDay: Number(e.target.value) })} />
              <span className="block text-xs text-[#6b7280]">Del mes siguiente (2 a 28).</span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[#1a1a1a]">Hora</span>
              <input type="number" min={0} max={23} className={campo} value={s.drawHour} onChange={(e) => cambiar({ drawHour: Number(e.target.value) })} />
              <span className="block text-xs text-[#6b7280]">Hora argentina.</span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[#1a1a1a]">Ventas mínimas</span>
              <input type="number" min={1} className={campo} value={s.minSales} onChange={(e) => cambiar({ minSales: Number(e.target.value) })} />
              <span className="block text-xs text-[#6b7280]">En el mes, para entrar.</span>
            </label>
          </div>
          <div className="rounded-2xl bg-[#fafafa] p-4 text-sm text-[#4b5563]">
            <p className="font-semibold text-[#111827]">Así queda, por ejemplo, el de diciembre:</p>
            <ol className="mt-2 grid gap-2 sm:grid-cols-3">
              <li>
                <span className="font-semibold text-[#c27b3d]">1 al 31 de diciembre</span>
                <br />
                cuentan las ventas
              </li>
              <li>
                <span className="font-semibold text-[#c27b3d]">1 de enero, 0 h</span>
                <br />
                se cierra la lista
              </li>
              <li>
                <span className="font-semibold text-[#c27b3d]">
                  {s.drawDay} de enero, {s.drawHour} h
                </span>
                <br />
                se sortea y se avisa
              </li>
            </ol>
          </div>
        </div>
      </Seccion>

      <Seccion
        title={`Premios de cada mes (${s.monthlyPrizes.length})`}
        icon={<Gift className="h-5 w-5 text-[#c27b3d]" />}
        actions={
          <Button size="sm" onClick={() => setEditando({ i: null, p: { ...emptyPrize } })}>
            <Plus className="h-4 w-4" /> Agregar premio
          </Button>
        }
      >
        {sinPremios ? (
          <button
            type="button"
            onClick={() => setEditando({ i: null, p: { ...emptyPrize } })}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#111827]/15 py-12 text-[#6b7280] hover:border-[#c27b3d]/60"
          >
            <Gift className="h-8 w-8 text-[#c27b3d]" />
            <span className="font-semibold text-[#374151]">Todavía no hay premios</span>
            <span className="text-sm">Tocá para cargar el primero, con su foto y el logo de quien lo da</span>
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {s.monthlyPrizes.map((p, i) => (
              <div key={i} className="flex gap-3 rounded-2xl border border-[#111827]/10 p-3">
                <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#fdf3ea] to-[#eec9a4]">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- fotos subidas a R2
                    <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Gift className="absolute inset-0 m-auto h-7 w-7 text-[#c27b3d]/60" />
                  )}
                  <span className="absolute left-1 top-1 rounded-full bg-white/95 px-1.5 text-[11px] font-bold text-[#c27b3d]">{i + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-semibold text-[#111827]">{p.title}</p>
                    <div className="flex shrink-0">
                      <button type="button" onClick={() => setEditando({ i, p: { ...p } })} className="rounded-full p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]" aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => cambiar({ monthlyPrizes: s.monthlyPrizes.filter((_, j) => j !== i) })}
                        className="rounded-full p-1.5 text-[#6b7280] hover:bg-red-50 hover:text-[#b91c1c]"
                        aria-label="Quitar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {(p.sponsorLogoUrl || p.sponsorName) && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#6b7280]">
                      {p.sponsorLogoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- logos subidos a R2
                        <img src={p.sponsorLogoUrl} alt="" className="h-5 w-auto max-w-[5rem] object-contain" />
                      )}
                      {p.sponsorName}
                    </p>
                  )}
                  {p.description && <p className="mt-1 line-clamp-2 text-xs text-[#6b7280]">{p.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion title="Portada y sponsors">
        <p className="-mt-2 mb-4 text-sm text-[#6b7280]">
          Se copian a cada sorteo del mes. Los logos de quienes donan un premio ya aparecen solos.
        </p>
        <div className="space-y-6">
          <ImageUpload
            kind="portada"
            label="Portada"
            hint="Horizontal, ideal 1500 × 500."
            value={s.monthlyCoverImageUrl}
            onChange={(url) => cambiar({ monthlyCoverImageUrl: url })}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-[#1a1a1a]">Sponsors</p>
            <SponsorsEditor value={s.monthlySponsors} onChange={(v) => cambiar({ monthlySponsors: v })} />
          </div>
        </div>
      </Seccion>

      <Seccion title="Cuentas que nunca participan" icon={<UserX className="h-5 w-5 text-[#c27b3d]" />}>
        <input
          className={campo}
          value={excluidos}
          onChange={(e) => {
            setExcluidos(e.target.value);
            setCambios(true);
          }}
          placeholder="Números de cuenta separados por coma. Ej.: 1, 25"
        />
        <p className="mt-2 text-xs text-[#6b7280]">
          Para dejar afuera las cuentas propias de DNX. Vale para todos los sorteos, también los manuales. Las cuentas de demo,
          bloqueadas y de administradores ya quedan afuera solas.
        </p>
      </Seccion>

      {/* Barra de guardar, fija abajo cuando hay cambios */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#111827]/10 bg-white/95 backdrop-blur transition-transform ${
          cambios || msg ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <p className={`text-sm ${msg ? (msg.ok ? "text-[#047857]" : "text-[#b91c1c]") : "text-[#6b7280]"}`}>
            {msg?.text ?? "Tenés cambios sin guardar."}
          </p>
          {cambios && (
            <Button onClick={guardar} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          )}
        </div>
      </div>

      <AppModal open={editando !== null} onClose={() => setEditando(null)} size="lg" title={editando?.i === null ? "Nuevo premio" : "Editar premio"}>
        {editando && (
          <form
            className="space-y-5 overflow-y-auto p-5 sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              const lista = [...s.monthlyPrizes];
              if (editando.i === null) lista.push(editando.p);
              else lista[editando.i] = editando.p;
              cambiar({ monthlyPrizes: lista });
              setEditando(null);
            }}
          >
            <PrizeForm value={editando.p} onChange={(p) => setEditando({ ...editando, p })} />
            <div className="flex justify-end gap-2 border-t border-[#111827]/5 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!editando.p.title.trim()}>
                Listo
              </Button>
            </div>
          </form>
        )}
      </AppModal>
    </div>
  );
}
