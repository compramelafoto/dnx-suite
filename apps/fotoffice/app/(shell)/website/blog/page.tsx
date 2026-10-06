import Link from "next/link";
import { parseContentPostStatusFilter } from "@repo/content";
import { BlogShell } from "@/components/website/blog/blog-shell";
import { requireBlogEditor } from "@/lib/blog/access";
import { listBlogAdminPosts, loadPublicSlug } from "@/lib/blog/admin-queries";
import { BLOG_STATUS_FILTERS, BLOG_STATUS_LABELS, blogDisplayStatus, formatBlogDate } from "@/lib/blog/admin-labels";
import { BLOG_ADMIN_BASE } from "@/lib/blog/admin-nav";
import { postPath } from "@/lib/blog/public";
import { countExternalBlogImages } from "@/lib/blog/localize-images";
import { LocalizeImagesButton } from "@/components/website/blog/localize-images-button";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ status?: string; q?: string }> };

const STATUS_PILL: Record<string, string> = {
  PUBLISHED: "bg-[var(--fo-success-soft)] text-[var(--fo-success)] border-[var(--fo-success-border)]",
  DRAFT: "bg-[var(--fo-border-muted)] text-[var(--fo-muted)] border-[var(--fo-border)]",
  ARCHIVED: "bg-[var(--fo-warning-soft)] text-[var(--fo-warning)] border-[var(--fo-warning-border)]",
  SCHEDULED: "bg-[var(--fo-accent-soft)] text-[var(--fo-accent)] border-[var(--fo-accent)]",
};

export default async function BlogPostsPage({ searchParams }: Props) {
  const { workspace } = await requireBlogEditor();
  const params = await searchParams;
  // Un estado inventado en la dirección se ignora en vez de dar una lista vacía sin explicación.
  const status = parseContentPostStatusFilter(params.status ?? null);
  const q = params.q?.trim() || "";

  const [posts, publicSlug, externas] = await Promise.all([
    listBlogAdminPosts(workspace.id, { status, q: q || null }),
    loadPublicSlug(workspace.id),
    countExternalBlogImages(workspace.id),
  ]);
  const filtrando = Boolean(status || q);

  return (
    <BlogShell
      actions={
        <Link href={`${BLOG_ADMIN_BASE}/nuevo`} className="fo-btn fo-btn-primary">
          Nuevo artículo
        </Link>
      }
    >
      <div className="space-y-4">
        {externas > 0 ? <LocalizeImagesButton pendientes={externas} /> : null}
        <form className="fo-card grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end" role="search">
          <label className="block">
            <span className="fo-label">Buscar</span>
            <input name="q" defaultValue={q} placeholder="Título o dirección" className="fo-input" />
          </label>
          <label className="block">
            <span className="fo-label">Estado</span>
            <select name="status" defaultValue={status ?? ""} className="fo-input">
              {BLOG_STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="fo-btn fo-btn-secondary">
              Filtrar
            </button>
            {filtrando ? (
              <Link href={BLOG_ADMIN_BASE} className="fo-btn fo-btn-ghost">
                Limpiar
              </Link>
            ) : null}
          </div>
        </form>

        {posts.length === 0 ? (
          <div className="fo-card py-12 text-center">
            {filtrando ? (
              <p className="text-sm text-[var(--fo-muted)]">Ningún artículo coincide con el filtro.</p>
            ) : (
              <>
                <p className="text-base font-semibold text-[var(--fo-text)]">Todavía no hay artículos</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--fo-muted)]">
                  Escribí el primero: lo podés guardar como borrador y publicarlo cuando esté listo. Categorías,
                  tags y autores son opcionales y se pueden cargar después.
                </p>
                <div className="mt-6 flex justify-center">
                  <Link href={`${BLOG_ADMIN_BASE}/nuevo`} className="fo-btn fo-btn-primary">
                    Nuevo artículo
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : (
          /*
            En el teléfono se ven título y estado; categoría, fecha y vistas son de consulta y se
            esconden para que la tabla no haya que arrastrarla de costado.
          */
          <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Artículo</th>
                  <th className="px-4 py-3 font-semibold w-32">Estado</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Categoría</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Publicado</th>
                  <th className="hidden px-4 py-3 font-semibold text-right lg:table-cell">Vistas</th>
                  <th className="px-4 py-3 font-semibold w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
                {posts.map((post) => {
                  const estado = blogDisplayStatus(post.status, post.publishedAt);
                  return (
                  <tr key={post.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`${BLOG_ADMIN_BASE}/${post.id}`}
                        className="font-medium text-[var(--fo-text)] hover:text-[var(--fo-accent)]"
                      >
                        {post.title}
                      </Link>
                      {post.isFeatured ? (
                        <span className="ml-2 text-xs text-[var(--fo-accent)]">Destacado</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_PILL[estado] ?? STATUS_PILL.DRAFT}`}
                      >
                        {BLOG_STATUS_LABELS[estado] ?? estado}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--fo-muted)] md:table-cell">{post.category?.name ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-[var(--fo-muted)] lg:table-cell">{formatBlogDate(post.publishedAt)}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-[var(--fo-muted)] lg:table-cell">
                      {post.viewCount.toLocaleString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {estado === "PUBLISHED" && publicSlug ? (
                        <a
                          href={postPath(publicSlug, post.slug)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-[var(--fo-accent)] hover:underline"
                        >
                          Ver
                        </a>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BlogShell>
  );
}
