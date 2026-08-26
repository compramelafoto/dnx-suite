import { AdminDataTable, AdminTableLink } from "@/components/admin/AdminDataTable";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ContentAdminNav } from "@/components/admin/content/ContentAdminNav";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { listClickatonAdminPosts } from "@/lib/content/admin-queries";
import { CLICKATON_CONTENT_STATUS_LABELS } from "@/lib/content/content-labels";
import { blogPostPath } from "@/lib/content/content-site-config";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function AdminContentsPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const params = await searchParams;

  const result = await withClickatonDb(
    () =>
      listClickatonAdminPosts({
        status: params.status || null,
        q: params.q || null,
      }),
    "No se pudieron cargar las notas del blog.",
  );

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Contenidos"
        description="Notas del blog público de Clickatón. Todo lo que se publica acá vive en /blog con la marca Clickatón."
        breadcrumbs={[{ label: "Contenidos" }]}
        actions={
          <Button href={`${adminRoutes.contents}/nuevo`} variant="primary">
            Nueva nota
          </Button>
        }
      />

      <ContentAdminNav active="posts" />

      <form className="grid gap-4 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-6 sm:grid-cols-[1fr_auto_auto]">
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Buscar</span>
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Título o slug" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Estado</span>
          <Select name="status" defaultValue={params.status ?? ""}>
            <option value="">Todos</option>
            <option value="DRAFT">Borrador</option>
            <option value="PUBLISHED">Publicada</option>
            <option value="ARCHIVED">Archivada</option>
          </Select>
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </div>
      </form>

      {!result.ok ? (
        <AdminMigrationNotice message={result.message} />
      ) : result.data.length === 0 ? (
        <div className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-6 py-12 text-center">
          <p className="text-lg text-ck-text">Todavía no hay notas</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ck-text-secondary">
            Creá la primera nota del blog. Antes conviene definir al menos una categoría y un
            autor para que la nota quede bien clasificada.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href={`${adminRoutes.contents}/categorias`} variant="secondary">
              Configurar categorías
            </Button>
            <Button href={`${adminRoutes.contents}/nuevo`} variant="primary">
              Nueva nota
            </Button>
          </div>
        </div>
      ) : (
        <AdminDataTable
          rows={result.data}
          rowKey={(row) => String(row.id)}
          columns={[
            {
              key: "title",
              header: "Nota",
              cell: (row) => (
                <AdminTableLink href={`${adminRoutes.contents}/${row.id}`}>
                  {row.title}
                </AdminTableLink>
              ),
            },
            {
              key: "status",
              header: "Estado",
              cell: (row) => CLICKATON_CONTENT_STATUS_LABELS[row.status] ?? row.status,
            },
            {
              key: "category",
              header: "Categoría",
              cell: (row) => row.category?.name ?? "—",
            },
            {
              key: "author",
              header: "Autor",
              cell: (row) => row.author?.name ?? "—",
            },
            {
              key: "publishedAt",
              header: "Publicada",
              cell: (row) => formatDate(row.publishedAt),
            },
            {
              key: "views",
              header: "Vistas",
              cell: (row) => row.viewCount,
            },
            {
              key: "actions",
              header: "",
              cell: (row) =>
                row.status === "PUBLISHED" ? (
                  <AdminTableLink href={blogPostPath(row.slug)}>Ver pública</AdminTableLink>
                ) : (
                  <span className="text-ck-text-muted">—</span>
                ),
            },
          ]}
          mobileCard={(row) => (
            <>
              <AdminTableLink href={`${adminRoutes.contents}/${row.id}`}>
                {row.title}
              </AdminTableLink>
              <p className="text-sm text-ck-text-secondary">
                {CLICKATON_CONTENT_STATUS_LABELS[row.status] ?? row.status}
                {row.category ? ` · ${row.category.name}` : ""}
              </p>
              <p className="text-sm text-ck-text-muted">
                {formatDate(row.publishedAt)} · {row.viewCount} vistas
              </p>
            </>
          )}
        />
      )}
    </div>
  );
}
