"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarConfigTurnoTipoAction } from "@/app/actions/turnos";
import { DIAS_SEMANA } from "@/lib/turnos/franjas";
import { ETIQUETA_MODALIDAD, MODALIDADES } from "@/lib/turnos/constantes";
import type { ConfigTipoEnPantalla } from "@/lib/turnos/configurar";

type FranjaPantalla = ConfigTipoEnPantalla["franjas"][number];

/** Los días en el orden en que se piensa la semana: lunes primero. */
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

export function ConfigTurno({ tipoId, inicial, enlacePublico }: { tipoId: string; inicial: ConfigTipoEnPantalla; enlacePublico: string | null }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [c, setC] = useState(inicial);
  const set = <K extends keyof ConfigTipoEnPantalla>(k: K, v: ConfigTipoEnPantalla[K]) => {
    setGuardado(false);
    setC((x) => ({ ...x, [k]: v }));
  };
  const setFranja = (i: number, f: Partial<FranjaPantalla>) => set("franjas", c.franjas.map((x, j) => (j === i ? { ...x, ...f } : x)));

  function guardar() {
    setError(null);
    iniciar(async () => {
      try {
        const r = await guardarConfigTurnoTipoAction(tipoId, { ...c, durationMinutes: c.durationMinutes ?? null });
        if (!r.ok) return setError(r.error);
        setGuardado(true);
        router.refresh();
      } catch {
        setError("No se pudo guardar. Probá de nuevo.");
      }
    });
  }

  const pideDireccion = c.modality === "ESTUDIO" || c.modality === "DIRECCION";
  return (
    <div className="space-y-4">
      <section className="fo-card space-y-4 p-5">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={c.isBookable} onChange={(e) => set("isBookable", e.target.checked)} className="h-4 w-4" />
          <span className="text-sm font-medium">Publicar: el cliente puede reservar este turno solo desde el sitio</span>
        </label>
        {inicial.isBookable && enlacePublico ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Dirección para reservar:{" "}
            <a href={enlacePublico} target="_blank" rel="noreferrer" className="break-all text-[var(--fo-accent)] hover:underline">
              {enlacePublico}
            </a>
          </p>
        ) : null}

        <label className="fo-field-stack">
          <span className="fo-label">Texto para el cliente</span>
          <textarea className="fo-input w-full" rows={4} maxLength={2000} value={c.publicDescription} onChange={(e) => set("publicDescription", e.target.value)} placeholder="Qué es este turno y qué conviene traer o preparar." />
        </label>

        <label className="fo-field-stack">
          <span className="fo-label">Foto (dirección https://, se muestra chica y en círculo)</span>
          <div className="flex items-center gap-3">
            {c.imageUrl.startsWith("https://") ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa de una dirección que escribe el dueño.
              <img src={c.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : null}
            <input className="fo-input w-full" maxLength={500} value={c.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" />
          </div>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="fo-field-stack">
            <span className="fo-label">Duración (minutos)</span>
            <input type="number" min={15} max={480} step={5} className="fo-input w-full" value={c.durationMinutes ?? ""} onChange={(e) => set("durationMinutes", e.target.value === "" ? null : Number(e.target.value))} />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Cómo se hace</span>
            <select className="fo-input w-full" value={c.modality} onChange={(e) => set("modality", e.target.value)}>
              <option value="">Elegí…</option>
              {MODALIDADES.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_MODALIDAD[m]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {c.modality ? (
          <label className="fo-field-stack">
            <span className="fo-label">
              {c.modality === "ONLINE" ? "Enlace de la videollamada (Meet, Zoom…)" : c.modality === "TELEFONO" ? "Aclaración (opcional; si no, se muestra «Te llamamos al teléfono que dejaste»)" : "Dirección"}
            </span>
            <input className="fo-input w-full" maxLength={300} value={c.address} onChange={(e) => set("address", e.target.value)} required={pideDireccion} />
          </label>
        ) : null}
      </section>

      <section className="fo-card space-y-3 p-5" aria-label="Horarios en que se ofrece">
        <div>
          <p className="text-sm font-medium">Horarios en que lo ofrecés</p>
          <p className="text-xs text-[var(--fo-muted)]">
            Se ofrecen turnos seguidos de la duración elegida dentro de cada franja, salvo lo que ya esté ocupado en tu Agenda o en tu Google Calendar.
          </p>
        </div>
        {c.franjas.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Todavía no cargaste horarios.</p> : null}
        {c.franjas.map((f, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select aria-label="Día" className="fo-input" value={f.weekday} onChange={(e) => setFranja(i, { weekday: Number(e.target.value) })}>
              {ORDEN_DIAS.map((d) => (
                <option key={d} value={d}>
                  {DIAS_SEMANA[d]}
                </option>
              ))}
            </select>
            <span className="text-sm">de</span>
            <input aria-label="Desde" type="time" className="fo-input" value={f.inicio} onChange={(e) => setFranja(i, { inicio: e.target.value })} />
            <span className="text-sm">a</span>
            <input aria-label="Hasta" type="time" className="fo-input" value={f.fin} onChange={(e) => setFranja(i, { fin: e.target.value })} />
            <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => set("franjas", c.franjas.filter((_, j) => j !== i))}>
              Quitar
            </button>
          </div>
        ))}
        <button
          type="button"
          className="fo-btn fo-btn-secondary text-xs"
          onClick={() => {
            const ultima = c.franjas[c.franjas.length - 1];
            const siguiente = ultima ? ORDEN_DIAS[(ORDEN_DIAS.indexOf(ultima.weekday) + 1) % 7] : 1;
            set("franjas", [...c.franjas, { weekday: siguiente, inicio: ultima?.inicio ?? "10:00", fin: ultima?.fin ?? "13:00" }]);
          }}
        >
          Agregar horario
        </button>
      </section>

      {error ? (
        <p className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button type="button" className="fo-btn fo-btn-primary" disabled={pendiente} onClick={guardar}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {guardado ? <span className="text-sm text-[var(--fo-muted)]">Guardado.</span> : null}
      </div>
    </div>
  );
}
