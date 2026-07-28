import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  releasePromptAction,
  upsertPromptAction,
} from "@/lib/timeline/admin-actions";
import { fixedClock } from "@/lib/timeline/clock";
import { toPromptPublicDto, assertLockedDtoIsSafe } from "@/lib/timeline/prompt-dto";
import type { PromptRecord } from "@/lib/timeline/types";

type Props = { params: Promise<{ editionId: string }> };

export default async function EditionPromptsAdminPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true, slug: true },
  });
  if (!edition) notFound();

  const prompts = await prisma.clickatonPrompt.findMany({
    where: { editionId },
    orderBy: { sequence: "asc" },
  });

  const simulatedBefore = fixedClock(new Date("2026-09-19T09:00:00-03:00"));

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`Consignas · ${edition.name}`}
        description="Contenido secreto solo en servidor hasta RELEASED. La vista segura muestra el DTO LOCKED del participante."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Consignas" },
        ]}
        actions={
          <Button href={`${adminRoutes.editions}/${editionId}/cronograma`} variant="secondary">
            Cronograma
          </Button>
        }
      />

      <Card variant="outlined" className="space-y-4 p-5">
        <h2 className="font-semibold">Nueva / editar consigna</h2>
        <form action={upsertPromptAction.bind(null, editionId)} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            ID (vacío = crear)
            <input name="promptId" className="mt-1 w-full rounded border border-ck-border bg-transparent px-3 py-2" />
          </label>
          <label className="text-sm">
            Secuencia
            <input
              name="sequence"
              type="number"
              defaultValue={(prompts[prompts.length - 1]?.sequence ?? 0) + 1}
              className="mt-1 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Nombre interno
            <input
              name="internalName"
              placeholder="prompt-1"
              className="mt-1 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Estado
            <select name="status" defaultValue="DRAFT" className="mt-1 w-full rounded border border-ck-border bg-transparent px-3 py-2">
              <option value="DRAFT">DRAFT</option>
              <option value="READY">READY</option>
              <option value="LOCKED">LOCKED</option>
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            Título (secreto)
            <input name="title" className="mt-1 w-full rounded border border-ck-border bg-transparent px-3 py-2" />
          </label>
          <label className="text-sm md:col-span-2">
            Instrucciones (secreto)
            <textarea name="instructions" rows={4} className="mt-1 w-full rounded border border-ck-border bg-transparent px-3 py-2" />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" variant="primary">
              Guardar
            </Button>
          </div>
        </form>
        <p className="text-xs text-ck-text-muted">
          Seed Argentina 2026: sin textos reales. No publicar consignas LIVE.
        </p>
      </Card>

      <ul className="space-y-6">
        {prompts.map((p) => {
          const record = p as PromptRecord;
          const lockedPreview = toPromptPublicDto(record, { clock: simulatedBefore });
          let leakWarning: string | null = null;
          try {
            if (lockedPreview.status === "LOCKED") assertLockedDtoIsSafe(lockedPreview);
          } catch {
            leakWarning = "ADVERTENCIA: el DTO LOCKED contiene campos secretos.";
          }
          return (
            <li key={p.id}>
              <Card variant="outlined" className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      #{p.sequence} · {p.internalName} · {p.status}
                    </p>
                    <p className="text-sm text-ck-text-secondary">
                      Admin ve título: {p.title?.trim() ? p.title : "(vacío)"}
                    </p>
                    <p className="font-mono text-xs text-ck-text-muted">{p.id}</p>
                  </div>
                  {p.status !== "RELEASED" && p.status !== "CANCELLED" ? (
                    <form action={releasePromptAction.bind(null, editionId, p.id)}>
                      <Button type="submit" variant="primary" size="sm">
                        Liberar consigna ahora
                      </Button>
                    </form>
                  ) : (
                    <span className="text-sm text-ck-yellow">Ya liberada / cancelada</span>
                  )}
                </div>
                <div className="rounded border border-dashed border-ck-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ck-yellow">
                    Vista segura antes de apertura
                  </p>
                  <pre className="mt-3 overflow-x-auto text-xs text-ck-text-secondary">
                    {JSON.stringify(lockedPreview, null, 2)}
                  </pre>
                  {leakWarning ? (
                    <p className="mt-2 text-sm text-red-400" role="alert">
                      {leakWarning}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-ck-text-muted">
                      Payload LOCKED sin title / instructions / assets.
                    </p>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      {prompts.length === 0 ? (
        <p className="text-sm text-ck-text-muted">Sin consignas. Creá DRAFT vacías desde el formulario o el seed.</p>
      ) : null}
    </div>
  );
}
