import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRegistro } from "@/lib/registro-docente/contexto";
import { evaluacionesDelCurso, obtenerCurso, reglasDeEstudiante } from "@/lib/registro-docente/servidor";
import { CATEGORIA_DE_TIPO, TIPOS_EVALUACION, TIPO_ETIQUETA, formatearNota, textoDeCelda } from "@/lib/registro-docente/notas";
import { CATEGORIA_ETIQUETA } from "@/lib/registro-docente/reglas";
import { crearEvaluacionAction, editarEvaluacionAction } from "../../../actions";
import { Avisos } from "../../../_componentes/avisos";
import { CursoNav } from "../../../_componentes/curso-nav";
import { Planilla, type ColumnaPlanilla, type FilaPlanilla } from "./planilla";

export const dynamic = "force-dynamic";

const corta = (iso: string | null) => (iso ? iso.slice(5).split("-").reverse().join("/") : "");

export default async function NotasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string; periodo?: string }>;
}) {
  const { workspace, puedeEditar } = await requireRegistro("VIEW");
  const { id } = await params;
  const sp = await searchParams;
  const curso = await obtenerCurso(workspace.id, id);
  if (!curso) notFound();
  const periodos = curso.reglas.valores.periodos;
  const periodo = periodos.find((p) => p.clave === sp.periodo)?.clave ?? periodos[0].clave;
  const todas = await evaluacionesDelCurso(curso.id);
  const delPeriodo = todas.filter((e) => e.periodo === periodo);
  const titulos = new Map(todas.map((e) => [e.id, e.titulo]));
  const ruta = `/registro-docente/cursos/${curso.id}/notas?periodo=${periodo}`;

  const columnas: ColumnaPlanilla[] = delPeriodo.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    subtitulo: [e.recuperaAId ? `Recupera «${titulos.get(e.recuperaAId) ?? "—"}»` : TIPO_ETIQUETA[e.tipo], corta(e.fecha), e.notaMaxima !== 10 ? `sobre ${formatearNota(e.notaMaxima)}` : ""].filter(Boolean).join(" · "),
    notaMaxima: e.notaMaxima,
    esRecuperatorio: Boolean(e.recuperaAId),
  }));
  const filas: FilaPlanilla[] = curso.estudiantes.map((s) => ({
    id: s.id,
    nombre: `${s.apellido}${s.nombre ? `, ${s.nombre}` : ""}`,
    baja: Boolean(s.bajaAt),
    ppi: reglasDeEstudiante(curso, s).ppi,
    celdas: Object.fromEntries(delPeriodo.map((e) => [e.id, textoDeCelda(e.notas.get(s.id))])),
  }));
  const originales = delPeriodo.filter((e) => !e.recuperaAId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Notas de ${curso.nombre}`}
        description="Escribí la nota y pasá a la siguiente con Enter: se guarda sola. También: A = ausente (queda pendiente), NE = no entregó, EX = exceptuado, y una «t» al final si entregó tarde (8t)."
      />
      <CursoNav cursoId={curso.id} activa="notas" periodos={periodos} />
      <Avisos error={sp.error} ok={sp.ok} />

      <div className="flex flex-wrap gap-2" aria-label="Período">
        {periodos.map((p) => (
          <a
            key={p.clave}
            href={`/registro-docente/cursos/${curso.id}/notas?periodo=${p.clave}`}
            className={`rounded border px-3 py-1.5 text-sm ${p.clave === periodo ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)] font-medium" : "border-[var(--fo-border)]"}`}
          >
            {p.nombre}
          </a>
        ))}
      </div>

      <Planilla columnas={columnas} filas={filas} puedeEditar={puedeEditar} />

      {puedeEditar ? (
        <form action={crearEvaluacionAction} className="fo-card grid gap-3 p-5 sm:grid-cols-6">
          <h2 className="font-semibold sm:col-span-6">Nueva evaluación</h2>
          <input type="hidden" name="cursoId" value={curso.id} />
          <input type="hidden" name="volver" value={ruta} />
          <input type="hidden" name="periodo" value={periodo} />
          <label className="sm:col-span-2">
            <span className="fo-label">Nombre</span>
            <input name="titulo" required maxLength={120} placeholder="Escrito: Revolución de Mayo" className="fo-input w-full" />
          </label>
          <label>
            <span className="fo-label">Tipo</span>
            <select name="tipo" className="fo-input w-full" defaultValue="escrito">
              {TIPOS_EVALUACION.map((t) => (
                <option key={t} value={t}>
                  {TIPO_ETIQUETA[t]} ({CATEGORIA_ETIQUETA[CATEGORIA_DE_TIPO[t]]})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="fo-label">Fecha</span>
            <input type="date" name="fecha" className="fo-input w-full" />
          </label>
          <label>
            <span className="fo-label">Nota sobre</span>
            <input name="notaMaxima" inputMode="decimal" defaultValue="10" className="fo-input w-full" />
          </label>
          <label>
            <span className="fo-label">¿Es recuperatorio de…?</span>
            <select name="recuperaAId" className="fo-input w-full" defaultValue="">
              <option value="">No</option>
              {originales.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titulo}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-6">
            <button className="fo-btn fo-btn-primary">Crear evaluación</button>
          </div>
        </form>
      ) : null}

      {puedeEditar && delPeriodo.length ? (
        <details className="fo-card p-5">
          <summary className="cursor-pointer font-semibold">Editar o borrar evaluaciones de este período</summary>
          <div className="mt-3 space-y-3">
            {delPeriodo.map((e) => (
              <form key={e.id} action={editarEvaluacionAction} className="grid gap-2 border-t border-[var(--fo-border)] pt-3 sm:grid-cols-7">
                <input type="hidden" name="evaluacionId" value={e.id} />
                <input type="hidden" name="volver" value={ruta} />
                <input name="titulo" required maxLength={120} defaultValue={e.titulo} className="fo-input sm:col-span-2" aria-label="Nombre" />
                <select name="tipo" defaultValue={e.tipo} className="fo-input" aria-label="Tipo">
                  {TIPOS_EVALUACION.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_ETIQUETA[t]}
                    </option>
                  ))}
                </select>
                <input type="date" name="fecha" defaultValue={e.fecha ?? ""} className="fo-input" aria-label="Fecha" />
                <select name="periodo" defaultValue={e.periodo} className="fo-input" aria-label="Período">
                  {periodos.map((p) => (
                    <option key={p.clave} value={p.clave}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <input name="notaMaxima" inputMode="decimal" defaultValue={formatearNota(e.notaMaxima)} className="fo-input" aria-label="Nota sobre" />
                <select name="recuperaAId" defaultValue={e.recuperaAId ?? ""} className="fo-input" aria-label="Recuperatorio de">
                  <option value="">No es recuperatorio</option>
                  {originales
                    .filter((o) => o.id !== e.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        Recupera: {o.titulo}
                      </option>
                    ))}
                </select>
                <div className="flex gap-2 sm:col-span-7">
                  <button className="fo-btn fo-btn-secondary text-sm">Guardar</button>
                  <label className="flex items-center gap-1 text-xs text-[var(--fo-muted)]">
                    <input type="checkbox" name="confirmarBorrado" /> Sí, borrarla
                  </label>
                  <button name="borrar" value="1" className="fo-btn fo-btn-danger-outline text-sm">
                    Borrar (con sus notas)
                  </button>
                </div>
              </form>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
