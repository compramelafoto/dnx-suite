import Link from "next/link";
import { Role } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { CreateTemplateV2Button } from "@repo/template-editor-ui";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type TemplateListItem = {
  id: string;
  ownerUserId: number;
  name: string;
  status: string;
  currentVersionId: string | null;
  updatedAt: Date;
  currentVersion: { id: string; versionNumber: number } | null;
  publication: {
    reviewStatus: string;
    visibility: string;
  } | null;
};

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function badgeClass(kind: "status" | "review" | "visibility" | "scope"): string {
  if (kind === "status") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (kind === "review") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (kind === "visibility") return "bg-sky-50 text-sky-700 ring-sky-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

function StatusBadge({ label, kind }: { label: string; kind: "status" | "review" | "visibility" | "scope" }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badgeClass(kind)}`}>
      {label}
    </span>
  );
}

export default async function PlantillasV2ListPage() {
  const user = await getAuthUser();
  const allowedRoles: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];
  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="mx-auto w-full max-w-screen-xl px-5 py-8 sm:px-8 lg:px-12">
        <Card className="p-6">
          <h1 className="mb-2 text-lg font-semibold text-[#1a1a1a]">Plantillas</h1>
          <p className="text-sm text-[#6b7280]">No tenés permisos para ver este listado.</p>
        </Card>
      </div>
    );
  }

  const rows = await prisma.templateV2.findMany({
    where: user.role === Role.ADMIN ? undefined : { ownerUserId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      ownerUserId: true,
      name: true,
      status: true,
      currentVersionId: true,
      updatedAt: true,
    },
  });

  const versionIds = rows.map((r) => r.currentVersionId).filter((id): id is string => Boolean(id));
  const versions =
    versionIds.length > 0
      ? await prisma.templateV2Version.findMany({
          where: { id: { in: versionIds } },
          select: { id: true, versionNumber: true },
        })
      : [];
  const versionById = new Map(versions.map((v) => [v.id, v]));

  const templateIds = rows.map((r) => r.id);
  const publications =
    templateIds.length > 0
      ? await prisma.templateV2Publication.findMany({
          where: { templateId: { in: templateIds } },
          select: { templateId: true, reviewStatus: true, visibility: true },
        })
      : [];
  const publicationByTemplateId = new Map(publications.map((p) => [p.templateId, p]));

  const templates: TemplateListItem[] = rows.map((r) => ({
    ...r,
    currentVersion: r.currentVersionId ? versionById.get(r.currentVersionId) ?? null : null,
    publication: publicationByTemplateId.get(r.id) ?? null,
  }));

  return (
    <div
      className="mx-auto w-full max-w-screen-xl px-5 py-8 sm:px-8 lg:px-12"
      data-testid="template-v2-dashboard"
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <h1 className="text-2xl font-bold text-[#111827] sm:text-3xl">Plantillas</h1>
          <p className="mt-2 text-base text-[#6b7280] sm:text-lg">
            Gestioná tus plantillas con el editor visual: estado, publicación y versión actual. En el editor, el bloque{" "}
            <span className="font-medium text-[#374151]">Versiones del template</span> lista todas las versiones y permite
            abrir una anterior sin salir del flujo.
          </p>
        </div>
        <CreateTemplateV2Button />
      </div>

      {templates.length === 0 ? (
        <Card className="p-8 sm:p-10">
          <div className="min-w-0 w-full max-w-2xl">
            <h2 className="text-lg font-semibold text-[#111827]">Todavía no tenés plantillas</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6b7280] sm:text-base">
              Usá <span className="font-medium text-[#374151]">Nueva plantilla</span> arriba a la derecha para crear una
              y abrir el editor. Después vas a ver el listado acá con acceso directo a editar.
            </p>
            <div className="mt-5 rounded-2xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
              <p className="text-sm text-[#475569]">
                En desarrollo local también podés cargar datos de ejemplo con{" "}
                <span className="rounded bg-white px-2 py-1 font-mono text-xs ring-1 ring-[#e5e7eb]">
                  npm run bootstrap:template-v2-demo
                </span>
                .
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                <tr className="text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Plantilla</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">IDs</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Estados</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Actualizado</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Acción</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => {
                  const hasCurrentVersion = Boolean(template.currentVersionId && template.currentVersion?.id);
                  const editorHref = hasCurrentVersion
                    ? `/fotografo/diseno/plantillas/v2/${template.id}/${template.currentVersionId}`
                    : null;

                  let versionDiagnostic = "Sin versión actual";
                  if (template.currentVersionId && !template.currentVersion?.id) {
                    versionDiagnostic = "currentVersionId apunta a versión inexistente";
                  } else if (template.currentVersionId) {
                    versionDiagnostic = template.currentVersionId;
                  }

                  return (
                    <tr key={template.id} className="border-b border-[#f1f5f9] align-top last:border-b-0">
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-[#111827]">{template.name || "Sin nombre"}</p>
                        <p className="mt-1 text-xs text-[#6b7280]">Lista para editar en el diseñador</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Template ID</p>
                        <p className="mt-1 break-all font-mono text-xs text-[#334155]">{template.id}</p>
                        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Versión actual</p>
                        {template.currentVersion?.versionNumber != null ? (
                          <p className="mt-1 text-sm font-semibold text-[#111827]">
                            v{template.currentVersion.versionNumber}
                          </p>
                        ) : null}
                        <p className="mt-1 break-all font-mono text-xs text-[#334155]">{versionDiagnostic}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge label={template.status} kind="status" />
                          <StatusBadge label={template.publication?.reviewStatus || "DRAFT"} kind="review" />
                          <StatusBadge label={template.publication?.visibility || "PRIVATE"} kind="visibility" />
                          {user.role === Role.ADMIN ? (
                            <StatusBadge label={template.ownerUserId === user.id ? "Propia" : "Otro usuario"} kind="scope" />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-[#64748b]">{formatDate(template.updatedAt)}</td>
                      <td className="px-5 py-4">
                        {editorHref ? (
                          <Link href={editorHref}>
                            <Button variant="primary" className="px-5 py-2.5 text-sm font-semibold">
                              Editar
                            </Button>
                          </Link>
                        ) : (
                          <div className="space-y-1.5">
                            <Button variant="secondary" className="px-5 py-2.5 text-sm font-semibold" disabled>
                              Editar
                            </Button>
                            <p className="max-w-52 text-[11px] leading-relaxed text-[#9ca3af]">
                              No se puede abrir el editor porque no hay una versión actual válida.
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
