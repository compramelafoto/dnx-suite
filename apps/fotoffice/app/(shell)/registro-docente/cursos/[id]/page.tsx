import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRegistro } from "@/lib/registro-docente/contexto";
import { asistenciaDelCurso, obtenerCurso, reglasDeEstudiante } from "@/lib/registro-docente/servidor";
import { resumirAsistencia } from "@/lib/registro-docente/asistencia";
import { Avisos } from "../../_componentes/avisos";
import { CursoNav } from "../../_componentes/curso-nav";
import { PegarPadron } from "../../_componentes/pegar-padron";

export const dynamic = "force-dynamic";

export default async function CursoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, puedeEditar } = await requireRegistro("VIEW");
  const { id } = await params;
  const { error, ok } = await searchParams;
  const curso = await obtenerCurso(workspace.id, id);
  if (!curso) notFound();
  const asistencia = await asistenciaDelCurso(curso.id);
  const activos = curso.estudiantes.filter((e) => !e.bajaAt).length;

  return (
    <div className="space-y-6">
      <Link href="/registro-docente" className="text-sm text-[var(--fo-muted)]">← {curso.escuela.nombre}{curso.escuela.numero ? ` N.° ${curso.escuela.numero}` : ""}</Link>
      <PageHeader
        title={curso.nombre}
        description={`Ciclo ${curso.cicloLectivo} · ${activos} ${activos === 1 ? "estudiante" : "estudiantes"} · ${asistencia.clases} ${asistencia.clases === 1 ? "clase con asistencia" : "clases con asistencia"}`}
      />
      <CursoNav cursoId={curso.id} activa="padron" periodos={curso.reglas.valores.periodos} />
      <Avisos error={error} ok={ok} />

      {curso.estudiantes.length ? (
        <div className="overflow-x-auto rounded border border-[var(--fo-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--fo-surface-muted)] text-left">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">Estudiante</th>
                <th className="p-2">DNI</th>
                <th className="p-2">Cond.</th>
                <th className="p-2 text-right">Faltas</th>
                <th className="p-2 text-right">Asistencia</th>
              </tr>
            </thead>
            <tbody>
              {curso.estudiantes.map((e) => {
                const reglas = reglasDeEstudiante(curso, e);
                const r = resumirAsistencia(asistencia.porEstudiante.get(e.id) ?? [], reglas);
                const baja = Boolean(e.bajaAt);
                return (
                  <tr key={e.id} className={`border-t border-[var(--fo-border)] ${baja ? "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]" : ""}`}>
                    <td className="p-2">{e.orden}</td>
                    <td className="p-2">
                      <Link href={`/registro-docente/cursos/${curso.id}/estudiantes/${e.id}`} className="hover:underline">
                        {e.apellido}
                        {e.nombre ? `, ${e.nombre}` : ""}
                      </Link>
                      {reglas.ppi ? <span className="ml-2 rounded bg-[var(--fo-accent-soft)] px-1.5 py-0.5 text-xs">PPI</span> : null}
                      {baja ? <span className="ml-2 text-xs">(baja{e.bajaMotivo ? `: ${e.bajaMotivo}` : ""})</span> : null}
                    </td>
                    <td className="p-2">{e.dni ?? "—"}</td>
                    <td className="p-2">{e.condicion}</td>
                    <td className={`p-2 text-right ${r.superaLimite ? "font-semibold text-[var(--fo-danger)]" : r.cercaDelLimite ? "text-[var(--fo-warning)]" : ""}`}>
                      {String(r.faltas).replace(".", ",")}
                      {reglas.limiteFaltas !== null ? ` / ${reglas.limiteFaltas}` : ""}
                    </td>
                    <td className="p-2 text-right">{r.porcentaje === null ? "—" : `${String(r.porcentaje).replace(".", ",")} %`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="fo-card p-6 text-sm text-[var(--fo-muted)]">El curso todavía no tiene estudiantes. Pegá el padrón acá abajo.</div>
      )}

      {puedeEditar ? <PegarPadron cursoId={curso.id} abierto={curso.estudiantes.length === 0} /> : null}
    </div>
  );
}
