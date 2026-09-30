import { AVANZO_CON_PENDIENTES, type PasoVista } from "@/lib/circuitos/ficha-vista";
import { fechaHoraBA } from "@/lib/ficha/formato";

/** Qué pasó en el recorrido, lo último primero. Las fechas van en hora de Buenos Aires. */
export function Historial({ pasos }: { pasos: PasoVista[] }) {
  return (
    <section aria-labelledby="historial-titulo" className="fo-card space-y-3">
      <h2 id="historial-titulo" className="text-base font-semibold text-[var(--fo-text)]">
        Historial
      </h2>
      {pasos.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Todavía no hay movimientos.</p> : null}
      <ol className="space-y-3">
        {pasos.map((p) => (
          <li key={p.id} className="border-l-2 border-[var(--fo-border)] pl-3 text-sm">
            <p className="text-xs text-[var(--fo-muted)]">
              {fechaHoraBA(p.fecha)} · {p.quien}
              {p.evento ? ` · ${p.evento}` : ""}
            </p>
            <p className="text-[var(--fo-text)]">
              {p.clase === "vencimiento"
                ? `Vencimiento de ${p.a ?? "la etapa"}`
                : p.clase === "inicio"
                  ? `Entró en ${p.a ?? "el circuito"}`
                  : `${p.de ?? "—"} → ${p.a ?? "—"}`}
              {p.forzada ? <span className="ml-1 text-xs text-[var(--fo-danger)]">({AVANZO_CON_PENDIENTES})</span> : null}
            </p>
            {p.nota ? <p className="whitespace-pre-line text-[var(--fo-muted)]">{p.nota}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
