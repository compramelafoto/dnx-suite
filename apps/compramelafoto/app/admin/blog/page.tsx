import AdminBlogList from "@/components/blog/admin/AdminBlogList";
import { getAdminBlogPostRows } from "@/lib/blog/admin-blog-list";

export const dynamic = "force-dynamic";

export default async function AdminBlogListPage() {
  let posts: Awaited<ReturnType<typeof getAdminBlogPostRows>> = [];
  let loadError: string | null = null;

  try {
    posts = await getAdminBlogPostRows();
  } catch (err) {
    console.error("Admin blog list:", err);
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    if (
      code === "P2021" ||
      message.includes("BlogPost") ||
      message.includes("does not exist") ||
      message.includes("Unknown model")
    ) {
      loadError =
        "Las tablas del blog no existen en esta base. Ejecutá: npx prisma migrate deploy";
    } else {
      loadError = "No se pudieron cargar los artículos. Revisá la conexión a la base de datos.";
    }
  }

  return <AdminBlogList initialPosts={posts} loadError={loadError} />;
}
