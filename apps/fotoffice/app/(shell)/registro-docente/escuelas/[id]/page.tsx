import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRegistro } from "@/lib/registro-docente/contexto";
import { obtenerEscuela } from "@/lib/registro-docente/servidor";
import { MODELOS } from "@/lib/registro-docente/reglas";
import { editarEscuelaAction } from "../../actions";
import { Avisos } from "../../_componentes/avisos";
import { ReglasEditor } from "../../_componentes/reglas-editor";

export const dynamic = "force-dynamic";

export default async function EscuelaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, puedeEditar } = await requireRegistro("VIEW");
  const { id } = await params;
  const { error, ok } = await searchParams;
  const e = await obtenerEscuela(workspace.id, id);
  if (!e) notFound();
  const ruta = `/registro-docente/escuelas/${e.id}`;

  return (
    <div className="space-y-6">
      <Link href="/registro-docente" className="text-sm text-[var(--fo-muted)]">← Registro docente</Link>
      <PageHeader
        title={`${e.nombre}${e.numero ? ` N.° ${e.numero}` : ""}`}
        description="Las reglas de la escuela valen para todos sus cursos. Si un curso o un estudiante necesita otra cosa, se cambia ahí y queda marcado."
      />
      <Avisos error={error} ok={ok} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reglas de la escuela</h2>
        <ReglasEditor nivel="escuela" id={e.id} cadena={{ modelo: e.modelo, escuela: e.reglas }} volver={ruta} puedeEditar={puedeEditar} />
      </section>

      {puedeEditar ? (
        <form action={editarEscuelaAction} className="fo-card grid gap-3 p-5 md:grid-cols-2">
          <h2 className="text-lg font-semibold md:col-span-2">Datos de la escuela</h2>
          <input type="hidden" name="escuelaId" value={e.id} />
          <label className="md:col-span-2">
            <span className="fo-label">Nombre</span>
            <input name="nombre" required maxLength={120} defaultValue={e.nombre} className="fo-input w-full" />
          </label>
          <label>
            <span className="fo-label">Número</span>
            <input name="numero" maxLength={20} defaultValue={e.numero ?? ""} className="fo-input w-full" />
          </label>
          <label>
            <span className="fo-label">Localidad</span>
            <input name="localidad" maxLength={80} defaultValue={e.localidad ?? ""} className="fo-input w-full" />
          </label>
          <label>
            <span className="fo-label">CUE</span>
            <input name="cue" maxLength={20} defaultValue={e.cue ?? ""} className="fo-input w-full" />
          </label>
          <label>
            <span className="fo-label">Modelo de reglas</span>
            <select name="modelo" defaultValue={e.modelo} className="fo-input w-full">
              {MODELOS.map((m) => (
                <option key={m.clave} value={m.clave}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <button className="fo-btn fo-btn-primary">Guardar</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
