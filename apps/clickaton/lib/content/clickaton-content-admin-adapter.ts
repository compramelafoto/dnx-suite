/**
 * Adaptadores cliente para el CMS compartido (`@repo/content-ui`).
 * Solo fetch a las APIs admin de Clickatón: el paquete no hardcodea rutas.
 */
import type {
  ContentMediaAdapter,
  ContentMediaItem,
  ContentPostFormSubmitPayload,
  ContentPostSubmitResult,
} from "@repo/content-ui";

export const CONTENT_ADMIN_API_BASE = "/api/admin/content";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function errorMessage(data: Record<string, unknown>, fallback: string): string {
  return String(data.details || data.error || fallback);
}

export function createClickatonContentMediaAdapter(): ContentMediaAdapter {
  return {
    async listMedia(input) {
      const params = new URLSearchParams();
      if (input?.q?.trim()) params.set("q", input.q.trim());
      params.set("limit", String(input?.limit ?? 100));
      const res = await fetch(`${CONTENT_ADMIN_API_BASE}/media?${params.toString()}`, {
        credentials: "include",
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorMessage(data, "Error cargando multimedia"));
      return (data.media as ContentMediaItem[]) || [];
    },
    async uploadMedia(file) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${CONTENT_ADMIN_API_BASE}/media`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorMessage(data, "Error subiendo imagen"));
      return data.media as ContentMediaItem;
    },
    async updateMedia(id, meta) {
      const res = await fetch(`${CONTENT_ADMIN_API_BASE}/media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(meta),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorMessage(data, "Error guardando"));
      return data.media as ContentMediaItem;
    },
    async deleteMedia(id) {
      const res = await fetch(`${CONTENT_ADMIN_API_BASE}/media/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(errorMessage(await readJson(res), "Error eliminando"));
      }
    },
    async uploadHero(file) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${CONTENT_ADMIN_API_BASE}/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorMessage(data, "Error subiendo imagen"));
      return { url: String(data.heroImageUrl || data.url || "") };
    },
  };
}

export type ContentTaxonomyOption = { id: number; name: string; slug?: string };

export async function loadClickatonContentTaxonomyOptions(): Promise<{
  categories: ContentTaxonomyOption[];
  tags: ContentTaxonomyOption[];
  authors: ContentTaxonomyOption[];
}> {
  const [catRes, tagRes, authorRes] = await Promise.all([
    fetch(`${CONTENT_ADMIN_API_BASE}/categories`, { credentials: "include" }),
    fetch(`${CONTENT_ADMIN_API_BASE}/tags`, { credentials: "include" }),
    fetch(`${CONTENT_ADMIN_API_BASE}/authors?active=1`, { credentials: "include" }),
  ]);
  const [catData, tagData, authorData] = await Promise.all([
    readJson(catRes),
    readJson(tagRes),
    readJson(authorRes),
  ]);
  return {
    categories: (catData.categories as ContentTaxonomyOption[]) || [],
    tags: (tagData.tags as ContentTaxonomyOption[]) || [],
    authors: (authorData.authors as ContentTaxonomyOption[]) || [],
  };
}

export async function submitClickatonContentPost(input: {
  mode: "create" | "edit";
  postId?: number;
  data: ContentPostFormSubmitPayload;
}): Promise<ContentPostSubmitResult> {
  const res = await fetch(
    input.mode === "create"
      ? `${CONTENT_ADMIN_API_BASE}/posts`
      : `${CONTENT_ADMIN_API_BASE}/posts/${input.postId}`,
    {
      method: input.mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input.data),
    },
  );
  const data = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(data, "Error guardando la nota"));

  const post = data.post as { id?: number; status?: string; slug?: string } | undefined;
  return {
    id: post?.id,
    status: String(post?.status || input.data.status),
    slug: String(post?.slug || input.data.slug || ""),
  };
}

export async function deleteClickatonContentPost(postId: number): Promise<void> {
  const res = await fetch(`${CONTENT_ADMIN_API_BASE}/posts/${postId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(errorMessage(await readJson(res), "Error eliminando"));
  }
}
