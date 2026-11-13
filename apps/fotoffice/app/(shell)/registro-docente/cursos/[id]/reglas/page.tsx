import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRegistro } from "@/lib/registro-docente/contexto";
import { obtenerCurso } from "@/lib/registro-docente/servidor";
import { Avisos } from "../../../_componentes/avisos";
import { CursoNav } from "../../../_componentes/curso-nav";
import { ReglasEditor } from "../../../_componentes/reglas-editor";

export const dynamic = "force-dynamic";

export default async function ReglasCursoPage({
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
      <PageHeader
        title={`Reglas de ${c.nombre}`}
        description="Este curso usa las reglas de la escuela. Si cambiás una acá, vale sólo para este curso y queda marcada; con «Volver a la regla de la escuela» se deshace."
      />
      <CursoNav cursoId={c.id} activa="reglas" periodos={c.reglas.valores.periodos} />
      <Avisos error={error} ok={ok} />
      <p className="text-sm">
        <Link href={`/registro-docente/escuelas/${c.escuela.id}`} className="text-[var(--fo-accent)]">
          Ver las reglas de la escuela
        </Link>
      </p>
      <ReglasEditor nivel="curso" id={c.id} cadena={c.cadena} volver={`/registro-docente/cursos/${c.id}/reglas`} puedeEditar={puedeEditar} />
    </div>
  );
}
