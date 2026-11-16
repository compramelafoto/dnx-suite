import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { resolvePortfolioViewerContext } from "@/lib/portfolio/admin-access";
import { loadPortfoliosForAdmin, summarizePortfolios } from "@/lib/portfolio/admin-queries";
import { PortfolioAdminRow } from "@/components/portfolios/portfolio-admin-row";
import { PortfoliosDelEstudio } from "@/components/portfolios/estudio/portfolios-del-estudio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portfolios" };

/**
 * Lo que la institución ve de los portfolios de su gente.
 *
 * Arriba, tres números. El tercero —cuántos todavía no subieron nada— es el que vuelve útil la
 * pantalla al principio: cuando el módulo se enciende, la pregunta no es "qué bajo" sino "a quién
 * le recuerdo que cargue sus fotos".
 *
 * La tabla lista a TODO el padrón, no sólo a quienes publicaron, por la misma razón.
 */
type Props = { searchParams: Promise<{ vista?: string }> };

/**
 * Dos solapas (spec 2026-11-15): «De los socios» (lo de siempre) y «Del estudio» (los trabajos del
 * estudio por rubro y estilo, para la vendedora). Sin socios en el padrón —un estudio— no hay
 * solapas: se abre directo en «Del estudio».
 */
export default async function PortfoliosPage({ searchParams }: Props) {
  // Con VIEW se mira en sólo lectura; bajar y publicar piden MANAGE (y la acción lo vuelve a pedir).
  const ctx = await resolvePortfolioViewerContext();
  // Sin permiso, sin workspace o con el módulo apagado: la pantalla no existe.
  if (!ctx) redirect("/dashboard");

  const { vista } = await searchParams;
  const socios = await prisma.member.count({ where: { workspaceId: ctx.workspace.id } });
  const estudio = socios === 0 || vista === "estudio";

  if (estudio) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Portfolios del estudio"
          description="Los trabajos publicados, ordenados para mandarle a cada cliente el que corresponde."
        />
        {socios > 0 ? <Solapas activa="estudio" /> : null}
        <PortfoliosDelEstudio userId={ctx.user.id} workspaceId={ctx.workspace.id} puedeAdministrar={ctx.canManage} />
      </div>
    );
  }

  const [vocabulario, filas] = await Promise.all([
    loadPersonVocabulary(ctx.workspace.id),
    loadPortfoliosForAdmin(ctx.workspace.id),
  ]);
  const resumen = summarizePortfolios(filas);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolios"
        description={`La obra que cada ${vocabulario.singular} publica en el sitio de la institución.`}
      />
      <Solapas activa="socios" />

      <section className="grid gap-4 sm:grid-cols-3">
        <Numero valor={resumen.publicados} etiqueta="Publicados" />
        <Numero valor={resumen.armadosSinPublicar} etiqueta="Armados, sin publicar" />
        <Numero
          valor={resumen.sinPortfolio}
          etiqueta="Sin ninguna foto"
          ayuda="A quienes todavía hay que recordarles que carguen su obra."
        />
      </section>

      {filas.length === 0 ? (
        <section className="fo-card">
          <p className="text-sm text-[var(--fo-muted)]">
            Todavía no hay {vocabulario.plural} en el padrón.
          </p>
        </section>
      ) : (
        <section className="fo-card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">
                <th className="pb-2 pr-4 font-medium">{vocabulario.Singular}</th>
                <th className="pb-2 pr-4 font-medium">Fotos</th>
                <th className="pb-2 pr-4 font-medium">Estado</th>
                {ctx.canManage ? <th className="pb-2 font-medium">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <PortfolioAdminRow key={fila.memberId} fila={fila} puedeGestionar={ctx.canManage} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-xs text-[var(--fo-muted)]">
        La institución puede sacar un portfolio del sitio, pero nunca editar ni borrar las fotos de
        nadie: la obra es de quien la hizo.
      </p>
    </div>
  );
}

function Solapas({ activa }: { activa: "socios" | "estudio" }) {
  const solapas = [
    { key: "socios", label: "De los socios", href: "/portfolios" },
    { key: "estudio", label: "Del estudio", href: "/portfolios?vista=estudio" },
  ] as const;
  return (
    <nav className="flex gap-1 border-b border-[var(--fo-border)]" aria-label="Portfolios">
      {solapas.map((s) => (
        <Link
          key={s.key}
          href={s.href}
          aria-current={s.key === activa ? "page" : undefined}
          className={[
            "-mb-px border-b-2 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors",
            s.key === activa
              ? "border-[var(--fo-accent)] text-[var(--fo-text)]"
              : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
          ].join(" ")}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

function Numero({
  valor,
  etiqueta,
  ayuda,
}: {
  valor: number;
  etiqueta: string;
  ayuda?: string;
}) {
  return (
    <div className="fo-card">
      <p className="text-2xl font-semibold">{valor}</p>
      <p className="text-sm">{etiqueta}</p>
      {ayuda ? <p className="mt-1 text-xs text-[var(--fo-muted)]">{ayuda}</p> : null}
    </div>
  );
}
