"use client";

import BlogAdminNav from "@/components/blog/admin/BlogAdminNav";
import BlogAdminPageShell from "@/components/blog/admin/BlogAdminPageShell";
import BlogTagManager from "@/components/blog/admin/BlogTagManager";

export default function AdminBlogTagsPage() {
  return (
    <BlogAdminPageShell>
      <BlogAdminNav />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tags del blog</h1>
        <p className="text-sm text-gray-500">Etiquetas transversales para filtrar contenido.</p>
      </div>
      <BlogTagManager />
    </BlogAdminPageShell>
  );
}
