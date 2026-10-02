/**
 * Lo que el panel del blog le pide al servidor desde el navegador.
 *
 * `@repo/content-ui` no conoce rutas: recibe adaptadores. Acá están los de FOTOFFICE, todos
 * contra `/api/website/blog`. Ninguno manda la institución: el servidor la saca de la sesión.
 */
import type {
  ContentMediaAdapter,
  ContentMediaItem,
  ContentOption,
  ContentPostFormSubmitPayload,
  ContentPostSubmitResult,
} from "@repo/content-ui";

export const BLOG_API_BASE = "/api/website/blog";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

export function errorMessage(data: Record<string, unknown>, fallback: string): string {
  return String(data.details || data.error || fallback);
}

async function subir(file: File, kind: "hero" | "media"): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch(`${BLOG_API_BASE}/media`, { method: "POST", credentials: "include", body: form });
  const data = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(data, "No se pudo subir la imagen"));
  return data;
}

export function createBlogMediaAdapter(): ContentMediaAdapter {
  return {
    async listMedia(input) {
      const params = new URLSearchParams();
      if (input?.q?.trim()) params.set("q", input.q.trim());
      params.set("limit", String(input?.limit ?? 100));
      const res = await fetch(`${BLOG_API_BASE}/media?${params.toString()}`, { credentials: "include" });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorMessage(data, "No se pudo cargar la biblioteca"));
      return (data.media as ContentMediaItem[]) || [];
    },
    async uploadMedia(file) {
      return (await subir(file, "media")).media as ContentMediaItem;
    },
    async updateMedia(id, meta) {
      const res = await fetch(`${BLOG_API_BASE}/media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(meta),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorMessage(data, "No se pudo guardar"));
      return data.media as ContentMediaItem;
    },
    async deleteMedia(id) {
      const res = await fetch(`${BLOG_API_BASE}/media/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(errorMessage(await readJson(res), "No se pudo eliminar"));
    },
    // La portada usa el mismo endpoint con otro tamaño de referencia (16:9): así queda también
    // en la biblioteca y no hace falta una ruta aparte como en Clickatón.
    async uploadHero(file) {
      const data = await subir(file, "hero");
      return { url: String(data.heroImageUrl || data.url || "") };
    },
  };
}

export async function loadBlogTaxonomyOptions(): Promise<{
  categories: ContentOption[];
  tags: ContentOption[];
  authors: ContentOption[];
}> {
  const [cat, tag, aut] = await Promise.all([
    fetch(`${BLOG_API_BASE}/categories`, { credentials: "include" }).then(readJson),
    fetch(`${BLOG_API_BASE}/tags`, { credentials: "include" }).then(readJson),
    fetch(`${BLOG_API_BASE}/authors?active=1`, { credentials: "include" }).then(readJson),
  ]);
  return {
    categories: (cat.categories as ContentOption[]) || [],
    tags: (tag.tags as ContentOption[]) || [],
    authors: (aut.authors as ContentOption[]) || [],
  };
}

export async function submitBlogPost(input: {
  mode: "create" | "edit";
  postId?: number;
  data: ContentPostFormSubmitPayload;
}): Promise<ContentPostSubmitResult> {
  const res = await fetch(input.mode === "create" ? `${BLOG_API_BASE}/posts` : `${BLOG_API_BASE}/posts/${input.postId}`, {
    method: input.mode === "create" ? "POST" : "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input.data),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(data, "No se pudo guardar el artículo"));

  const post = data.post as { id?: number; status?: string; slug?: string } | undefined;
  return {
    id: post?.id,
    status: String(post?.status || input.data.status),
    slug: String(post?.slug || input.data.slug || ""),
  };
}

export async function deleteBlogPostRequest(postId: number): Promise<void> {
  const res = await fetch(`${BLOG_API_BASE}/posts/${postId}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(errorMessage(await readJson(res), "No se pudo eliminar el artículo"));
}
