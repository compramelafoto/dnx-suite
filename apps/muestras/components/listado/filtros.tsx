import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from "@repo/muestras";

/** Formulario GET: los filtros viven en la URL, así se pueden compartir. */
export function Filtros({ provincias, actual }: { provincias: string[]; actual: { provincia?: string; tipo?: string; abiertas?: string; archivo?: string } }) {
  const campo = "h-10 w-full rounded-[10px] border border-[var(--mf-line)] bg-white px-3 text-[var(--mf-ink)] sm:w-auto";
  const casilla = "flex h-10 items-center gap-2 text-[var(--mf-ink)]";
  return (
    <form action="/#mapa" className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
      <label className="w-full sm:w-auto">
        <span className="sr-only">Provincia</span>
        <select name="provincia" defaultValue={actual.provincia ?? ""} className={campo}>
          <option value="">Todo el país</option>
          {provincias.map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>
      <label className="w-full sm:w-auto">
        <span className="sr-only">Tipo de actividad</span>
        <select name="tipo" defaultValue={actual.tipo ?? ""} className={campo}>
          <option value="">Todos los tipos</option>
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
        </select>
      </label>
      <label className={casilla}>
        <input type="checkbox" name="abiertas" value="1" defaultChecked={actual.abiertas === "1"} className="size-4 accent-[var(--mf-accent)]" />
        Abiertas hoy
      </label>
      <label className={casilla}>
        <input type="checkbox" name="archivo" value="1" defaultChecked={actual.archivo === "1"} className="size-4 accent-[var(--mf-accent)]" />
        Incluir el archivo
      </label>
      <button className="h-10 rounded-[10px] border border-[var(--mf-ink)] px-4 font-medium text-[var(--mf-ink)] hover:bg-[var(--mf-surface)]">Filtrar</button>
    </form>
  );
}
