import { prisma } from "@repo/db";
import {
  AdminDataTable,
  AdminTableLink,
  type AdminDataTableColumn,
} from "@/components/admin/AdminDataTable";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { fechaAr } from "@/lib/fecha-ar";
import {
  listSurveyResponses,
  type ResponseFilter,
  type ResponseRow,
} from "@/lib/testimonials/admin/list-responses";
import { authorRoleLabel } from "@/lib/testimonials/public/voices-presentation";
import { presentTestimonialStatus } from "@/lib/testimonials/ui/testimonial-status-presentation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  edicion?: string;
  rol?: string;
  estado?: string;
  q?: string;
}>;

function parseFilter(params: Awaited<SearchParams>): ResponseFilter {
  const role = params.rol;
  const state = params.estado;
  return {
    ...(params.edicion ? { editionId: params.edicion } : {}),
    ...(role === "PARTICIPANT" || role === "JUROR" || role === "VENUE"
      ? { authorRole: role }
      : {}),
    ...(state === "PENDING" ||
    state === "PUBLISHED" ||
    state === "REJECTED" ||
    state === "SURVEY_ONLY" ||
    state === "NO_CONSENT"
      ? { state }
      : {}),
    ...(params.q ? { search: params.q } : {}),
  };
}

const STATE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendientes de revisión" },
  { value: "PUBLISHED", label: "Publicados" },
  { value: "REJECTED", label: "Rechazados" },
  { value: "NO_CONSENT", label: "Sin autorización" },
  { value: "SURVEY_ONLY", label: "Sólo encuesta" },
] as const;

const ROLE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "PARTICIPANT", label: "Participantes" },
  { value: "JUROR", label: "Jurados" },
  { value: "VENUE", label: "Sedes" },
] as const;

export default async function AdminTestimonialResponsesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireClickatonAdmin();
  const params = await searchParams;
  const filter = parseFilter(params);

  const [rows, editions] = await Promise.all([
    listSurveyResponses(filter),
    prisma.clickatonEdition.findMany({
      where: { isOpsFixture: false },
      select: { id: true, name: true },
      orderBy: { startAt: "desc" },
      take: 20,
    }),
  ]);

  const columns: AdminDataTableColumn<ResponseRow>[] = [
    {
      key: "author",
      header: "Quién",
      cell: (row) => (
        <AdminTableLink href={`${adminRoutes.testimonials}/respuestas/${row.id}`}>
          {row.authorName}
        </AdminTableLink>
      ),
    },
    {
      key: "role",
      header: "Rol",
      cell: (row) => authorRoleLabel(row.authorRole),
      hideOnMobile: true,
    },
    {
      key: "edition",
      header: "Edición",
      cell: (row) => row.editionName,
      hideOnMobile: true,
    },
    { key: "nps", header: "NPS", cell: (row) => String(row.npsScore) },
    {
      key: "state",
      header: "Estado",
      cell: (row) => {
        const presentation = presentTestimonialStatus(
          row.testimonial?.status ?? null,
          row.testimonial?.publicationConsent ?? false,
        );
        return <Badge variant={presentation.tone}>{presentation.label}</Badge>;
      },
    },
    {
      key: "critique",
      header: "Crítica",
      cell: (row) => (row.hasImprovementNotes ? "Sí" : "—"),
      hideOnMobile: true,
    },
    {
      key: "date",
      header: "Fecha",
      cell: (row) => fechaAr(row.submittedAt),
      hideOnMobile: true,
    },
  ];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Respuestas de la encuesta"
        description="Todo lo que contestaron. Desde acá se decide qué testimonio se publica."
        breadcrumbs={[
          { label: "Testimonios y calidad", href: adminRoutes.testimonials },
          { label: "Respuestas" },
        ]}
      />

      <Card>
        <form className="grid gap-4 sm:grid-cols-4" method="get">
          <label className="space-y-1 text-sm">
            <span className="text-ck-text-muted">Edición</span>
            <select
              name="edicion"
              defaultValue={params.edicion ?? ""}
              className="min-h-11 w-full rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface px-3 text-ck-text"
            >
              <option value="">Todas</option>
              {editions.map((edition) => (
                <option key={edition.id} value={edition.id}>
                  {edition.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-ck-text-muted">Rol</span>
            <select
              name="rol"
              defaultValue={params.rol ?? ""}
              className="min-h-11 w-full rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface px-3 text-ck-text"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-ck-text-muted">Estado</span>
            <select
              name="estado"
              defaultValue={params.estado ?? ""}
              className="min-h-11 w-full rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface px-3 text-ck-text"
            >
              {STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-ck-text-muted">Buscar en el texto</span>
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Nombre o palabra"
              className="min-h-11 w-full rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface px-3 text-ck-text"
            />
          </label>

          <div className="sm:col-span-4">
            <button
              type="submit"
              className="min-h-11 rounded-full border border-ck-border-strong px-5 text-ck-text"
            >
              Filtrar
            </button>
          </div>
        </form>
      </Card>

      <AdminDataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyMessage="No hay respuestas con esos filtros."
      />
    </div>
  );
}
