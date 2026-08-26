"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ContentPostForm,
  type ContentOption,
  type ContentPostFormValue,
} from "@repo/content-ui";
import { BLOG_POST_TYPE_LABELS } from "@/components/blog/admin/blog-admin-constants";
import {
  createClfContentMediaAdapter,
  deleteClfContentPost,
  loadClfContentTaxonomyOptions,
  submitClfContentPost,
} from "@/lib/blog/clf-content-admin-adapter";
import type { BlogPostFormValues, BlogPostSavedPayload } from "@/lib/blog/blog-post-form-types";
import { createEmptyBlogContentJson } from "@/lib/blog/tiptap-extensions";
import { slugifyBlogFromName } from "@/lib/blog/slugify-blog";

export type { BlogPostFormValues, BlogPostSavedPayload };

const TiptapEditor = dynamic(() => import("@/components/blog/admin/TiptapEditor"), {
  ssr: false,
  loading: () => <p className="text-sm text-gray-500">Cargando editor...</p>,
});

type BlogPostFormProps = {
  mode: "create" | "edit";
  postId?: number;
  initialValues?: Partial<BlogPostFormValues>;
  onSaved?: (post: BlogPostSavedPayload) => void;
};

const ACCENT_STYLE = { ["--content-ui-accent" as string]: "#c27b3d" };

const CLF_LABELS = {
  fallbackShareNote:
    "Sin imagen destacada: al compartir el link se mostrará el logo de ComprameLaFoto.",
  featureUncheckedNote:
    "El artículo no está publicado: se quitó el destacado. Solo los artículos publicados pueden destacarse en el home del blog.",
  featurePublishFirst: "Para destacar un artículo en el home del blog, primero publicalo.",
  featureCheckbox: "Destacar en home del blog",
};

export default function BlogPostForm({ mode, postId, initialValues, onSaved }: BlogPostFormProps) {
  const router = useRouter();
  const mediaAdapter = useMemo(() => createClfContentMediaAdapter(), []);
  const [options, setOptions] = useState<{
    categories: ContentOption[];
    tags: ContentOption[];
    authors: ContentOption[];
  }>({ categories: [], tags: [], authors: [] });

  useEffect(() => {
    void loadClfContentTaxonomyOptions().then(setOptions);
  }, []);

  return (
    <div style={ACCENT_STYLE}>
      <ContentPostForm
        mode={mode}
        postId={postId}
        initialValue={initialValues as Partial<ContentPostFormValue> | undefined}
        options={options}
        labels={CLF_LABELS}
        typeLabels={BLOG_POST_TYPE_LABELS}
        mediaAdapter={mediaAdapter}
        slugify={slugifyBlogFromName}
        createEmptyContent={createEmptyBlogContentJson}
        EditorComponent={TiptapEditor}
        onSubmit={async ({ data }) =>
          submitClfContentPost({ mode, postId, data })
        }
        onDelete={
          mode === "edit" && postId
            ? async () => {
                await deleteClfContentPost(postId);
                router.push("/admin/blog");
              }
            : undefined
        }
        onCreated={({ id }) => {
          router.push(`/admin/blog/${id}`);
        }}
        onSaved={(result) => {
          onSaved?.({
            status: result.status as BlogPostSavedPayload["status"],
            slug: result.slug,
          });
        }}
      />
    </div>
  );
}
