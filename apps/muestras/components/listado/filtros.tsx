import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from "@repo/muestras";

/** Formulario GET: los filtros viven en la URL, así se pueden compartir. */
export function Filtros({ provincias, actual }: { provincias: string[]; actual: { provincia?: string; tipo?: string; abiertas?: string; archivo?: string } }) {
  const c = "rounded-md border border-[var(--mf-line)] bg-white px-2 py-1";
  return (
    <form className="flex flex-wrap items-end gap-3 text-sm">
      <label>Provincia<br />
        <select name="provincia" defaultValue={actual.provincia ?? ""} className={c}>
          <option value="">Todo el país</option>
          {provincias.map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>
      <label>Tipo<br />
        <select name="tipo" defaultValue={actual.tipo ?? ""} className={c}>
          <option value="">Todas</option>
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1"><input type="checkbox" name="abiertas" value="1" defaultChecked={actual.abiertas === "1"} /> Abiertas hoy</label>
      <label className="flex items-center gap-1"><input type="checkbox" name="archivo" value="1" defaultChecked={actual.archivo === "1"} /> Incluir el archivo</label>
      <button className="rounded-md bg-[var(--mf-ink)] px-3 py-1 text-white">Filtrar</button>
    </form>
  );
}
