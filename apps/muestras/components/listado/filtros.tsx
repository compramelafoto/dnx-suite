import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from "@repo/muestras";

/** Formulario GET: los filtros viven en la URL, así se pueden compartir. */
export function Filtros({ provincias, actual, cerca }: {
  provincias: string[];
  actual: { provincia?: string; tipo?: string; abiertas?: string; archivo?: string };
  /** Si la portada está ordenada "cerca de", filtrar no lo pierde. Ya vienen validados. */
  cerca?: { cerca: string; lugar: string | null } | null;
}) {
  const casilla = "flex items-center gap-2";
  return (
    <form action="/#muestras" className="flex flex-wrap items-center gap-x-7 gap-y-4 text-sm">
      {cerca ? <input type="hidden" name="cerca" value={cerca.cerca} /> : null}
      {cerca?.lugar ? <input type="hidden" name="lugar" value={cerca.lugar} /> : null}
      <label>
        <span className="sr-only">Provincia</span>
        <select name="provincia" defaultValue={actual.provincia ?? ""} className="mf-select max-w-[14rem]">
          <option value="">Todo el país</option>
          {provincias.map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>
      <label>
        <span className="sr-only">Tipo de actividad</span>
        <select name="tipo" defaultValue={actual.tipo ?? ""} className="mf-select">
          <option value="">Todos los tipos</option>
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
        </select>
      </label>
      <label className={casilla}>
        <input type="checkbox" name="abiertas" value="1" defaultChecked={actual.abiertas === "1"} className="size-3.5 accent-[var(--mf-ink)]" />
        Abiertas hoy
      </label>
      <label className={casilla}>
        <input type="checkbox" name="archivo" value="1" defaultChecked={actual.archivo === "1"} className="size-3.5 accent-[var(--mf-ink)]" />
        Incluir el archivo
      </label>
      <button className="font-medium underline underline-offset-[6px] hover:decoration-2">Filtrar</button>
    </form>
  );
}
