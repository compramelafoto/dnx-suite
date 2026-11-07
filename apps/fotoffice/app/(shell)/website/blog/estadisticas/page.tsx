import Link from "next/link";
import { BlogShell } from "@/components/website/blog/blog-shell";
import { requireBlogEditor } from "@/lib/blog/access";
import { loadPublicSlug } from "@/lib/blog/admin-queries";
import { BLOG_ADMIN_BASE } from "@/lib/blog/admin-nav";
import { postPath } from "@/lib/blog/public";
import { BLOG_STATS_PERIODS, parseBlogStatsPeriod } from "@/lib/blog/stats";
import { loadBlogStats } from "@/lib/blog/stats.server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ dias?: string }> };

const fmt = (n: number) => n.toLocaleString("es-AR");

const dayLabel = (day: string) => {
  const [, m, d] = day.split("-");
  return `${Number(d)}/${Number(m)}`;
};

export default async function BlogStatsPage({ searchParams }: Props) {
  const { workspace } = await requireBlogEditor();
  const period = parseBlogStatsPeriod((await searchParams).dias);
  const [stats, publicSlug] = await Promise.all([loadBlogStats(workspace.id, period), loadPublicSlug(workspace.id)]);
  const max = Math.max(1, ...stats.byDay.map((d) => d.reads));
  // Con 90 barras no entran todas las fechas: se rotula una de cada tantas.
  const labelEvery = period === 7 ? 1 : period === 30 ? 5 : 15;

  return (
    <BlogShell title="Estadísticas del blog" description="Cuánta gente lee tus artículos y cuáles interesan más.">
      <div className="space-y-5">
        <nav className="flex gap-2" aria-label="Período">
          {BLOG_STATS_PERIODS.map((p) => (
            <Link
              key={p}
              href={`${BLOG_ADMIN_BASE}/estadisticas?dias=${p}`}
              aria-current={p === period ? "page" : undefined}
              className={`fo-btn text-sm ${p === period ? "fo-btn-primary" : "fo-btn-secondary"}`}
            >
              Últimos {p} días
            </Link>
          ))}
        </nav>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Lectores" value={stats.readers} help="Personas distintas que leyeron al menos un artículo." />
          <Stat label="Lecturas" value={stats.reads} help="Artículos abiertos. Releer el mismo artículo no suma." />
          <Stat label="Artículos leídos" value={stats.postsRead} help="Cuántos artículos distintos tuvieron lectores." />
        </div>

        <section className="fo-card space-y-3">
          <h2 className="text-sm font-semibold text-[var(--fo-text)]">Lecturas por día</h2>
          <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={`Lecturas por día en los últimos ${period} días`}>
            {stats.byDay.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${dayLabel(d.day)}: ${fmt(d.reads)} lecturas`}>
                <div
                  className="w-full rounded-t-sm bg-[var(--fo-accent)]"
                  style={{ height: d.reads ? `${Math.max(4, (d.reads / max) * 100)}%` : "1px", opacity: d.reads ? 1 : 0.25 }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-[2px] text-[10px] text-[var(--fo-muted)]">
            {stats.byDay.map((d, i) => (
              <span key={d.day} className="flex-1 overflow-visible whitespace-nowrap text-center">
                {i % labelEvery === 0 || i === stats.byDay.length - 1 ? dayLabel(d.day) : ""}
              </span>
            ))}
          </div>
        </section>

        <section className="fo-card space-y-3">
          <h2 className="text-sm font-semibold text-[var(--fo-text)]">Artículos más leídos</h2>
          {stats.topPosts.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">Nadie leyó artículos en este período todavía.</p>
          ) : (
            <ol className="divide-y divide-[var(--fo-border)]">
              {stats.topPosts.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-5 shrink-0 text-right tabular-nums text-[var(--fo-muted)]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`${BLOG_ADMIN_BASE}/${p.id}`} className="font-medium text-[var(--fo-text)] hover:text-[var(--fo-accent)]">
                      {p.title}
                    </Link>
                    {publicSlug ? (
                      <a href={postPath(publicSlug, p.slug)} target="_blank" rel="noreferrer" className="ml-2 text-xs text-[var(--fo-accent)] hover:underline">
                        Ver
                      </a>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular-nums font-semibold text-[var(--fo-text)]">{fmt(p.reads)}</p>
                    <p className="text-xs text-[var(--fo-muted)]">{fmt(p.totalReads)} en total</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <p className="fo-helper">
          {stats.trackingSince
            ? `Se cuentan lecturas desde el ${stats.trackingSince.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}. `
            : "Todavía no hay lecturas registradas. "}
          Una persona que relee el mismo artículo cuenta una sola vez. No se miden los clics ni las visitas a la portada del blog.
        </p>
      </div>
    </BlogShell>
  );
}

function Stat({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <div className="fo-card space-y-1">
      <p className="text-xs font-medium text-[var(--fo-muted)]">{label}</p>
      <p className="text-3xl font-semibold tabular-nums text-[var(--fo-text)]">{fmt(value)}</p>
      <p className="fo-helper">{help}</p>
    </div>
  );
}
