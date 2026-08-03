import type {
  ContentMediaAdapter,
  ContentMediaItem,
  ContentPostFormSubmitPayload,
  ContentPostSubmitResult,
} from "@repo/content-ui";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

export function createClfContentMediaAdapter(): ContentMediaAdapter {
  return {
    async listMedia(input) {
      const params = new URLSearchParams();
      if (input?.q?.trim()) params.set("q", input.q.trim());
      params.set("limit", String(input?.limit ?? 100));
      const res = await fetch(`/api/admin/blog/media?${params.toString()}`, {
        credentials: "include",
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(String(data.error || "Error cargando multimedia"));
      return (data.media as ContentMediaItem[]) || [];
    },
    async uploadMedia(file) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/blog/media", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(String(data.error || "Error subiendo imagen"));
      return data.media as ContentMediaItem;
    },
    async updateMedia(id, meta) {
      const res = await fetch(`/api/admin/blog/media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(meta),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(String(data.error || data.details || "Error guardando"));
      return data.media as ContentMediaItem;
    },
    async deleteMedia(id) {
      const res = await fetch(`/api/admin/blog/media/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await readJson(res);
        throw new Error(String(data.error || "Error eliminando"));
      }
    },
    async uploadHero(file) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/blog/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(String(data.error || "Error subiendo imagen"));
      return { url: String(data.heroImageUrl || data.url || "") };
    },
  };
}

export async function loadClfContentTaxonomyOptions(): Promise<{
  categories: { id: number; name: string; slug?: string }[];
  tags: { id: number; name: string; slug?: string }[];
  authors: { id: number; name: string; slug?: string }[];
}> {
  const [catRes, tagRes, authorRes] = await Promise.all([
    fetch("/api/admin/blog/categories", { credentials: "include" }),
    fetch("/api/admin/blog/tags", { credentials: "include" }),
    fetch("/api/admin/blog/authors?active=1", { credentials: "include" }),
  ]);
  const [catData, tagData, authorData] = await Promise.all([
    readJson(catRes),
    readJson(tagRes),
    readJson(authorRes),
  ]);
  return {
    categories: (catData.categories as { id: number; name: string; slug?: string }[]) || [],
    tags: (tagData.tags as { id: number; name: string; slug?: string }[]) || [],
    authors: (authorData.authors as { id: number; name: string; slug?: string }[]) || [],
  };
}

export async function submitClfContentPost(input: {
  mode: "create" | "edit";
  postId?: number;
  data: ContentPostFormSubmitPayload;
}): Promise<ContentPostSubmitResult> {
  const res = await fetch(
    input.mode === "create" ? "/api/admin/blog/posts" : `/api/admin/blog/posts/${input.postId}`,
    {
      method: input.mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input.data),
    }
  );
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(String(data.details || data.error || "Error guardando artículo"));
  }
  const post = data.post as { id?: number; status?: string; slug?: string } | undefined;
  return {
    id: post?.id,
    status: String(post?.status || input.data.status),
    slug: String(post?.slug || input.data.slug || ""),
  };
}

export async function deleteClfContentPost(postId: number): Promise<void> {
  const res = await fetch(`/api/admin/blog/posts/${postId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await readJson(res);
    throw new Error(String(data.error || "Error eliminando"));
  }
}
