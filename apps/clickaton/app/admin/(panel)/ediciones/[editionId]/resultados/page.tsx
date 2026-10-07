import Link from "next/link";
import { notFound } from "next/navigation";

import { DescargaParaRedes } from "@/components/admin/edition-results/DescargaParaRedes";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MiniaturaDeEnvio } from "@/components/admin/admission/MiniaturaDeEnvio";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { nombreDelPremio, porConsigna } from "@/lib/edition-results/armar-resultados";
import {
  cargarResultadosDeEdicion,
  type FilaConAutor,
} from "@/lib/edition-results/cargar-resultados";
import {
  filtroActivo,
  filtroAQuery,
  leerFiltro,
  pasaElFiltro,
} from "@/lib/edition-results/redes-seleccion";

export const dynamic = "force-dynamic";

function formatearNota(nota: number | null): string {
  return nota == null ? "—" : nota.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

/**
 * El ranking de la edición, consigna por consigna.
 *
 * Mientras el jurado califica es parcial y se recalcula en cada visita; cuando
 * FotoRank cierra el ranking pasa a mostrar el final. El panel ve nombres: el
 * anonimato es para el jurado, no para la organización.
 */
export default async function ResultadosDeLaEdicionPage({
  params,
  searchParams,
}: {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireClickatonAdmin();
  const { editionId } = await params;
  const filtro = leerFiltro(await searchParams);

  const edicion = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true },
  });
  if (!edicion) notFound();

  const base = `${adminRoutes.editions}/${editionId}`;
  const [resultados, consignas] = await Promise.all([
    cargarResultadosDeEdicion(editionId),
    prisma.clickatonPrompt.findMany({
      where: { editionId },
      orderBy: { sequence: "asc" },
      select: { id: true, sequence: true, title: true, titleSnapshot: true },
    }),
  ]);

  const encabezado = (
    <AdminPageHeader
      title="Resultados"
      description={`Ranking por consigna de ${edicion.name}.`}
      breadcrumbs={[
        { label: "Ediciones", href: adminRoutes.editions },
        { label: edicion.name, href: base },
        { label: "Resultados" },
      ]}
    />
  );

  if (!resultados) {
    return (
      <div className="space-y-6">
        {encabezado}
        <Card variant="outlined" className="p-6">
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            Esta edición todavía no abrió el juzgamiento, así que no hay notas para rankear.
            Los resultados aparecen acá en cuanto el jurado envíe su primera calificación.
          </p>
        </Card>
      </div>
    );
  }

  const esFinal = resultados.modo === "FINAL";
  const hayFiltro = filtroActivo(filtro);
  const filtradas = resultados.filas.filter((f) => pasaElFiltro(f, filtro));
  const grupos = porConsigna(filtradas, consignas).filter(
    (g) => !hayFiltro || g.filas.length > 0,
  );
  const conPuestoFiltradas = filtradas.filter((f) => f.puesto != null);
  const publicables = conPuestoFiltradas.filter(
    (f) => f.autor?.autorizaRedes && f.autor.submissionId,
  ).length;
  const sinPermiso = conPuestoFiltradas.filter((f) => f.autor && !f.autor.autorizaRedes);
  const tituloDe = new Map(
    consignas.map((c) => [
      c.id,
      `Consigna ${c.sequence}${(c.title ?? c.titleSnapshot) ? ` · ${c.title ?? c.titleSnapshot}` : ""}`,
    ]),
  );
  const conPuesto = resultados.filas.filter((f) => f.puesto != null).length;

  return (
    <div className="space-y-6">
      {encabezado}

      <Card variant={esFinal ? "yellow" : "default"} className="space-y-3 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={esFinal ? "success" : "warning"}>
            {esFinal ? "Resultado final" : "Resultado parcial"}
          </Badge>
          <p className="text-sm text-ck-text-secondary">
            {resultados.filas.length} obras · {conPuesto} con puesto ·{" "}
            {resultados.notasEnviadas} calificaciones enviadas
            {resultados.notasEnCurso > 0 ? ` · ${resultados.notasEnCurso} en curso` : ""}
          </p>
        </div>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          {esFinal
            ? "FotoRank cerró el ranking: estos son los puestos y premios definitivos."
            : `Se calcula en vivo con las notas que el jurado ya envió. Cada obra recibe ${resultados.miradasPorObra} miradas; hasta tenerlas todas, su puesto puede cambiar. Las notas a medio cargar no cuentan.`}
        </p>
        <nav aria-label="Consignas" className="flex flex-wrap gap-2 pt-1">
          {grupos.map((g) => (
            <a
              key={g.consignaId ?? "sin-consigna"}
              href={`#consigna-${g.consignaId ?? "sin"}`}
              className="rounded-[var(--ck-radius-sm)] border border-ck-border px-3 py-1.5 text-xs text-ck-text-secondary hover:border-ck-yellow/60 hover:text-ck-text"
            >
              {g.consignaId ? (tituloDe.get(g.consignaId) ?? "Consigna") : "Sin consigna"} (
              {g.filas.length})
            </a>
          ))}
        </nav>
      </Card>

      <Card variant="outlined" className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-ck-text">Filtrar y descargar para redes</h2>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            Elegí consignas y puestos. La descarga es un ZIP con una carpeta por consigna: la
            foto y la ficha de cada obra, en el orden del carrusel, y el copy listo para pegar.
          </p>
        </div>
        <form method="get" className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-ck-text-muted">
              Consignas (ninguna marcada = todas)
            </legend>
            <div className="flex flex-wrap gap-2">
              {consignas.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-[var(--ck-radius-sm)] border border-ck-border px-3 py-1.5 text-xs text-ck-text-secondary has-[:checked]:border-ck-yellow has-[:checked]:text-ck-text"
                >
                  <input
                    type="checkbox"
                    name="consigna"
                    value={c.id}
                    defaultChecked={filtro.consignas.includes(c.id)}
                    className="accent-[var(--ck-yellow)]"
                  />
                  {tituloDe.get(c.id)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs text-ck-text-muted">
              <span className="block font-semibold uppercase tracking-wide">Desde el puesto</span>
              <input
                type="number"
                name="desde"
                min={1}
                defaultValue={filtro.desde ?? ""}
                placeholder="1"
                className="w-24 rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface px-3 py-2 text-sm text-ck-text"
              />
            </label>
            <label className="space-y-1 text-xs text-ck-text-muted">
              <span className="block font-semibold uppercase tracking-wide">Hasta el puesto</span>
              <input
                type="number"
                name="hasta"
                min={1}
                defaultValue={filtro.hasta ?? ""}
                placeholder="3"
                className="w-24 rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface px-3 py-2 text-sm text-ck-text"
              />
            </label>
            <Button type="submit" variant="outline" size="sm">
              Filtrar
            </Button>
            {hayFiltro ? (
              <Button href={`${base}/resultados`} variant="ghost" size="sm">
                Quitar filtro
              </Button>
            ) : null}
          </div>
        </form>
        <DescargaParaRedes
          editionId={editionId}
          query={filtroAQuery(filtro)}
          obras={publicables}
        />
        {sinPermiso.length > 0 ? (
          <p className="text-sm leading-relaxed text-[var(--ck-warning)]">
            Quedan afuera del ZIP porque no autorizaron publicar su obra en redes:{" "}
            {sinPermiso
              .map(
                (f) =>
                  `${f.autor?.nombre} (${f.promptExternalId ? (tituloDe.get(f.promptExternalId) ?? "consigna") : "sin consigna"}, puesto ${f.puesto})`,
              )
              .join(" · ")}
            . Tampoco se los nombra en el copy.
          </p>
        ) : null}
      </Card>

      {hayFiltro && grupos.length === 0 ? (
        <Card variant="outlined" className="p-6">
          <p className="text-sm text-ck-text-secondary">Ninguna obra coincide con el filtro.</p>
        </Card>
      ) : null}

      {grupos.map((g) => (
        <section
          key={g.consignaId ?? "sin-consigna"}
          id={`consigna-${g.consignaId ?? "sin"}`}
          className="scroll-mt-24 space-y-3"
        >
          <h2 className="text-lg font-semibold text-ck-text">
            {g.consignaId ? (tituloDe.get(g.consignaId) ?? "Consigna") : "Sin consigna"}
          </h2>
          <AdminDataTable<FilaConAutor>
            rows={g.filas}
            rowKey={(f) => f.snapshotId}
            emptyMessage="Ninguna obra de esta consigna llegó al jurado."
            columns={[
              {
                key: "puesto",
                header: "Puesto",
                className: "w-20",
                cell: (f) => (
                  <span className="text-lg font-semibold text-ck-text">
                    {f.puesto ?? "—"}
                    {f.empatada ? <span className="ml-1 text-xs text-[var(--ck-warning)]">empate</span> : null}
                  </span>
                ),
              },
              {
                key: "foto",
                header: "Foto",
                cell: (f) =>
                  f.autor?.submissionId ? (
                    <MiniaturaDeEnvio
                      submissionId={f.autor.submissionId}
                      alt={`Obra ${f.anonymousCode}`}
                      className="h-16 w-24 object-cover"
                      abreEnPestana
                    />
                  ) : (
                    <span className="text-xs text-ck-text-muted">—</span>
                  ),
              },
              {
                key: "participante",
                header: "Participante",
                cell: (f) =>
                  f.autor ? (
                    <div className="space-y-0.5">
                      <Link
                        href={`${adminRoutes.people}/${f.autor.registrationId}`}
                        className="font-medium text-ck-text hover:text-ck-yellow"
                      >
                        {f.autor.nombre}
                      </Link>
                      {!f.autor.autorizaRedes ? (
                        <Badge variant="warning" className="ml-2">
                          Sin permiso para redes
                        </Badge>
                      ) : null}
                      <p className="text-xs text-ck-text-muted">
                        {f.autor.numero ? `N.º ${f.autor.numero}` : null}
                        {f.autor.instagram ? (
                          <>
                            {f.autor.numero ? " · " : null}
                            <a
                              href={`https://instagram.com/${f.autor.instagram.replace(/^@/, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-ck-yellow"
                            >
                              @{f.autor.instagram.replace(/^@/, "")}
                            </a>
                          </>
                        ) : null}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-ck-text-muted">Sin datos de inscripción</span>
                  ),
              },
              {
                key: "codigo",
                header: "Código",
                hideOnMobile: true,
                cell: (f) => <span className="font-mono text-xs">{f.anonymousCode}</span>,
              },
              {
                key: "nota",
                header: `Nota (de ${resultados.sesion.scoreScaleMax})`,
                cell: (f) => <span className="font-semibold">{formatearNota(f.nota)}</span>,
              },
              {
                key: "miradas",
                header: "Miradas",
                cell: (f) => (
                  <span
                    className={
                      f.miradas >= resultados.miradasPorObra
                        ? "text-ck-text"
                        : "text-ck-text-muted"
                    }
                  >
                    {f.miradas} de {resultados.miradasPorObra}
                  </span>
                ),
              },
              {
                key: "premio",
                header: esFinal ? "Premio" : "Premio si terminara hoy",
                cell: (f) => {
                  const premio = nombreDelPremio(f.premio);
                  return premio ? <Badge variant="brand">{premio}</Badge> : null;
                },
              },
            ]}
          />
        </section>
      ))}
    </div>
  );
}
