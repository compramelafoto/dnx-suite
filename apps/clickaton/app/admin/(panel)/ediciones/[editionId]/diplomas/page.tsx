import { notFound } from "next/navigation";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import { getEditionById } from "@/lib/admin/editions/queries";
import { DIPLOMA_CANDIDATE_QUERY, selectDiplomaCandidates } from "@/lib/diplomas/diploma-eligibility";
import { resolveDiplomaTemplate } from "@/lib/diplomas/diploma-template";
import { DIPLOMA_ERROR_MESSAGES } from "@/lib/diplomas/diploma-types";
import { deriveDiplomaRowState } from "@/lib/diplomas/ui/diploma-row-presentation";
import { DiplomasPanelClient, type DiplomaPanelRow } from "./DiplomasPanelClient";

type Props = { params: Promise<{ editionId: string }> };

export default async function EditionDiplomasPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;

  const editionResult = await getEditionById(editionId);
  if (!editionResult.ok || !editionResult.data) notFound();
  const edition = editionResult.data;

  const breadcrumbs = [
    { label: "Ediciones", href: adminRoutes.editions },
    { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
    { label: "Diplomas" },
  ];

  // No depende del resto de la carga: si la plantilla no resuelve (falta,
  // deshabilitada, o la tabla de asignación todavía no existe en esta base),
  // `resolveDiplomaTemplate` ya devuelve un motivo controlado — nunca revienta.
  const template = await resolveDiplomaTemplate({ editionId });

  // `ClickatonDiplomaIssue`/el tipo `DIPLOMA` de la pieza son de la migración
  // más reciente: puede no estar aplicada todavía en esta base. Igual que
  // Placas, si falla se avisa en vez de tirar un 500.
  const loaded = await withClickatonDb(async () => {
    const [registrationRows, cardRows] = await Promise.all([
      // Misma consulta que usa el encolado real (`diploma-batch.ts`): sin
      // filtrar por estado de inscripción, para que lo que se ve acá sea
      // exactamente lo que "Generar los diplomas" va a encolar.
      prisma.clickatonRegistration.findMany({
        where: { editionId },
        ...DIPLOMA_CANDIDATE_QUERY,
      }),
      prisma.clickatonParticipantCard.findMany({
        where: { editionId, cardType: "DIPLOMA" },
        select: { registrationId: true, status: true, errorCode: true, attemptCount: true },
      }),
    ]);
    return { registrationRows, cardRows };
  });

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Diplomas de participación" breadcrumbs={breadcrumbs} />
        <AdminMigrationNotice message={loaded.message} />
      </div>
    );
  }

  const { registrationRows, cardRows } = loaded.data;
  const candidates = selectDiplomaCandidates(registrationRows);
  const cardByRegistration = new Map(cardRows.map((c) => [c.registrationId, c]));

  const rows: DiplomaPanelRow[] = candidates
    .map((c) => {
      const card = cardByRegistration.get(c.registrationId) ?? null;
      return {
        registrationId: c.registrationId,
        fullName: c.fullName,
        visibleCode: c.visibleCode,
        accreditedAtIso: c.accreditedAt.toISOString(),
        state: deriveDiplomaRowState(card),
        errorCode: card?.errorCode ?? null,
      };
    })
    .sort((a, b) => a.accreditedAtIso.localeCompare(b.accreditedAtIso));

  const emitidos = rows.filter((r) => r.state === "emitido").length;
  const enProceso = rows.filter((r) => r.state === "en_proceso").length;
  const fallidos = rows.filter((r) => r.state === "fallido").length;
  // Lo que "Generar los diplomas" va a encolar ahora mismo: nuevos (sin
  // pieza todavía) más los que agotaron sus reintentos y hay que revivir.
  // Los que ya están en curso no se tocan (ver `enqueueDiplomaQueueRow`).
  const porGenerar = rows.length - emitidos - enProceso;

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Diplomas de participación"
        description={`${rows.length} acreditado${rows.length === 1 ? "" : "s"} · ${emitidos} diploma${
          emitidos === 1 ? "" : "s"
        } emitido${emitidos === 1 ? "" : "s"} · ${fallidos} fallido${fallidos === 1 ? "" : "s"}.`}
        breadcrumbs={breadcrumbs}
      />

      {!template.ok ? (
        <Card variant="outlined" className="space-y-3 p-5">
          <p className="text-sm text-ck-text">{DIPLOMA_ERROR_MESSAGES[template.code]}</p>
          {template.issues.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-xs text-ck-text-muted">
              {template.issues.map((issue, i) => (
                <li key={`${i}-${issue}`}>{issue}</li>
              ))}
            </ul>
          ) : null}
          <a
            href={`${adminRoutes.editions}/${editionId}/placas`}
            className="inline-block text-sm text-ck-yellow underline-offset-2 hover:underline"
          >
            Ir a Placas para asignar la plantilla
          </a>
        </Card>
      ) : null}

      <DiplomasPanelClient
        editionId={editionId}
        templateName={template.ok ? template.source.templateName : null}
        pendingCount={porGenerar}
        rows={rows}
      />
    </div>
  );
}
