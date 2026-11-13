import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireRegistro } from "@/lib/registro-docente/contexto";
import { listarEscuelas } from "@/lib/registro-docente/servidor";
import { MODELOS, modeloDe } from "@/lib/registro-docente/reglas";
import { crearCursoAction, crearEscuelaAction } from "./actions";
import { Avisos, type ConAvisos } from "./_componentes/avisos";

export const dynamic = "force-dynamic";

export default async function RegistroDocentePage({ searchParams }: ConAvisos) {
  const { workspace, puedeEditar } = await requireRegistro("VIEW");
  const { error, ok } = await searchParams;
  const escuelas = await listarEscuelas(workspace.id);
  const anio = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro docente"
        description="Tus escuelas, cursos y estudiantes. Cada escuela tiene sus reglas (períodos, escala, faltas) y los cursos las heredan; se pueden cambiar en un curso o para un estudiante. Es privado: no se mezcla con clientes, socios ni el sitio."
        actions={
          <Link href="/registro-docente/asistencia" className="fo-btn fo-btn-primary">
            Pasar lista
          </Link>
        }
      />
      <Avisos error={error} ok={ok} />

      {escuelas.length === 0 ? (
        <div className="fo-card p-6 text-sm text-[var(--fo-muted)]">Todavía no cargaste ninguna escuela. Empezá por la escuela y después sus cursos.</div>
      ) : null}

      {escuelas.map((e) => (
        <section key={e.id} className="fo-card space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">
                {e.nombre}
                {e.numero ? ` N.° ${e.numero}` : ""}
              </h2>
              <p className="text-sm text-[var(--fo-muted)]">Reglas: {modeloDe(e.modelo).nombre}</p>
            </div>
            <Link href={`/registro-docente/escuelas/${e.id}`} className="fo-btn fo-btn-secondary text-sm">
              Datos y reglas de la escuela
            </Link>
          </div>
          {e.cursos.length ? (
            <ul className="divide-y rounded border border-[var(--fo-border)]">
              {e.cursos.map((c) => (
                <li key={c.id}>
                  <Link href={`/registro-docente/cursos/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-[var(--fo-surface-hover)]">
                    <span className="font-medium">{c.nombre}</span>
                    <span className="text-sm text-[var(--fo-muted)]">
                      {c.cicloLectivo} · {c.estudiantes} {c.estudiantes === 1 ? "estudiante" : "estudiantes"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--fo-muted)]">Sin cursos todavía.</p>
          )}
          {puedeEditar ? (
            <details>
              <summary className="cursor-pointer text-sm text-[var(--fo-accent)]">Agregar un curso</summary>
              <form action={crearCursoAction} className="mt-3 grid gap-3 sm:grid-cols-5">
                <input type="hidden" name="escuelaId" value={e.id} />
                <input type="hidden" name="volver" value="/registro-docente" />
                <label>
                  <span className="fo-label">Año</span>
                  <input name="anio" required maxLength={20} placeholder="3°" className="fo-input w-full" />
                </label>
                <label>
                  <span className="fo-label">División</span>
                  <input name="division" maxLength={20} placeholder="B" className="fo-input w-full" />
                </label>
                <label>
                  <span className="fo-label">Materia</span>
                  <input name="materia" required maxLength={80} placeholder="Historia" className="fo-input w-full" />
                </label>
                <label>
                  <span className="fo-label">Turno</span>
                  <input name="turno" maxLength={30} placeholder="Mañana" className="fo-input w-full" />
                </label>
                <label>
                  <span className="fo-label">Ciclo lectivo</span>
                  <input name="cicloLectivo" inputMode="numeric" defaultValue={anio} className="fo-input w-full" />
                </label>
                <div className="sm:col-span-5">
                  <button className="fo-btn fo-btn-primary text-sm">Crear curso</button>
                </div>
              </form>
            </details>
          ) : null}
        </section>
      ))}

      {puedeEditar ? (
        <form action={crearEscuelaAction} className="fo-card grid gap-3 p-5 md:grid-cols-2">
          <h2 className="text-lg font-semibold md:col-span-2">Nueva escuela</h2>
          <label className="md:col-span-2">
            <span className="fo-label">Nombre</span>
            <input name="nombre" required maxLength={120} className="fo-input w-full" placeholder="Escuela de Enseñanza Media" />
          </label>
          <label>
            <span className="fo-label">Número</span>
            <input name="numero" maxLength={20} className="fo-input w-full" placeholder="123" />
          </label>
          <label>
            <span className="fo-label">Localidad</span>
            <input name="localidad" maxLength={80} className="fo-input w-full" />
          </label>
          <label>
            <span className="fo-label">CUE (opcional)</span>
            <input name="cue" maxLength={20} className="fo-input w-full" />
          </label>
          <label>
            <span className="fo-label">Reglas de partida</span>
            <select name="modelo" className="fo-input w-full" defaultValue={MODELOS[0].clave}>
              {MODELOS.map((m) => (
                <option key={m.clave} value={m.clave}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <p className="fo-helper md:col-span-2">El modelo trae los valores de partida; después cambiás lo que tu escuela haga distinto.</p>
          <div className="md:col-span-2">
            <button className="fo-btn fo-btn-primary">Crear escuela</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
