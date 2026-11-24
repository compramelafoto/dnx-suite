"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ETIQUETA_ESTADO, ESTADOS_FILTRO, FILTROS_POR_OMISION, hrefBandeja, type FiltrosBandeja } from "@/lib/bandeja/filtros";

export type OpcionPersona = { userId: number; nombre: string; abiertos: number };
export type OpcionCampana = { valor: string; nombre: string; chats: number };

const CANALES = [
  { valor: "todos", nombre: "Todos los canales" },
  { valor: "WHATSAPP", nombre: "WhatsApp" },
  { valor: "INSTAGRAM", nombre: "Instagram" },
] as const;

/**
 * Filtros de la Bandeja en ejes separados (quién atiende, estado, canal y campaña) y el buscador.
 * Cada cambio va a la URL (`base` es la lista o el chat abierto, que queda abierto). Los filtros
 * activos se ven como chips que se quitan con ×.
 */
export function FiltrosBandeja({
  filtros,
  base,
  personas,
  yo,
  campanas = [],
}: {
  filtros: FiltrosBandeja;
  base: string;
  personas: OpcionPersona[];
  yo: number;
  campanas?: OpcionCampana[];
}) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState(filtros.q);
  const ir = (cambio: Partial<FiltrosBandeja>) => router.push(hrefBandeja({ ...filtros, ...cambio }, base));

  // La propia persona va primera, con «(vos)».
  const ordenadas = [...personas].sort((a, b) => (a.userId === yo ? -1 : b.userId === yo ? 1 : 0));
  const nombreDe = (v: FiltrosBandeja["quien"]) =>
    v === "bot" ? "Bot" : v === "sin-asignar" ? "Sin asignar" : v === "todos" ? "" : (personas.find((p) => p.userId === v)?.nombre ?? "Otra persona");

  const chips: { clave: string; texto: string; quitar: Partial<FiltrosBandeja> }[] = [];
  if (filtros.quien !== "todos") chips.push({ clave: "quien", texto: nombreDe(filtros.quien), quitar: { quien: "todos" } });
  if (filtros.estado !== "abiertos") chips.push({ clave: "estado", texto: ETIQUETA_ESTADO[filtros.estado], quitar: { estado: "abiertos" } });
  if (filtros.canal !== "todos") chips.push({ clave: "canal", texto: filtros.canal === "INSTAGRAM" ? "Instagram" : "WhatsApp", quitar: { canal: "todos" } });
  if (filtros.campana !== "todas")
    chips.push({ clave: "campana", texto: campanas.find((c) => c.valor === filtros.campana)?.nombre ?? "Campaña", quitar: { campana: "todas" } });
  if (filtros.q) chips.push({ clave: "q", texto: `«${filtros.q}»`, quitar: { q: "" } });

  return (
    <div className="space-y-2">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          ir({ q: q.trim().slice(0, 80) });
        }}
      >
        <label htmlFor={`${id}-q`} className="sr-only">
          Buscar
        </label>
        <input
          id={`${id}-q`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={80}
          placeholder="Buscar nombre, número o palabra…"
          className="fo-input"
          autoComplete="off"
        />
      </form>
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0">
          <span className="sr-only">Quién atiende</span>
          <select className="fo-input text-sm" value={String(filtros.quien)} onChange={(e) => ir({ quien: e.target.value === "todos" || e.target.value === "bot" || e.target.value === "sin-asignar" ? e.target.value : Number(e.target.value) })}>
            <option value="todos">Atiende: todos</option>
            <option value="sin-asignar">Sin asignar</option>
            <option value="bot">Bot</option>
            {ordenadas.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.nombre}
                {p.userId === yo ? " (vos)" : ""}
                {p.abiertos > 0 ? ` · ${p.abiertos}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">Estado</span>
          <select className="fo-input text-sm" value={filtros.estado} onChange={(e) => ir({ estado: e.target.value as FiltrosBandeja["estado"] })}>
            {ESTADOS_FILTRO.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO[e]}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">Canal</span>
          <select className="fo-input text-sm" value={filtros.canal} onChange={(e) => ir({ canal: e.target.value as FiltrosBandeja["canal"] })}>
            {CANALES.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        {campanas.length > 0 ? (
          <label className="min-w-0">
            <span className="sr-only">Campaña</span>
            <select className="fo-input text-sm" value={filtros.campana} onChange={(e) => ir({ campana: e.target.value })}>
              <option value="todas">Todas las campañas</option>
              {campanas.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.nombre} · {c.chats}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.clave}
              type="button"
              onClick={() => {
                if (c.clave === "q") setQ("");
                ir(c.quitar);
              }}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--fo-accent-muted)] bg-[var(--fo-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--fo-accent-hover)]"
              aria-label={`Quitar filtro ${c.texto}`}
            >
              <span className="truncate">{c.texto}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            className="text-xs text-[var(--fo-muted)] underline"
            onClick={() => {
              setQ("");
              router.push(hrefBandeja(FILTROS_POR_OMISION, base));
            }}
          >
            Limpiar filtros
          </button>
        </div>
      ) : null}
    </div>
  );
}
