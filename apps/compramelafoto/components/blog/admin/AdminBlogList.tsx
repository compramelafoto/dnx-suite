"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import BlogAdminNav from "@/components/blog/admin/BlogAdminNav";
import BlogAdminPageShell from "@/components/blog/admin/BlogAdminPageShell";
import {
  BLOG_POST_STATUS_COLORS,
  BLOG_POST_STATUS_LABELS,
  BLOG_POST_TYPE_LABELS,
  formatBlogAdminDate,
} from "@/components/blog/admin/blog-admin-constants";
import type { AdminBlogPostRow } from "@/lib/blog/admin-blog-types";

export type { AdminBlogPostRow };

type AdminBlogListProps = {
  initialPosts: AdminBlogPostRow[];
  loadError?: string | null;
};

export default function AdminBlogList({ initialPosts, loadError }: AdminBlogListProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [fetchError, setFetchError] = useState<string | null>(loadError ?? null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!loadError && initialPosts.length > 0) return;

    async function loadFromApi() {
      try {
        const res = await fetch("/api/admin/blog/posts", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFetchError(data.error || `Error ${res.status} al cargar artículos`);
          return;
        }
        const rows = (data.posts || []) as Array<Record<string, unknown>>;
        setPosts(
          rows.map((post) => ({
            id: post.id as number,
            title: post.title as string,
            slug: post.slug as string,
            status: post.status as string,
            type: post.type as string,
            isFeatured: Boolean(post.isFeatured),
            publishedAt: post.publishedAt
              ? new Date(post.publishedAt as string).toISOString()
              : null,
            viewCount: Number(post.viewCount) || 0,
            category: (post.category as AdminBlogPostRow["category"]) ?? null,
            author: post.author
              ? {
                  id: (post.author as { id: number }).id,
                  name: (post.author as { name: string }).name,
                  slug: (post.author as { slug: string }).slug,
                }
              : null,
          }))
        );
        setFetchError(null);
      } catch {
        setFetchError("Error de conexión al cargar artículos");
      }
    }

    void loadFromApi();
  }, [initialPosts.length, loadError]);

  const filtered = useMemo(() => {
    let rows = posts;
    if (statusFilter) rows = rows.filter((p) => p.status === statusFilter);
    if (typeFilter) rows = rows.filter((p) => p.type === typeFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [posts, statusFilter, typeFilter, query]);

  const draftCount = posts.filter((p) => p.status === "DRAFT").length;

  return (
    <BlogAdminPageShell>
      <BlogAdminNav />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog</h1>
          <p className="text-sm text-gray-500">
            Artículos, categorías y contenido editorial.
            {posts.length > 0 ? (
              <span className="ml-1 text-gray-700">
                ({posts.length} total{draftCount > 0 ? `, ${draftCount} borradores` : ""})
              </span>
            ) : null}
          </p>
        </div>
        <Link href="/admin/blog/new">
          <Button>Nuevo artículo</Button>
        </Link>
      </div>

      {fetchError ? (
        <div className="blog-admin-panel rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {fetchError}
        </div>
      ) : null}

      <div className="blog-admin-panel rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
        Los borradores solo se ven acá en <strong>Admin → Blog</strong>. No aparecen en{" "}
        <Link href="/blog" className="underline">
          /blog
        </Link>{" "}
        hasta publicarlos.
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título o slug"
          className="w-full sm:w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(BLOG_POST_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(BLOG_POST_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="blog-admin-panel rounded-xl border border-gray-200 bg-white p-8 md:p-12">
          <p className="blog-admin-copy text-base text-gray-600">
            {posts.length === 0
              ? "No hay artículos en esta base de datos."
              : "Ningún artículo coincide con los filtros."}
          </p>
          {posts.length === 0 ? (
            <div className="blog-admin-panel mt-4 rounded-lg bg-gray-50 p-5 text-sm leading-relaxed text-gray-700 space-y-3">
              <p className="font-medium text-gray-900">Cargar borradores Fase 7 (en esta base):</p>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-gray-900 p-4 text-sm leading-relaxed text-gray-100">
                {`npx prisma migrate deploy
npm run seed:blog:all`}
              </pre>
              <p className="text-sm text-gray-500">
                El deploy en Vercel no ejecuta el seed: hay que correrlo contra la{" "}
                <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">DATABASE_URL</code> de producción.
              </p>
            </div>
          ) : null}
          <div className="mt-6">
            <Link href="/admin/blog/new">
              <Button>Crear artículo</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="blog-admin-panel rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Autor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destacado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Publicado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vistas únicas</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{post.title}</div>
                    <div className="text-xs text-gray-500">/blog/{post.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        BLOG_POST_STATUS_COLORS[post.status] ?? "bg-gray-100"
                      }`}
                    >
                      {BLOG_POST_STATUS_LABELS[post.status] ?? post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{post.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{post.author?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {BLOG_POST_TYPE_LABELS[post.type] ?? post.type}
                  </td>
                  <td className="px-4 py-3">{post.isFeatured ? "★" : "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{formatBlogAdminDate(post.publishedAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{post.viewCount}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/admin/blog/${post.id}`} className="text-[#c27b3d] hover:underline">
                        Editar
                      </Link>
                      {post.status === "PUBLISHED" ? (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gray-500 hover:underline"
                        >
                          Ver en blog
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BlogAdminPageShell>
  );
}
