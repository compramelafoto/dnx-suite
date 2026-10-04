"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageOff, Search } from "lucide-react";
import { listBlogPostsForBannerAction } from "@/app/actions/website-blog-posts";
import type { BlogCardItem } from "@/lib/website/dynamic-data";

/**
 * Elegir el artículo del blog que destaca una placa del banner. Lista los publicados con su
 * portada y un buscador por título: una institución con años de blog tiene cientos.
 */
export function BlogPostPicker({ selectedId, onSelect }: { selectedId: number | undefined; onSelect: (post: BlogCardItem) => void }) {
  const [posts, setPosts] = useState<BlogCardItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Con un artículo ya elegido, la lista arranca cerrada: lo normal es estar mirando la placa.
  const [open, setOpen] = useState(selectedId === undefined);

  useEffect(() => {
    let vivo = true;
    listBlogPostsForBannerAction()
      .then((r) => {
        if (!vivo) return;
        setPosts(r.posts);
        setError(r.error);
      })
      .catch(() => {
        if (vivo) setError("No pudimos leer los artículos del blog. Probá de nuevo en un rato.");
      });
    return () => {
      vivo = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es-AR");
    if (!posts) return [];
    return q ? posts.filter((p) => p.title.toLocaleLowerCase("es-AR").includes(q)) : posts;
  }, [posts, query]);

  const selected = posts?.find((p) => p.id === selectedId);

  return (
    <div className="space-y-2">
      <p className="fo-label">Artículo a destacar</p>

      {selectedId !== undefined && !open ? (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--fo-border)] p-2">
          <PostThumb url={selected?.imageUrl ?? null} />
          <p className="min-w-0 flex-1 truncate text-sm text-[var(--fo-text)]">{selected?.title ?? (posts ? "Ese artículo ya no está publicado" : "Cargando…")}</p>
          <button type="button" className="text-xs font-medium text-[var(--fo-accent)]" onClick={() => setOpen(true)}>
            Cambiar
          </button>
        </div>
      ) : null}

      {open ? (
        <>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fo-muted-soft)]" aria-hidden="true" />
            <input
              type="search"
              className="fo-input w-full"
              // En `style` y no como clase: el padding de `.fo-input` le gana a `pl-8` y la lupa
              // quedaba encima del texto.
              style={{ paddingLeft: "2rem" }}
              placeholder="Buscar por título"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {error ? <p className="text-xs text-[var(--fo-danger)]">{error}</p> : null}
          {!posts && !error ? <p className="fo-helper">Cargando artículos…</p> : null}
          {posts && posts.length === 0 && !error ? (
            <p className="fo-helper">Todavía no hay artículos publicados en el blog.</p>
          ) : null}
          {posts && posts.length > 0 && filtered.length === 0 ? <p className="fo-helper">Ningún artículo tiene ese título.</p> : null}
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {filtered.map((post) => (
              <li key={post.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(post);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={[
                    "flex w-full items-center gap-3 rounded-lg border p-2 text-left",
                    post.id === selectedId ? "border-[var(--fo-accent)]" : "border-[var(--fo-border)] hover:bg-[var(--fo-border-muted)]",
                  ].join(" ")}
                >
                  <PostThumb url={post.imageUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm text-[var(--fo-text)]">{post.title}</span>
                    {post.dateLabel ? <span className="block text-xs text-[var(--fo-muted)]">{post.dateLabel}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {selectedId !== undefined ? (
            <button type="button" className="text-xs text-[var(--fo-muted)]" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function PostThumb({ url }: { url: string | null }) {
  return (
    <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--fo-border)] bg-[var(--fo-bg)]">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageOff className="h-4 w-4 text-[var(--fo-muted-soft)]" aria-hidden="true" />
      )}
    </div>
  );
}
