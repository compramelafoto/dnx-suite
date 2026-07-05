"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import BlogHeroImageUpload from "@/components/blog/admin/BlogHeroImageUpload";
import BlogMediaPicker from "@/components/blog/admin/BlogMediaPicker";
import { BLOG_POST_TYPE_LABELS } from "@/components/blog/admin/blog-admin-constants";
import { createEmptyBlogContentJson } from "@/lib/blog/tiptap-extensions";
import type { BlogPostFormValues, BlogPostSavedPayload } from "@/lib/blog/blog-post-form-types";
import { syncBlogPostImageFields } from "@/lib/blog/blog-post-images";
import { slugifyBlogFromName } from "@/lib/blog/slugify-blog";

export type { BlogPostFormValues, BlogPostSavedPayload };

const TiptapEditor = dynamic(() => import("@/components/blog/admin/TiptapEditor"), {
  ssr: false,
  loading: () => <p className="text-sm text-gray-500">Cargando editor...</p>,
});

type Option = { id: number; name: string; slug?: string };

type BlogPostFormProps = {
  mode: "create" | "edit";
  postId?: number;
  initialValues?: Partial<BlogPostFormValues>;
  onSaved?: (post: BlogPostSavedPayload) => void;
};

function toDatetimeLocal(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildPayload(form: BlogPostFormValues, statusOverride?: BlogPostFormValues["status"]) {
  const images = syncBlogPostImageFields({
    heroImageUrl: form.heroImageUrl,
    ogImageUrl: form.ogImageUrl,
  });
  return {
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    excerpt: form.excerpt.trim() || null,
    contentJson: form.contentJson,
    heroImageUrl: images.heroImageUrl,
    status: statusOverride ?? form.status,
    type: form.type,
    categoryId: form.categoryId ? Number(form.categoryId) : null,
    authorId: form.authorId ? Number(form.authorId) : null,
    tagIds: form.tagIds,
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    seoGoal: form.seoGoal.trim() || null,
    ogImageUrl: images.ogImageUrl,
    canonicalUrl: form.canonicalUrl.trim() || null,
    noIndex: form.noIndex,
    lastReviewedAt: form.lastReviewedAt ? new Date(form.lastReviewedAt).toISOString() : null,
    isFeatured: (statusOverride ?? form.status) === "PUBLISHED" ? form.isFeatured : false,
    featuredUntil: form.featuredUntil ? new Date(form.featuredUntil).toISOString() : null,
  };
}

export default function BlogPostForm({ mode, postId, initialValues, onSaved }: BlogPostFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<BlogPostFormValues>({
    title: "",
    slug: "",
    excerpt: "",
    contentJson: createEmptyBlogContentJson(),
    heroImageUrl: "",
    status: "DRAFT",
    type: "BLOG",
    categoryId: "",
    authorId: "",
    tagIds: [],
    seoTitle: "",
    seoDescription: "",
    seoGoal: "",
    ogImageUrl: "",
    canonicalUrl: "",
    noIndex: false,
    lastReviewedAt: "",
    isFeatured: false,
    featuredUntil: "",
    ...initialValues,
  });
  const [slugManual, setSlugManual] = useState(Boolean(initialValues?.slug));
  const [categories, setCategories] = useState<Option[]>([]);
  const [authors, setAuthors] = useState<Option[]>([]);
  const [tags, setTags] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ url: string; alt: string } | null>(null);
  const pendingImageKey = useRef(0);

  useEffect(() => {
    async function loadOptions() {
      const [catRes, tagRes, authorRes] = await Promise.all([
        fetch("/api/admin/blog/categories", { credentials: "include" }),
        fetch("/api/admin/blog/tags", { credentials: "include" }),
        fetch("/api/admin/blog/authors?active=1", { credentials: "include" }),
      ]);
      const [catData, tagData, authorData] = await Promise.all([
        catRes.json().catch(() => ({})),
        tagRes.json().catch(() => ({})),
        authorRes.json().catch(() => ({})),
      ]);
      setCategories(catData.categories || []);
      setTags(tagData.tags || []);
      setAuthors(authorData.authors || []);
    }
    void loadOptions();
  }, []);

  useEffect(() => {
    if (!initialValues) return;
    setForm((prev) => ({
      ...prev,
      ...initialValues,
      contentJson: initialValues.contentJson ?? prev.contentJson,
      lastReviewedAt: initialValues.lastReviewedAt
        ? toDatetimeLocal(initialValues.lastReviewedAt)
        : prev.lastReviewedAt,
      featuredUntil: initialValues.featuredUntil
        ? toDatetimeLocal(initialValues.featuredUntil)
        : prev.featuredUntil,
    }));
  }, [initialValues]);

  const canFeature = form.status === "PUBLISHED";

  useEffect(() => {
    if (form.status !== "PUBLISHED" && form.isFeatured) {
      setForm((f) => ({ ...f, isFeatured: false }));
    }
  }, [form.status, form.isFeatured]);

  const save = useCallback(
    async (statusOverride?: BlogPostFormValues["status"]) => {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const payload = buildPayload(form, statusOverride);
      try {
        const res = await fetch(
          mode === "create" ? "/api/admin/blog/posts" : `/api/admin/blog/posts/${postId}`,
          {
            method: mode === "create" ? "POST" : "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.details || data.error || "Error guardando artículo");

        if (mode === "create") {
          router.push(`/admin/blog/${data.post.id}`);
          return;
        }
        const savedPost = data.post as BlogPostSavedPayload | undefined;
        if (savedPost?.status && savedPost.slug) {
          onSaved?.({ status: savedPost.status, slug: savedPost.slug });
        }
        setSuccess("Artículo guardado correctamente.");
        if (statusOverride) {
          setForm((f) => ({ ...f, status: statusOverride, isFeatured: payload.isFeatured }));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error guardando artículo");
      } finally {
        setSaving(false);
      }
    },
    [form, mode, onSaved, postId, router]
  );

  async function handleDelete() {
    if (!postId) return;
    if (!window.confirm("¿Eliminar este artículo permanentemente?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/blog/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error eliminando");
      }
      router.push("/admin/blog");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eliminando");
      setSaving(false);
    }
  }

  function toggleTag(id: number) {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(id) ? f.tagIds.filter((t) => t !== id) : [...f.tagIds, id],
    }));
  }

  function handleImageFromLibrary(url: string, alt: string) {
    pendingImageKey.current += 1;
    setPendingImage({ url, alt });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div> : null}

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">Contenido principal</h2>
        <Input
          value={form.title}
          onChange={(e) => {
            const title = e.target.value;
            setForm((f) => ({
              ...f,
              title,
              slug: slugManual ? f.slug : slugifyBlogFromName(title),
            }));
          }}
          placeholder="Título del artículo"
          required
        />
        <div>
          <label className="mb-1 block text-sm text-gray-600">Slug (URL)</label>
          <Input
            value={form.slug}
            onChange={(e) => {
              setSlugManual(true);
              setForm((f) => ({ ...f, slug: e.target.value }));
            }}
            placeholder="mi-articulo"
          />
        </div>
        <Textarea
          value={form.excerpt}
          onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
          placeholder="Resumen para listados y SEO"
          rows={3}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Categoría</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Autor</label>
            <select
              value={form.authorId}
              onChange={(e) => setForm((f) => ({ ...f, authorId: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Sin autor</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Tipo</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as BlogPostFormValues["type"] }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {Object.entries(BLOG_POST_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm text-gray-600">Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = form.tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    active
                      ? "bg-[#c27b3d] text-white border-[#c27b3d]"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm text-gray-600">Imagen destacada</label>
          <p className="mb-3 text-xs leading-relaxed text-gray-500">
            Se muestra en el artículo, en las tarjetas del blog y como miniatura al compartir el link en redes
            sociales (WhatsApp, Facebook, X, LinkedIn).
          </p>
          <BlogHeroImageUpload
            value={form.heroImageUrl}
            onChange={(url) =>
              setForm((f) => ({
                ...f,
                heroImageUrl: url,
                ogImageUrl: url,
              }))
            }
            disabled={saving}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm text-gray-600">Cuerpo del artículo</label>
          <TiptapEditor
            value={form.contentJson}
            onChange={(contentJson) => setForm((f) => ({ ...f, contentJson }))}
            onPickImage={() => setMediaPickerOpen(true)}
            disabled={saving}
            insertImage={pendingImage}
            insertImageKey={pendingImageKey.current}
            onImageInserted={() => setPendingImage(null)}
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">SEO</h2>
        <Input
          value={form.seoTitle}
          onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
          placeholder="Título SEO (opcional)"
        />
        <Textarea
          value={form.seoDescription}
          onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
          placeholder="Descripción SEO"
          rows={2}
        />
        <Textarea
          value={form.seoGoal}
          onChange={(e) => setForm((f) => ({ ...f, seoGoal: e.target.value }))}
          placeholder="Objetivo SEO (interno, no público)"
          rows={3}
        />
        {form.heroImageUrl ? (
          <p className="text-sm text-gray-600">
            Vista previa en redes: usa la imagen destacada del artículo.
          </p>
        ) : (
          <p className="text-sm text-amber-800">
            Sin imagen destacada: al compartir el link se mostrará el logo de ComprameLaFoto.
          </p>
        )}
        <Input
          value={form.canonicalUrl}
          onChange={(e) => setForm((f) => ({ ...f, canonicalUrl: e.target.value }))}
          placeholder="URL canónica (opcional)"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.noIndex}
            onChange={(e) => setForm((f) => ({ ...f, noIndex: e.target.checked }))}
          />
          No indexar (noindex)
        </label>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Última revisión editorial</label>
          <input
            type="datetime-local"
            value={form.lastReviewedAt}
            onChange={(e) => setForm((f) => ({ ...f, lastReviewedAt: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">Publicación</h2>
        {!canFeature && form.isFeatured ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            El artículo no está publicado: se quitó el destacado. Solo los artículos publicados pueden destacarse en el
            home del blog.
          </div>
        ) : null}
        {!canFeature ? (
          <p className="text-sm text-amber-700">
            Para destacar un artículo en el home del blog, primero publicalo.
          </p>
        ) : null}
        <label className={`flex items-center gap-2 text-sm text-gray-700 ${!canFeature ? "opacity-50" : ""}`}>
          <input
            type="checkbox"
            checked={form.isFeatured && canFeature}
            disabled={!canFeature}
            onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
          />
          Destacar en home del blog
        </label>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Destacado hasta (opcional)</label>
          <input
            type="datetime-local"
            value={form.featuredUntil}
            disabled={!canFeature || !form.isFeatured}
            onChange={(e) => setForm((f) => ({ ...f, featuredUntil: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={saving} onClick={() => void save("DRAFT")}>
          {saving ? "Guardando..." : "Guardar borrador"}
        </Button>
        <Button type="button" disabled={saving} onClick={() => void save("PUBLISHED")}>
          Publicar
        </Button>
        {mode === "edit" ? (
          <>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => void save("ARCHIVED")}>
              Archivar
            </Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => void save()}>
              Guardar cambios
            </Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => void handleDelete()}>
              Eliminar
            </Button>
          </>
        ) : null}
      </div>

      <BlogMediaPicker
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(item) => handleImageFromLibrary(item.url, item.altText || item.title || "")}
      />
    </div>
  );
}
