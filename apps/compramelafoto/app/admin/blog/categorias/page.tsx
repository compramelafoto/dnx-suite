"use client";

import BlogAdminNav from "@/components/blog/admin/BlogAdminNav";
import BlogAdminPageShell from "@/components/blog/admin/BlogAdminPageShell";
import BlogCategoryManager from "@/components/blog/admin/BlogCategoryManager";

export default function AdminBlogCategoriesPage() {
  return (
    <BlogAdminPageShell>
      <BlogAdminNav />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Categorías del blog</h1>
        <p className="text-sm text-gray-500">Organizá los artículos por temática.</p>
      </div>
      <BlogCategoryManager />
    </BlogAdminPageShell>
  );
}
