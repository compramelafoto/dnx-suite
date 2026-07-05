"use client";

import { useState } from "react";
import Link from "next/link";
import BlogAdminNav from "@/components/blog/admin/BlogAdminNav";
import BlogAdminPageShell from "@/components/blog/admin/BlogAdminPageShell";
import BlogPostForm from "@/components/blog/admin/BlogPostForm";
import type { BlogPostFormValues } from "@/lib/blog/blog-post-form-types";

type AdminBlogEditClientProps = {
  postId: number;
  initialValues: Partial<BlogPostFormValues>;
  initialStatus: string;
  initialSlug: string;
};

export default function AdminBlogEditClient({
  postId,
  initialValues,
  initialStatus,
  initialSlug,
}: AdminBlogEditClientProps) {
  const [postStatus, setPostStatus] = useState(initialStatus);
  const [publicSlug, setPublicSlug] = useState(initialSlug);

  return (
    <BlogAdminPageShell>
      <BlogAdminNav />
      <div>
        <Link href="/admin/blog" className="text-sm text-[#c27b3d] hover:underline">
          ← Volver al listado
        </Link>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Editar artículo</h1>
            <p className="text-sm text-gray-500">{initialValues.title}</p>
          </div>
          {postStatus === "PUBLISHED" && publicSlug ? (
            <a
              href={`/blog/${publicSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Ver en blog
            </a>
          ) : null}
        </div>
      </div>
      <BlogPostForm
        mode="edit"
        postId={postId}
        initialValues={initialValues}
        onSaved={({ status, slug }) => {
          setPostStatus(status);
          setPublicSlug(slug);
        }}
      />
    </BlogAdminPageShell>
  );
}
