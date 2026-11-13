import {
  CATEGORIAS,
  CATEGORIA_ETIQUETA,
  DEFINICIONES,
  DESTINO_ETIQUETA,
  ORIGEN_ETIQUETA,
  RECUPERATORIO_ETIQUETA,
  REDONDEO_ETIQUETA,
  modeloDe,
  reglasDeArriba,
  resolverReglas,
  type CadenaDeReglas,
  type ClaveRegla,
  type Nivel,
  type Reglas,
} from "@/lib/registro-docente/reglas";
import { guardarReglaAction } from "../actions";

const NIVEL_DE_ARRIBA: Record<Exclude<Nivel, "modelo">, string> = {
  escuela: "la regla del modelo",
  curso: "la regla de la escuela",
  estudiante: "la regla del curso",
};

const fechaCorta = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "—");

export function mostrarValor(clave: ClaveRegla, r: Reglas): string {
  const v = r[clave];
  switch (clave) {
    case "decimales":
    case "justificadaCuenta":
    case "ppi":
      return v ? "Sí" : "No";
    case "limiteFaltas":
      return v === null ? "Sin límite" : String(v).replace(".", ",");
    case "redondeo":
      return REDONDEO_ETIQUETA[r.redondeo];
    case "recuperatorio":
      return RECUPERATORIO_ETIQUETA[r.recuperatorio];
    case "destino":
      return DESTINO_ETIQUETA[r.destino];
    case "pesos":
      return CATEGORIAS.filter((c) => r.pesos[c] > 0).map((c) => `${CATEGORIA_ETIQUETA[c]} ${r.pesos[c]} %`).join(" · ") || "—";
    case "periodos":
      return r.periodos.map((p) => `${p.nombre}${p.desde || p.hasta ? ` (${fechaCorta(p.desde)} a ${fechaCorta(p.hasta)})` : ""}`).join(" · ");
    default:
      return String(v).replace(".", ",");
  }
}

/**
 * Cada regla con su valor, de dónde viene y un formulario para cambiarla en este nivel, o volver a
 * la de arriba. Server component: cada regla es un formulario aparte.
 */
export function ReglasEditor({
  nivel,
  id,
  cadena,
  volver,
  puedeEditar,
}: {
  nivel: Exclude<Nivel, "modelo">;
  id: string;
  cadena: CadenaDeReglas;
  volver: string;
  puedeEditar: boolean;
}) {
  const r = resolverReglas(cadena);
  const arriba = reglasDeArriba(cadena, nivel);
  const defs = DEFINICIONES.filter((d) => d.niveles.includes(nivel));
  return (
    <ul className="space-y-3">
      {defs.map((def) => {
        const propia = r.origen[def.clave] === nivel;
        return (
          <li key={def.clave} className="fo-card space-y-3 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{def.etiqueta}</p>
                {def.ayuda ? <p className="text-xs text-[var(--fo-muted)]">{def.ayuda}</p> : null}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${propia ? "bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]" : "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]"}`}
              >
                {r.origen[def.clave] === "modelo" ? `del modelo «${modeloDe(cadena.modelo).nombre}»` : ORIGEN_ETIQUETA[r.origen[def.clave]]}
              </span>
            </div>
            <p className="text-sm">{mostrarValor(def.clave, r.valores)}</p>
            {puedeEditar ? (
              <details>
                <summary className="cursor-pointer text-sm text-[var(--fo-accent)]">Cambiar{propia ? "" : " sólo acá"}</summary>
                <form action={guardarReglaAction} className="mt-3 space-y-3">
                  <input type="hidden" name="nivel" value={nivel} />
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="clave" value={def.clave} />
                  <input type="hidden" name="volver" value={volver} />
                  <CampoRegla clave={def.clave} r={r.valores} />
                  <div className="flex flex-wrap gap-2">
                    <button className="fo-btn fo-btn-primary text-sm">Guardar</button>
                  </div>
                </form>
              </details>
            ) : null}
            {puedeEditar && propia ? (
              <form action={guardarReglaAction} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name="nivel" value={nivel} />
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="clave" value={def.clave} />
                <input type="hidden" name="volver" value={volver} />
                <input type="hidden" name="quitar" value="1" />
                <button className="fo-btn fo-btn-secondary text-sm">Volver a {NIVEL_DE_ARRIBA[nivel]}</button>
                <span className="text-[var(--fo-muted)]">({mostrarValor(def.clave, arriba.valores)})</span>
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function SiNo({ valor }: { valor: boolean }) {
  return (
    <select name="valor" defaultValue={valor ? "si" : "no"} className="fo-input">
      <option value="si">Sí</option>
      <option value="no">No</option>
    </select>
  );
}

function Opciones({ valor, opciones }: { valor: string; opciones: Record<string, string> }) {
  return (
    <select name="valor" defaultValue={valor} className="fo-input w-full sm:w-auto">
      {Object.entries(opciones).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

function CampoRegla({ clave, r }: { clave: ClaveRegla; r: Reglas }) {
  switch (clave) {
    case "decimales":
    case "justificadaCuenta":
    case "ppi":
      return <SiNo valor={r[clave]} />;
    case "redondeo":
      return <Opciones valor={r.redondeo} opciones={REDONDEO_ETIQUETA} />;
    case "recuperatorio":
      return <Opciones valor={r.recuperatorio} opciones={RECUPERATORIO_ETIQUETA} />;
    case "destino":
      return <Opciones valor={r.destino} opciones={DESTINO_ETIQUETA} />;
    case "limiteFaltas":
      return (
        <input name="valor" inputMode="decimal" defaultValue={r.limiteFaltas === null ? "" : String(r.limiteFaltas)} placeholder="Sin límite" className="fo-input w-32" />
      );
    case "pesos":
      return (
        <div className="grid gap-2 sm:grid-cols-4">
          {CATEGORIAS.map((c) => (
            <label key={c} className="text-sm">
              <span className="fo-label">{CATEGORIA_ETIQUETA[c]}</span>
              <input name={`peso_${c}`} inputMode="decimal" defaultValue={String(r.pesos[c])} className="fo-input w-full" />
            </label>
          ))}
        </div>
      );
    case "periodos":
      return (
        <div className="space-y-3">
          {r.periodos.map((p, i) => (
            <fieldset key={p.clave} className="grid gap-2 rounded border border-[var(--fo-border)] p-3 sm:grid-cols-6">
              <input type="hidden" name={`periodo_${i}_clave`} value={p.clave} />
              <label className="sm:col-span-2">
                <span className="fo-label">Nombre</span>
                <input name={`periodo_${i}_nombre`} defaultValue={p.nombre} required maxLength={60} className="fo-input w-full" />
              </label>
              <label>
                <span className="fo-label">Desde</span>
                <input type="date" name={`periodo_${i}_desde`} defaultValue={p.desde ?? ""} className="fo-input w-full" />
              </label>
              <label>
                <span className="fo-label">Hasta</span>
                <input type="date" name={`periodo_${i}_hasta`} defaultValue={p.hasta ?? ""} className="fo-input w-full" />
              </label>
              <label>
                <span className="fo-label">Carga desde</span>
                <input type="date" name={`periodo_${i}_cargaDesde`} defaultValue={p.cargaDesde ?? ""} className="fo-input w-full" />
              </label>
              <label>
                <span className="fo-label">Carga hasta</span>
                <input type="date" name={`periodo_${i}_cargaHasta`} defaultValue={p.cargaHasta ?? ""} className="fo-input w-full" />
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--fo-muted)] sm:col-span-6">
                <input type="checkbox" name={`periodo_${i}_quitar`} /> Quitar este período (sus notas no se borran)
              </label>
            </fieldset>
          ))}
          <fieldset className="grid gap-2 rounded border border-dashed border-[var(--fo-border)] p-3 sm:grid-cols-4">
            <label className="sm:col-span-2">
              <span className="fo-label">Agregar un período (opcional)</span>
              <input name="periodo_nuevo_nombre" maxLength={60} placeholder="Período de acompañamiento" className="fo-input w-full" />
            </label>
            <label>
              <span className="fo-label">Desde</span>
              <input type="date" name="periodo_nuevo_desde" className="fo-input w-full" />
            </label>
            <label>
              <span className="fo-label">Hasta</span>
              <input type="date" name="periodo_nuevo_hasta" className="fo-input w-full" />
            </label>
          </fieldset>
          <p className="text-xs text-[var(--fo-muted)]">«Carga desde / hasta» son los días que Mi Escuela deja cargar notas (Calendario Escolar → Períodos de Calificación).</p>
        </div>
      );
    default:
      return <input name="valor" inputMode="decimal" defaultValue={String(r[clave]).replace(".", ",")} className="fo-input w-32" />;
  }
}
