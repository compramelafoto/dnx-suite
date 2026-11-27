import Link from "next/link";
import { Role } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  CreateTemplateV2Button,
  TEMPLATE_V2_BASE_PATHS,
  TemplateV2RowActions,
} from "@repo/template-editor-ui";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TemplateV2NameEditor from "@/components/template-v2/TemplateV2NameEditor";

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

const BADGE_LABEL: Record<"status" | "review" | "visibility", Record<string, string>> = {
  status: { DRAFT: "Borrador", ACTIVE: "Activa", ARCHIVED: "Archivada" },
  review: { DRAFT: "Sin enviar a revisión", IN_REVIEW: "En revisión", APPROVED: "Aprobada", REJECTED: "Rechazada" },
  visibility: { PRIVATE: "Privada", PUBLIC: "Pública" },
};

/** Estado de la plantilla en castellano (el valor interno queda solo si no hay traducción). */
function badgeLabel(kind: "status" | "review" | "visibility", value: string): string {
  return BADGE_LABEL[kind][value] ?? value;
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

  const isAdmin = user.role === Role.ADMIN;

  const rows = await prisma.templateV2.findMany({
    // Las archivadas son las que se eliminaron desde esta lista.
    where:
      user.role === Role.ADMIN
        ? { status: { not: "ARCHIVED" } }
        : { ownerUserId: user.id, status: { not: "ARCHIVED" } },
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
            Tus plantillas del editor visual. Desde acá las abrís para editarlas, las probás con fotos o las
            duplicás.
          </p>
        </div>
        <CreateTemplateV2Button
          basePath={TEMPLATE_V2_BASE_PATHS.compramelafoto}
          theme={{ accent: "#c27b3d", accentInk: "#ffffff" }}
        />
      </div>

      {templates.length === 0 ? (
        <Card className="p-8 sm:p-10">
          <div className="min-w-0 w-full max-w-2xl">
            <h2 className="text-lg font-semibold text-[#111827]">Todavía no tenés plantillas</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6b7280] sm:text-base">
              Usá <span className="font-medium text-[#374151]">Nueva plantilla</span> arriba a la derecha para crear una
              y abrir el editor. Después vas a ver el listado acá con acceso directo a editar.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                <tr className="text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Plantilla</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                    {isAdmin ? "IDs" : "Versión"}
                  </th>
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
                        <TemplateV2NameEditor
                          templateId={template.id}
                          initialName={template.name}
                          subtitle="Lista para editar en el diseñador"
                        />
                      </td>
                      <td className="px-5 py-4">
                        {isAdmin ? (
                          <>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Template ID</p>
                            <p className="mt-1 break-all font-mono text-xs text-[#334155]">{template.id}</p>
                            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                              Versión actual
                            </p>
                          </>
                        ) : null}
                        {template.currentVersion?.versionNumber != null ? (
                          <p className="mt-1 text-sm font-semibold text-[#111827]">
                            Versión {template.currentVersion.versionNumber}
                          </p>
                        ) : !isAdmin ? (
                          <p className="mt-1 text-sm text-[#64748b]">Sin versión guardada</p>
                        ) : null}
                        {isAdmin ? (
                          <p className="mt-1 break-all font-mono text-xs text-[#334155]">{versionDiagnostic}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge label={badgeLabel("status", template.status)} kind="status" />
                          {isAdmin ? (
                            <StatusBadge
                              label={badgeLabel("review", template.publication?.reviewStatus || "DRAFT")}
                              kind="review"
                            />
                          ) : null}
                          <StatusBadge
                            label={badgeLabel("visibility", template.publication?.visibility || "PRIVATE")}
                            kind="visibility"
                          />
                          {user.role === Role.ADMIN ? (
                            <StatusBadge label={template.ownerUserId === user.id ? "Propia" : "Otro usuario"} kind="scope" />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-[#64748b]">{formatDate(template.updatedAt)}</td>
                      <td className="px-5 py-4">
                        {editorHref ? (
                          <div className="flex flex-col items-start gap-2">
                            <TemplateV2RowActions
                              templateId={template.id}
                              name={template.name}
                              editorHref={editorHref}
                              showRename={false}
                            />
                            <Link
                              href={`/fotografo/diseno/plantillas/v2/${template.id}/probar`}
                              className="text-xs font-medium text-[#c27b3d] underline underline-offset-2 hover:text-[#a0632f]"
                            >
                              Probar con fotos
                            </Link>
                          </div>
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
