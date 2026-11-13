import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRegistro } from "@/lib/registro-docente/contexto";
import { obtenerCurso } from "@/lib/registro-docente/servidor";
import { editarCursoAction } from "../../../actions";
import { Avisos } from "../../../_componentes/avisos";
import { CursoNav } from "../../../_componentes/curso-nav";

export const dynamic = "force-dynamic";

export default async function DatosCursoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, puedeEditar } = await requireRegistro("VIEW");
  const { id } = await params;
  const { error, ok } = await searchParams;
  const c = await obtenerCurso(workspace.id, id);
  if (!c) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={c.nombre} description="Año, división, materia, turno y ciclo lectivo." />
      <CursoNav cursoId={c.id} activa="datos" periodos={c.reglas.valores.periodos} />
      <Avisos error={error} ok={ok} />
      <form action={editarCursoAction} className="fo-card grid gap-3 p-5 sm:grid-cols-5">
        <input type="hidden" name="cursoId" value={c.id} />
        <label>
          <span className="fo-label">Año</span>
          <input name="anio" required maxLength={20} defaultValue={c.anio} className="fo-input w-full" />
        </label>
        <label>
          <span className="fo-label">División</span>
          <input name="division" maxLength={20} defaultValue={c.division ?? ""} className="fo-input w-full" />
        </label>
        <label>
          <span className="fo-label">Materia</span>
          <input name="materia" required maxLength={80} defaultValue={c.materia} className="fo-input w-full" />
        </label>
        <label>
          <span className="fo-label">Turno</span>
          <input name="turno" maxLength={30} defaultValue={c.turno ?? ""} className="fo-input w-full" />
        </label>
        <label>
          <span className="fo-label">Ciclo lectivo</span>
          <input name="cicloLectivo" inputMode="numeric" defaultValue={c.cicloLectivo} className="fo-input w-full" />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-5">
          <input type="checkbox" name="archivado" defaultChecked={Boolean(c.archivadoAt)} /> Archivar el curso (deja de aparecer en la lista y en «Pasar lista»; no se borra nada)
        </label>
        {puedeEditar ? (
          <div className="sm:col-span-5">
            <button className="fo-btn fo-btn-primary">Guardar</button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
