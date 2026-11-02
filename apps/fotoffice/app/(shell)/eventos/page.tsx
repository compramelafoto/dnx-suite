import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireEventos } from "@/lib/eventos/contexto";
import { listarEventos, sincronizarInscriptos } from "@/lib/eventos/servidor";
import { crearEventoAction } from "./actions";

export const dynamic = "force-dynamic";

const fecha = (d: Date | null) =>
  d ? d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "long", year: "numeric" }) : null;

export default async function EventosPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { workspace, puedeEditar } = await requireEventos("VIEW");
  const { error } = await searchParams;
  await sincronizarInscriptos(workspace.id);
  const eventos = await listarEventos(workspace.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description="Congresos, jornadas y workshops con sus inscriptos. Las entradas vendidas en la tienda y los formularios del sitio los suman solos."
      />
      {error ? <p className="fo-alert-warning">{error}</p> : null}

      {eventos.length === 0 ? (
        <div className="fo-card p-6 text-sm text-[var(--fo-muted)]">Todavía no hay eventos.</div>
      ) : (
        <ul className="divide-y rounded border border-[var(--fo-border)]">
          {eventos.map((e) => (
            <li key={e.id}>
              <Link href={`/eventos/${e.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-[var(--fo-surface-2,rgba(127,127,127,0.06))]">
                <div className="min-w-0">
                  <p className="font-medium">
                    {e.nombre}
                    {e.archivado ? <span className="ml-2 text-xs text-[var(--fo-muted)]">(archivado)</span> : null}
                  </p>
                  <p className="text-sm text-[var(--fo-muted)]">{[fecha(e.fechaInicio), e.lugar].filter(Boolean).join(" · ") || "Sin fecha"}</p>
                </div>
                <div className="flex gap-6 text-sm">
                  <span>
                    <strong>{e.inscriptos}</strong>
                    {e.cupo ? ` / ${e.cupo}` : ""} inscriptos
                  </span>
                  <span>
                    <strong>{e.acreditados}</strong> acreditados
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {puedeEditar ? (
        <form action={crearEventoAction} className="fo-card grid gap-3 p-6 md:grid-cols-2">
          <h2 className="text-lg font-semibold md:col-span-2">Nuevo evento</h2>
          <label className="md:col-span-2">
            <span className="fo-label">Nombre</span>
            <input name="nombre" required maxLength={120} className="fo-input w-full" placeholder="Congreso 2027" />
          </label>
          <label>
            <span className="fo-label">Empieza</span>
            <input type="date" name="fechaInicio" className="fo-input w-full" />
          </label>
          <label>
            <span className="fo-label">Termina</span>
            <input type="date" name="fechaFin" className="fo-input w-full" />
          </label>
          <label>
            <span className="fo-label">Lugar</span>
            <input name="lugar" maxLength={200} className="fo-input w-full" />
          </label>
          <label>
            <span className="fo-label">Cupo (opcional)</span>
            <input name="cupo" inputMode="numeric" pattern="[0-9]*" className="fo-input w-full" />
          </label>
          <div className="md:col-span-2">
            <button className="fo-btn fo-btn-primary">Crear evento</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
