import { prisma } from "@repo/db";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";

const statusLabel: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  QUOTED: "Presupuestado",
  INTERESTED: "Interesado",
  WON: "Ganado",
  LOST: "Perdido",
};

export default async function ServiceLeadsPage() {
  const { user, workspace } = await requireActiveWorkspace();
  const currentWorkspaceId = workspace?.id ?? null;

  const leads = currentWorkspaceId
    ? await prisma.serviceSalesLead.findMany({
        where: { workspaceId: currentWorkspaceId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-10">
      <PageHeader
        title="Leads de servicios"
        description="Consultas recibidas desde landings públicas para eventos y servicios."
      />

      {workspace ? (
        <div className="fo-card">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
                Workspace activo
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--fo-text)]">{workspace.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
                Usuario administrador
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--fo-text)]">{user.email}</p>
            </div>
          </div>
        </div>
      ) : null}

      {!workspace ? (
        <div className="fo-card">
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            No hay workspace activo para este usuario.
          </p>
        </div>
      ) : null}

      {workspace && leads.length === 0 ? (
        <div className="fo-card flex flex-col items-center text-center py-16 px-6 gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Inbox className="size-7" aria-hidden />
          </div>
          <p className="text-base font-semibold text-[var(--fo-text)]">
            Todavía no tenés consultas registradas.
          </p>
        </div>
      ) : null}

      {workspace && leads.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full text-sm text-left min-w-[920px]">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">WhatsApp</th>
                <th className="px-4 py-3 font-semibold">Tipo de evento</th>
                <th className="px-4 py-3 font-semibold">Subtipo</th>
                <th className="px-4 py-3 font-semibold">Fecha del evento</th>
                <th className="px-4 py-3 font-semibold">Fecha de creación</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-[var(--fo-surface-hover)]/60">
                  <td className="px-4 py-3 text-[var(--fo-text)] font-medium">{lead.name}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{lead.email ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{lead.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--fo-text)]">{lead.eventType}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{lead.eventSubtype ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)] whitespace-nowrap">
                    {lead.eventDate
                      ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(lead.eventDate)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--fo-muted)] whitespace-nowrap">
                    {new Intl.DateTimeFormat("es-AR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(lead.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">
                    {statusLabel[lead.status] ?? lead.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
