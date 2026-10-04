"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ContentPostForm, type ContentOption, type ContentPostFormValue } from "@repo/content-ui";
import {
  createBlogMediaAdapter,
  deleteBlogPostRequest,
  loadBlogTaxonomyOptions,
  submitBlogPost,
} from "@/lib/blog/admin-client";
import { BLOG_EDITOR_ACCENT_STYLE, BLOG_EDITOR_LABELS, BLOG_TYPE_LABELS } from "@/lib/blog/admin-labels";
import { BLOG_ADMIN_BASE } from "@/lib/blog/admin-nav";

const BlogEditorClient = dynamic(() => import("./blog-editor-client"), {
  ssr: false,
  loading: () => <p className="text-sm text-[var(--fo-muted)]">Cargando editor…</p>,
});

type Props = {
  mode: "create" | "edit";
  postId?: number;
  initialValues?: Partial<ContentPostFormValue>;
};

/**
 * El formulario compartido de `@repo/content-ui` conectado a las rutas de FOTOFFICE.
 *
 * Categorías, tags y autores se piden al abrir: si la institución todavía no cargó ninguno, los
 * selectores quedan en "Sin categoría" / "Sin autor" y el artículo se puede guardar igual.
 */
export function BlogPostForm({ mode, postId, initialValues }: Props) {
  const router = useRouter();
  const mediaAdapter = useMemo(() => createBlogMediaAdapter(), []);
  const [options, setOptions] = useState<{
    categories: ContentOption[];
    tags: ContentOption[];
    authors: ContentOption[];
  }>({ categories: [], tags: [], authors: [] });

  useEffect(() => {
    void loadBlogTaxonomyOptions()
      .then(setOptions)
      .catch(() => {
        // Sin opciones el formulario sigue sirviendo: categoría, tags y autor son opcionales.
      });
  }, []);

  return (
    <div style={BLOG_EDITOR_ACCENT_STYLE} className="fo-card">
      <ContentPostForm
        mode={mode}
        postId={postId}
        initialValue={initialValues}
        options={options}
        labels={BLOG_EDITOR_LABELS}
        typeLabels={BLOG_TYPE_LABELS}
        mediaAdapter={mediaAdapter}
        EditorComponent={BlogEditorClient}
        onSubmit={async ({ data }) => submitBlogPost({ mode, postId, data })}
        onDelete={
          mode === "edit" && postId
            ? async () => {
                await deleteBlogPostRequest(postId);
                router.push(BLOG_ADMIN_BASE);
                router.refresh();
              }
            : undefined
        }
        onCreated={({ id }) => router.push(`${BLOG_ADMIN_BASE}/${id}`)}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
