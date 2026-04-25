import { prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { PageHeader } from "@/components/page-header";
import { Inbox } from "lucide-react";

const statusLabel: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  CONVERTED: "Convertido",
  LOST: "Perdido",
};

export default async function LeadsPage() {
  const { workspace } = await requireCoursesSalesContext();
  const leads = await prisma.courseSalesLead.findMany({
    where: { workspaceId: workspace.id },
    include: { course: { select: { title: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-10">
      <PageHeader
        title="Inscripciones y leads"
        description="Consultas enviadas desde las landings públicas. Preparado para conectar CRM, email y pagos."
      />

      {leads.length === 0 ? (
        <div className="fo-card flex flex-col items-center text-center py-16 px-6 gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Inbox className="size-7" aria-hidden />
          </div>
          <div className="space-y-2 max-w-md">
            <p className="text-base font-semibold text-[var(--fo-text)]">Sin leads todavía</p>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Cuando publiques un curso y los visitantes completen el formulario de inscripción, los
              contactos aparecerán acá.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full text-sm text-left min-w-[720px]">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Curso</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-[var(--fo-surface-hover)]/60">
                  <td className="px-4 py-3 text-[var(--fo-muted)] whitespace-nowrap">
                    {new Intl.DateTimeFormat("es-AR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(l.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-[var(--fo-text)] font-medium">{l.course.title}</td>
                  <td className="px-4 py-3 text-[var(--fo-text)]">{l.name}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{l.email}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">
                    {statusLabel[l.status] ?? l.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
