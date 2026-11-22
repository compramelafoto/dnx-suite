import Link from "next/link";
import { ACTIVITY_TYPE_LABELS } from "@repo/muestras";
import type { MarcaId } from "@/lib/marca";
import { tiposDeFiltro, type ChipDisciplina } from "@/lib/portada/disciplinas";

/** Formulario GET: los filtros viven en la URL, así se pueden compartir. */
export function Filtros({ marca, paises, provincias, actual, cerca, disciplina }: {
  /** En arte el tipo «Salida fotográfica» no se ofrece. */
  marca: MarcaId;
  /** El filtro de país sólo aparece si hay muestras de más de uno. */
  paises: string[];
  provincias: string[];
  actual: { pais?: string; provincia?: string; tipo?: string; abiertas?: string; archivo?: string };
  /** Si la portada está ordenada "cerca de", filtrar no lo pierde. Ya vienen validados. */
  cerca?: { cerca: string; lugar: string | null } | null;
  /** Sólo en arte: la disciplina elegida en los chips, ya validada. Filtrar no la pierde. */
  disciplina?: string | null;
}) {
  const casilla = "flex items-center gap-2";
  return (
    <form action="/#muestras" className="flex flex-wrap items-center gap-x-7 gap-y-4 text-sm">
      {cerca ? <input type="hidden" name="cerca" value={cerca.cerca} /> : null}
      {cerca?.lugar ? <input type="hidden" name="lugar" value={cerca.lugar} /> : null}
      {disciplina ? <input type="hidden" name="disciplina" value={disciplina} /> : null}
      {paises.length > 1 ? (
        <label>
          <span className="sr-only">País</span>
          <select name="pais" defaultValue={actual.pais ?? ""} className="mf-select max-w-[14rem]">
            <option value="">Todos los países</option>
            {paises.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
      ) : null}
      <label>
        <span className="sr-only">Provincia</span>
        <select name="provincia" defaultValue={actual.provincia ?? ""} className="mf-select max-w-[14rem]">
          <option value="">{paises.length > 1 ? "Todas las provincias" : "Todo el país"}</option>
          {provincias.map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>
      <label>
        <span className="sr-only">Tipo de actividad</span>
        <select name="tipo" defaultValue={actual.tipo ?? ""} className="mf-select">
          <option value="">Todos los tipos</option>
          {tiposDeFiltro(marca).map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
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

/** Sólo en Muestras de Arte: un enlace por disciplina, con «Todas» al principio. */
export function ChipsDisciplina({ chips }: { chips: ChipDisciplina[] }) {
  return (
    <nav aria-label="Disciplinas">
      <ul className="flex flex-wrap gap-2 text-sm">
        {chips.map((c) => (
          <li key={c.etiqueta}>
            <Link
              href={c.href}
              aria-current={c.activo ? "page" : undefined}
              className={`inline-flex h-9 items-center rounded-full border px-4 transition-colors ${c.activo ? "border-[var(--mf-ink)] bg-[var(--mf-ink)] text-white" : "border-[var(--mf-line)] hover:border-[var(--mf-ink)]"}`}
            >
              {c.etiqueta}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
