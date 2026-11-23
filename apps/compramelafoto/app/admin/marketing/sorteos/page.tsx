"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight, Gift, Plus, Repeat, Users } from "lucide-react";
import StatusBadge from "@/components/raffles/StatusBadge";
import type { RaffleStatus } from "@/lib/raffles/constants";
import { formatArgentina } from "@/lib/raffles/fechas";

type Row = {
  id: string;
  title: string;
  kind: string;
  status: RaffleStatus;
  salesFrom: string;
  salesTo: string;
  minSales: number;
  drawsAt: string;
  entrantsCount: number | null;
  coverImageUrl: string | null;
  prizes: { imageUrl: string | null; title: string }[];
  _count: { prizes: number; awards: number };
};
type Ajustes = { monthlyEnabled: boolean; monthlyPrizes: unknown[]; drawDay: number; drawHour: number };

const ACTIVOS: RaffleStatus[] = ["BORRADOR", "ANUNCIADO", "PADRON_SELLADO", "SORTEADO"];

function Fila({ r }: { r: Row }) {
  const portada = r.coverImageUrl || r.prizes.find((p) => p.imageUrl)?.imageUrl || null;
  return (
    <Link
      href={`/admin/marketing/sorteos/${r.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-[#111827]/10 bg-white p-3 shadow-sm transition hover:border-[#c27b3d]/40 hover:shadow-md sm:p-4"
    >
      <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#5b3a1f] to-[#c27b3d] sm:h-20 sm:w-28">
        {portada ? (
          // eslint-disable-next-line @next/next/no-img-element -- imágenes subidas a R2
          <img src={portada} alt="" className="h-full w-full object-cover" />
        ) : (
          <Gift className="absolute inset-0 m-auto h-7 w-7 text-white/80" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold text-[#111827]">{r.title}</p>
          <StatusBadge status={r.status} />
          {r.kind === "MENSUAL" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf6ef] px-2 py-0.5 text-[11px] font-semibold text-[#c27b3d]">
              <Repeat className="h-3 w-3" /> Automático
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6b7280]">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" /> Sorteo: {formatArgentina(new Date(r.drawsAt))}
          </span>
          <span className="inline-flex items-center gap-1">
            <Gift className="h-3.5 w-3.5" /> {r._count.prizes} {r._count.prizes === 1 ? "premio" : "premios"}
          </span>
          {r.entrantsCount !== null && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {r.entrantsCount} participantes
            </span>
          )}
          <span>
            Ventas del {formatArgentina(new Date(r.salesFrom), false)} al {formatArgentina(new Date(new Date(r.salesTo).getTime() - 1), false)}
          </span>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-[#d1d5db] transition group-hover:translate-x-0.5 group-hover:text-[#c27b3d]" />
    </Link>
  );
}

export default function AdminSorteosPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/sorteos").then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "No se pudieron cargar los sorteos.");
        setRows(d.raffles || []);
      }),
      fetch("/api/admin/sorteos/config")
        .then((r) => r.json())
        .then((d) => setAjustes(d.settings ?? null))
        .catch(() => {}),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const activos = rows.filter((r) => ACTIVOS.includes(r.status));
  const anteriores = rows.filter((r) => !ACTIVOS.includes(r.status));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] sm:text-3xl">Sorteos para fotógrafos</h1>
        <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
          Regalos para los fotógrafos que venden en CompraMeLaFoto. Participan solos, sin anotarse. Cada resultado se puede
          comprobar: la lista se cierra y se publica antes de que exista el número que decide.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/marketing/sorteos/mensual"
          className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a1d12] via-[#5b3a1f] to-[#c27b3d] p-6 text-white shadow-sm transition hover:shadow-lg"
        >
          <Repeat className="absolute -right-4 -top-4 h-28 w-28 text-white/10" />
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                ajustes?.monthlyEnabled ? "bg-emerald-400/20 text-emerald-100" : "bg-white/15 text-white/80"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${ajustes?.monthlyEnabled ? "bg-emerald-300" : "bg-white/50"}`} />
              {ajustes ? (ajustes.monthlyEnabled ? "Encendido" : "Apagado") : "…"}
            </span>
          </div>
          <p className="mt-3 text-lg font-bold">Sorteo mensual automático</p>
          <p className="mt-1 text-sm text-white/75">
            {ajustes
              ? ajustes.monthlyPrizes.length
                ? `${ajustes.monthlyPrizes.length} ${ajustes.monthlyPrizes.length === 1 ? "premio cargado" : "premios cargados"} · se sortea el ${ajustes.drawDay} de cada mes a las ${ajustes.drawHour} h`
                : "Todavía sin premios. Cargalos para encenderlo."
              : "Entre todos los que venden en el mes."}
          </p>
          <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
            Configurar <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </p>
        </Link>
        <Link
          href="/admin/marketing/sorteos/nuevo"
          className="group flex flex-col justify-between rounded-3xl border-2 border-dashed border-[#111827]/15 bg-white p-6 transition hover:border-[#c27b3d]/60"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fdf6ef] text-[#c27b3d]">
            <Plus className="h-5 w-5" />
          </span>
          <div>
            <p className="mt-3 text-lg font-bold text-[#111827]">Nuevo sorteo manual</p>
            <p className="mt-1 text-sm text-[#6b7280]">Para una fecha especial: elegís el período de ventas, el mínimo y los premios.</p>
          </div>
        </Link>
      </div>

      {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#f3f4f6]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-[#111827]/10 bg-white p-12 text-center">
          <Gift className="mx-auto h-10 w-10 text-[#c27b3d]" />
          <p className="mt-3 font-semibold text-[#111827]">Todavía no hay sorteos</p>
          <p className="mt-1 text-sm text-[#6b7280]">Encendé el sorteo mensual o armá uno manual.</p>
        </div>
      ) : (
        <>
          {activos.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#6b7280]">En curso</h2>
              {activos.map((r) => (
                <Fila key={r.id} r={r} />
              ))}
            </section>
          )}
          {anteriores.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#6b7280]">Anteriores</h2>
              {anteriores.map((r) => (
                <Fila key={r.id} r={r} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
