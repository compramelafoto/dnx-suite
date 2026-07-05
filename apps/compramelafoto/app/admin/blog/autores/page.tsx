"use client";

import BlogAdminNav from "@/components/blog/admin/BlogAdminNav";
import BlogAdminPageShell from "@/components/blog/admin/BlogAdminPageShell";
import BlogAuthorManager from "@/components/blog/admin/BlogAuthorManager";

export default function AdminBlogAuthorsPage() {
  return (
    <BlogAdminPageShell>
      <BlogAdminNav />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Autores del blog</h1>
        <p className="text-sm text-gray-500">Perfiles editoriales independientes del sistema de usuarios.</p>
      </div>
      <BlogAuthorManager />
    </BlogAdminPageShell>
  );
}
