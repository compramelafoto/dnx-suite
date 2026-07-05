"use client";

import Link from "next/link";
import BlogAdminNav from "@/components/blog/admin/BlogAdminNav";
import BlogAdminPageShell from "@/components/blog/admin/BlogAdminPageShell";
import BlogPostForm from "@/components/blog/admin/BlogPostForm";

export default function AdminBlogNewPage() {
  return (
    <BlogAdminPageShell>
      <BlogAdminNav />
      <div>
        <Link href="/admin/blog" className="text-sm text-[#c27b3d] hover:underline">
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Nuevo artículo</h1>
        <p className="text-sm text-gray-500">Creá un borrador o publicá directamente.</p>
      </div>
      <BlogPostForm mode="create" />
    </BlogAdminPageShell>
  );
}
