import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRegistro } from "@/lib/registro-docente/contexto";
import { asistenciaDelCurso, obtenerCurso } from "@/lib/registro-docente/servidor";
import { resumirAsistencia, ESTADOS_ASISTENCIA, ESTADO_ETIQUETA } from "@/lib/registro-docente/asistencia";
import { resolverReglas } from "@/lib/registro-docente/reglas";
import { borrarEstudianteAction, editarEstudianteAction } from "../../../../actions";
import { Avisos } from "../../../../_componentes/avisos";
import { ReglasEditor } from "../../../../_componentes/reglas-editor";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EstudiantePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; eid: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, puedeEditar } = await requireRegistro("VIEW");
  const { id, eid } = await params;
  const { error, ok } = await searchParams;
  const curso = await obtenerCurso(workspace.id, id);
  const e = curso?.estudiantes.find((x) => x.id === eid);
  if (!curso || !e) notFound();
  const cadena = { ...curso.cadena, estudiante: e.reglas };
  const reglas = resolverReglas(cadena).valores;
  const asis = await asistenciaDelCurso(curso.id);
  const r = resumirAsistencia(asis.porEstudiante.get(e.id) ?? [], reglas);
  const ruta = `/registro-docente/cursos/${curso.id}/estudiantes/${e.id}`;

  return (
    <div className="space-y-6">
      <Link href={`/registro-docente/cursos/${curso.id}`} className="text-sm text-[var(--fo-muted)]">← {curso.nombre}</Link>
      <PageHeader title={`${e.apellido}${e.nombre ? `, ${e.nombre}` : ""}`} description={e.bajaAt ? `Dado de baja el ${iso(e.bajaAt).split("-").reverse().join("/")}` : `N.° ${e.orden} del padrón`} />
      <Avisos error={error} ok={ok} />

      <section className="fo-card space-y-2 p-5">
        <h2 className="font-semibold">Asistencia</h2>
        <p className="text-sm">
          {r.clases} {r.clases === 1 ? "clase" : "clases"} · {String(r.faltas).replace(".", ",")} faltas
          {reglas.limiteFaltas !== null ? ` de ${reglas.limiteFaltas} permitidas` : ""}
          {r.porcentaje !== null ? ` · ${String(r.porcentaje).replace(".", ",")} % de asistencia` : ""}
        </p>
        <p className="text-sm text-[var(--fo-muted)]">{ESTADOS_ASISTENCIA.map((s) => `${ESTADO_ETIQUETA[s]}: ${r.conteo[s]}`).join(" · ")}</p>
        {r.superaLimite ? <p className="fo-alert-error text-sm">Pasó el límite de faltas.</p> : r.cercaDelLimite ? <p className="fo-alert-warning text-sm">Está cerca del límite de faltas.</p> : null}
      </section>

      <form action={editarEstudianteAction} className="fo-card grid gap-3 p-5 sm:grid-cols-4">
        <h2 className="font-semibold sm:col-span-4">Datos</h2>
        <input type="hidden" name="estudianteId" value={e.id} />
        <input type="hidden" name="volver" value={ruta} />
        <label className="sm:col-span-2">
          <span className="fo-label">Apellido</span>
          <input name="apellido" required maxLength={80} defaultValue={e.apellido} className="fo-input w-full" />
        </label>
        <label className="sm:col-span-2">
          <span className="fo-label">Nombre</span>
          <input name="nombre" maxLength={80} defaultValue={e.nombre} className="fo-input w-full" />
        </label>
        <label>
          <span className="fo-label">DNI</span>
          <input name="dni" inputMode="numeric" maxLength={12} defaultValue={e.dni ?? ""} className="fo-input w-full" />
        </label>
        <label>
          <span className="fo-label">N.° de orden</span>
          <input name="orden" inputMode="numeric" defaultValue={e.orden} className="fo-input w-full" />
        </label>
        <label>
          <span className="fo-label">Condición</span>
          <select name="condicion" defaultValue={e.condicion} className="fo-input w-full">
            <option value="R">Regular (R)</option>
            <option value="NR">No regular (NR)</option>
          </select>
        </label>
        <label>
          <span className="fo-label">Alta</span>
          <input type="date" name="altaAt" defaultValue={iso(e.altaAt)} className="fo-input w-full" />
        </label>
        <label>
          <span className="fo-label">Baja</span>
          <input type="date" name="bajaAt" defaultValue={iso(e.bajaAt)} className="fo-input w-full" />
        </label>
        <label className="sm:col-span-3">
          <span className="fo-label">Motivo de la baja</span>
          <input name="bajaMotivo" maxLength={120} defaultValue={e.bajaMotivo ?? ""} placeholder="Pase a otra escuela, cambio de sección, abandono…" className="fo-input w-full" />
        </label>
        <label className="sm:col-span-4">
          <span className="fo-label">Nota privada (sólo la ves vos)</span>
          <textarea name="notaPrivada" rows={3} maxLength={2000} defaultValue={e.notaPrivada ?? ""} className="fo-input w-full" />
        </label>
        {puedeEditar ? (
          <div className="sm:col-span-4">
            <button className="fo-btn fo-btn-primary">Guardar</button>
          </div>
        ) : null}
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reglas para este estudiante</h2>
        <p className="text-sm text-[var(--fo-muted)]">Usa las del curso. Cambiá acá sólo lo que sea distinto para él o ella (por ejemplo, PPI u otra nota de aprobación).</p>
        <ReglasEditor nivel="estudiante" id={e.id} cadena={cadena} volver={ruta} puedeEditar={puedeEditar} />
      </section>

      {puedeEditar ? (
        <form action={borrarEstudianteAction} className="text-sm">
          <input type="hidden" name="estudianteId" value={e.id} />
          <input type="hidden" name="cursoId" value={curso.id} />
          <button className="fo-btn fo-btn-danger-outline text-sm">Borrar del padrón (sólo si se cargó por error)</button>
        </form>
      ) : null}
    </div>
  );
}
