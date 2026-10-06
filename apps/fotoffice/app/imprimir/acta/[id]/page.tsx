import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PrintButton } from "@/components/governance/print-button";
import { requireGovernanceViewer } from "@/lib/governance/access";
import { getMeeting } from "@/lib/governance/repository";
import { fecha, fechaHora } from "@/lib/governance/labels";
import { isMinutesLocked, outcomeLabel } from "@/lib/governance/meetings";
import { tallyLabel, type Tally } from "@/lib/governance/votes";

export const dynamic = "force-dynamic";

/**
 * El acta de una reunión, lista para imprimir o guardar como PDF.
 *
 * Vive fuera del panel a propósito: sin menú ni encabezado, la hoja impresa es sólo el acta. El
 * PDF lo arma el navegador ("Guardar como PDF"); así no se suma una librería al monorepo, que
 * comparte las dependencias entre todas las aplicaciones.
 */
export default async function ActaPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await requireGovernanceViewer();
  const { id } = await params;
  const r = await getMeeting(workspace.id, id);
  if (!r) notFound();
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { commercialName: true },
  });
  const institucion = branding?.commercialName?.trim() || workspace.name;
  const aprobada = isMinutesLocked(r.status);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 bg-white px-6 py-10 text-[15px] leading-relaxed text-black print:px-0 print:py-0">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-[var(--fo-muted)]">
          {aprobada ? "Acta aprobada." : "Borrador: el acta todavía no está aprobada."}
        </p>
        <PrintButton />
      </div>

      <header className="space-y-1 border-b border-black/20 pb-4 text-center">
        <p className="text-sm uppercase tracking-widest">{institucion}</p>
        <h1 className="text-2xl font-semibold">
          {aprobada ? "Acta" : "Borrador de acta"} — {r.title}
        </h1>
        <p>
          {fechaHora(r.scheduledAt)} h{r.location ? ` · ${r.location}` : ""}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-semibold">Presentes</h2>
        {r.attendees.length === 0 ? (
          <p>Sin asistentes cargados.</p>
        ) : (
          <ul className="list-disc pl-6">
            {r.attendees.map((a) => (
              <li key={a.id}>
                {a.name}
                {a.officeName ? ` (${a.officeName})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Orden del día y resoluciones</h2>
        <ol className="list-decimal space-y-4 pl-6">
          {r.items.map((item) => {
            const foto = (item.voteSnapshot ?? null) as Tally | null;
            return (
              <li key={item.id} className="space-y-1">
                <p className="font-medium">{item.title}</p>
                {item.outcome ? (
                  <p>
                    <strong>Resultado:</strong> {outcomeLabel(item.outcome)}
                    {foto ? ` · Votación previa: ${tallyLabel(foto)}, ${foto.against} en contra` : ""}
                  </p>
                ) : null}
                <p className="whitespace-pre-line">{item.decisionText ?? "Sin tratar."}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {r.notes.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Notas agregadas después de aprobada</h2>
          {r.notes.map((n) => (
            <p key={n.id} className="whitespace-pre-line">
              {fecha(n.createdAt)} — {n.authorLabel}: {n.body}
            </p>
          ))}
        </section>
      ) : null}

      <footer className="border-t border-black/20 pt-4 text-sm">
        {aprobada && r.minutesApprovedAt ? `Acta aprobada el ${fechaHora(r.minutesApprovedAt)} h.` : "Pendiente de aprobación."}
      </footer>
    </main>
  );
}
