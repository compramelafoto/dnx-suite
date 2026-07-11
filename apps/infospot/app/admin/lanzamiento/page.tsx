import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@repo/db";
import {
  archiveAllDemoContentAction,
  previewArchiveDemoCounts,
} from "@/app/actions/clf-draft";
import { updateContentTagAction } from "@/app/actions/settings";
import { PageShell } from "@/components/page-shell";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { CONTENT_TAG_LABELS } from "@/lib/launch-content";
import {
  canManageInfoSpotSettings,
  requireInfoSpotAdminAccess,
} from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Lanzamiento — contenido",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ tag?: string; ok?: string; error?: string }>;
};

async function ArchiveDemoPanel() {
  const counts = await previewArchiveDemoCounts();
  if (counts.articles === 0 && counts.events === 0) {
    return (
      <p className="mb-6 rounded-[var(--is-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        No hay contenido DEMO pendiente de archivar.
      </p>
    );
  }
  return (
    <div className="mb-8 rounded-[var(--is-radius)] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
      <p className="font-semibold">Archivar todo el contenido DEMO</p>
      <p className="mt-2">
        Afectará <strong>{counts.articles}</strong> artículo(s) y{" "}
        <strong>{counts.events}</strong> evento(s). Pasan a ARCHIVED; no se borran.
      </p>
      <form action={archiveAllDemoContentAction} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-xs font-semibold uppercase tracking-wide">
          Escribí ARCHIVAR_DEMO para confirmar
          <input
            name="confirm"
            required
            className="mt-2 block w-full min-w-[16rem] rounded border border-amber-400 bg-white px-3 py-2 text-sm normal-case tracking-normal"
            placeholder="ARCHIVAR_DEMO"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-amber-900 px-4 text-sm font-semibold text-white"
        >
          Archivar DEMO
        </button>
      </form>
    </div>
  );
}

export default async function AdminLanzamientoPage({ searchParams }: Props) {
  const access = await requireInfoSpotAdminAccess();
  if (!canManageInfoSpotSettings(access.subject)) {
    return (
      <PageShell title="Lanzamiento" description="Solo el Director puede gestionar etiquetas de lanzamiento.">
        <p className="text-sm text-[var(--is-muted)]">Sin permiso.</p>
      </PageShell>
    );
  }

  const params = await searchParams;
  const tagFilter =
    params.tag === "DEMO" || params.tag === "REAL" || params.tag === "NEEDS_REVIEW"
      ? params.tag
      : undefined;

  const [articles, events, counts] = await Promise.all([
    prisma.infoSpotArticle.findMany({
      where: tagFilter ? { contentTag: tagFilter } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        contentTag: true,
        coverImageId: true,
        publishedAt: true,
      },
    }),
    prisma.infoSpotEvent.findMany({
      where: tagFilter ? { contentTag: tagFilter } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        contentTag: true,
        coverImageUrl: true,
        startAt: true,
      },
    }),
    Promise.all([
      prisma.infoSpotArticle.groupBy({ by: ["contentTag"], _count: true }),
      prisma.infoSpotEvent.groupBy({ by: ["contentTag"], _count: true }),
    ]),
  ]);

  const [articleCounts, eventCounts] = counts;

  return (
    <PageShell
      title="Contenido de lanzamiento"
      description="Etiquetas internas DEMO / REAL / NEEDS_REVIEW. No se muestran en el sitio público."
    >
      <div className="mb-6 flex flex-wrap gap-4 text-sm">
        <Link href="/admin" className="text-[var(--is-accent)] hover:underline">
          ← Admin
        </Link>
        <Link href="/admin/configuracion" className="text-[var(--is-accent)] hover:underline">
          Configuración
        </Link>
      </div>

      <FlashBanner
        ok={
          params.ok === "tagged"
            ? "Etiqueta actualizada."
            : params.ok
              ? params.ok
              : null
        }
        error={params.error}
      />

      <ArchiveDemoPanel />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {(["DEMO", "REAL", "NEEDS_REVIEW"] as const).map((tag) => {
          const a = articleCounts.find((c) => c.contentTag === tag)?._count ?? 0;
          const e = eventCounts.find((c) => c.contentTag === tag)?._count ?? 0;
          return (
            <Link
              key={tag}
              href={`/admin/lanzamiento?tag=${tag}`}
              className={`rounded-[var(--is-radius)] border p-4 ${
                tagFilter === tag
                  ? "border-[var(--is-accent)] bg-[var(--is-accent-soft)]"
                  : "border-[var(--is-border)]"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide">{tag}</p>
              <p className="mt-2 text-sm text-[var(--is-text-secondary)]">
                {a} noticias · {e} eventos
              </p>
            </Link>
          );
        })}
      </div>

      <p className="mb-4 text-sm text-[var(--is-muted)]">
        Stock fotográfico temporal e imágenes sin portada real también deben reemplazarse
        antes del 15/07. Revisá portadas vacías y slugs <code>demo-*</code>.
      </p>

      <section className="space-y-4">
        <h2 className="is-h3 text-xl">Noticias</h2>
        <div className="overflow-x-auto rounded-[var(--is-radius)] border border-[var(--is-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-[var(--is-bg-elevated)] text-xs uppercase text-[var(--is-muted)]">
              <tr>
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Tag</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Portada</th>
                <th className="px-3 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-3">
                    <Link
                      href={`/redaccion/noticias/${a.id}/editar`}
                      className="font-medium text-[var(--is-accent)] hover:underline"
                    >
                      {a.title}
                    </Link>
                    <p className="text-xs text-[var(--is-muted)]">{a.slug}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-[var(--is-bg-elevated)] px-2 py-0.5 text-xs">
                      {CONTENT_TAG_LABELS[a.contentTag]}
                    </span>
                  </td>
                  <td className="px-3 py-3">{a.status}</td>
                  <td className="px-3 py-3">{a.coverImageId ? "Sí" : "No"}</td>
                  <td className="px-3 py-3">
                    <form
                      action={updateContentTagAction.bind(null, "article", a.id)}
                      className="flex gap-2"
                    >
                      <select
                        name="contentTag"
                        defaultValue={a.contentTag}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        <option value="DEMO">DEMO</option>
                        <option value="REAL">REAL</option>
                        <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                      </select>
                      <button type="submit" className="text-xs text-[var(--is-accent)]">
                        Guardar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="is-h3 text-xl">Eventos</h2>
        <div className="overflow-x-auto rounded-[var(--is-radius)] border border-[var(--is-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-[var(--is-bg-elevated)] text-xs uppercase text-[var(--is-muted)]">
              <tr>
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Tag</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Portada</th>
                <th className="px-3 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/eventos/${e.id}`}
                      className="font-medium text-[var(--is-accent)] hover:underline"
                    >
                      {e.title}
                    </Link>
                    <p className="text-xs text-[var(--is-muted)]">{e.slug}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-[var(--is-bg-elevated)] px-2 py-0.5 text-xs">
                      {CONTENT_TAG_LABELS[e.contentTag]}
                    </span>
                  </td>
                  <td className="px-3 py-3">{e.status}</td>
                  <td className="px-3 py-3">{e.coverImageUrl ? "Sí" : "Stock/fallback"}</td>
                  <td className="px-3 py-3">
                    <form
                      action={updateContentTagAction.bind(null, "event", e.id)}
                      className="flex gap-2"
                    >
                      <select
                        name="contentTag"
                        defaultValue={e.contentTag}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        <option value="DEMO">DEMO</option>
                        <option value="REAL">REAL</option>
                        <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                      </select>
                      <button type="submit" className="text-xs text-[var(--is-accent)]">
                        Guardar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
