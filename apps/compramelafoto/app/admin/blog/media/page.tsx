"use client";

import BlogAdminNav from "@/components/blog/admin/BlogAdminNav";
import BlogAdminPageShell from "@/components/blog/admin/BlogAdminPageShell";
import BlogMediaLibrary from "@/components/blog/admin/BlogMediaLibrary";

export default function AdminBlogMediaPage() {
  return (
    <BlogAdminPageShell>
      <BlogAdminNav />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Biblioteca multimedia</h1>
        <p className="text-sm text-gray-500">Imágenes reutilizables para artículos del blog.</p>
      </div>
      <BlogMediaLibrary mode="page" />
    </BlogAdminPageShell>
  );
}
