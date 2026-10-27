import Link from "next/link";
import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { WebsiteShell } from "@/components/website/website-shell";
import { listCustomPages } from "@/lib/website/pages";
import { PERIODOS_VISITAS, periodoDeVisitas } from "@/lib/website/visitas";
import { resumenDeVisitas } from "@/lib/website/visitas.server";

export const dynamic = "force-dynamic";

/**
 * Sitio web → Visitas: cuántas veces se abrió cada página del sitio público en los últimos 7, 30
 * o 90 días. Sin cookies ni datos personales (ver `lib/website/visitas.ts`): son números, no
 * personas. Spec: docs/superpowers/specs/2026-10-27-sitio-herramientas-prosite-design.md (PR D)
 */
export default async function WebsiteVisitasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { workspace, canEdit, status, sections, draftUpdatedAtIso } = await loadWebsiteCmsContext();
  const dias = periodoDeVisitas((await searchParams).dias);
  const resumen = await resumenDeVisitas(workspace.id, dias);

  // Nombre legible de cada ruta: la portada y las páginas propias por su título.
  const titulos = new Map<string, string>([["/", "Portada"]]);
  for (const p of listCustomPages(sections)) titulos.set(`/${p.slug}`, p.title);

  const maximo = resumen ? Math.max(1, ...resumen.porDia.map((d) => d.visitas)) : 1;
  const formatoDia = (dia: string) =>
    new Date(`${dia}T12:00:00.000Z`).toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

  return (
    <WebsiteShell workspaceId={workspace.id} status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso}>
      <div className="space-y-5">
        <div className="fo-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--fo-text)]">Visitas</h2>
            <nav className="flex gap-1" aria-label="Período">
              {PERIODOS_VISITAS.map((p) => (
                <Link
                  key={p}
                  href={`/website/visitas?dias=${p}`}
                  aria-current={p === dias ? "page" : undefined}
                  className={[
                    "rounded-lg px-3 py-1.5 text-sm",
                    p === dias ? "bg-[var(--fo-accent)] text-white" : "text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
                  ].join(" ")}
                >
                  {p} días
                </Link>
              ))}
            </nav>
          </div>
          <p className="text-sm text-[var(--fo-muted)]">
            Cuántas veces se abrió cada página de tu sitio. No se cuentan buscadores ni robots, ni las páginas con enlaces personales
            (pedidos, recibos, galerías). No usa cookies ni guarda datos de quien visita. El día va en hora argentina.
          </p>
        </div>

        {resumen === null ? (
          <p className="fo-card text-sm text-[var(--fo-danger)]" role="alert">
            Falta crear la tabla de visitas en la base. Avisale al administrador.
          </p>
        ) : (
          <>
            <div className="fo-card space-y-3">
              <p className="text-sm text-[var(--fo-muted)]">
                Total de los últimos {dias} días:{" "}
                <strong className="text-2xl font-semibold text-[var(--fo-text)]">{resumen.total.toLocaleString("es-AR")}</strong>
              </p>
              {/* Gráfico simple por día: una barra por día, con el número al pasar el mouse. */}
              <div className="flex h-32 items-end gap-px" role="img" aria-label={`Visitas por día de los últimos ${dias} días`}>
                {resumen.porDia.map((d) => (
                  <div
                    key={d.dia}
                    title={`${formatoDia(d.dia)}: ${d.visitas.toLocaleString("es-AR")} visitas`}
                    className="min-w-0 flex-1 rounded-t-sm bg-[var(--fo-accent)]"
                    style={{ height: `${d.visitas === 0 ? 0 : Math.max(3, Math.round((d.visitas / maximo) * 100))}%`, opacity: d.visitas === 0 ? 0 : 0.85 }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-[var(--fo-muted)]">
                <span>{formatoDia(resumen.porDia[0].dia)}</span>
                <span>Hoy</span>
              </div>
            </div>

            <div className="fo-card space-y-2">
              <h3 className="text-sm font-semibold text-[var(--fo-text)]">Por página</h3>
              {resumen.porPagina.length === 0 ? (
                <p className="text-sm text-[var(--fo-muted)]">Todavía no hay visitas en este período.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--fo-muted)]">
                      <th className="py-1 font-medium">Página</th>
                      <th className="py-1 text-right font-medium">Visitas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--fo-border)]">
                    {resumen.porPagina.slice(0, 200).map((p) => (
                      <tr key={p.ruta}>
                        <td className="py-1.5 pr-3">
                          {titulos.get(p.ruta) ? <span className="text-[var(--fo-text)]">{titulos.get(p.ruta)} </span> : null}
                          <span className="text-xs text-[var(--fo-muted)]">{p.ruta}</span>
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{p.visitas.toLocaleString("es-AR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </WebsiteShell>
  );
}
