import { notFound } from "next/navigation";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import { getEditionById } from "@/lib/admin/editions/queries";
import { DIPLOMA_CANDIDATE_QUERY, selectDiplomaCandidates } from "@/lib/diplomas/diploma-eligibility";
import { DIPLOMA_EMAIL_OUTBOX_EVENT_TYPE, previewDiplomaEmailBatch } from "@/lib/diplomas/diploma-email";
import { resolveDiplomaTemplate } from "@/lib/diplomas/diploma-template";
import { DIPLOMA_ERROR_MESSAGES } from "@/lib/diplomas/diploma-types";
import {
  deriveDiplomaRowState,
  elegirPiezaDeLaFila,
} from "@/lib/diplomas/ui/diploma-row-presentation";
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
    const [registrationRows, cardRows, issueRows, deadEmailEvents] = await Promise.all([
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
      // Misma tabla (`ClickatonDiplomaIssue`) que resuelve el correo: sólo
      // existe una fila acá una vez que el diploma se emitió (`emitido`).
      prisma.clickatonDiplomaIssue.findMany({
        where: { editionId, revokedAt: null },
        select: { id: true, registrationId: true, emailStatus: true },
      }),
      // El emisor (arriba) se queda en emailStatus "QUEUED" para siempre si
      // el evento del buzón de salida agotó sus reintentos automáticos —
      // "QUEUED" no lo dice: hay que consultar el evento aparte para
      // distinguir "se está por mandar" de "nunca se va a mandar solo".
      prisma.clickatonIntegrationOutboxEvent.findMany({
        where: { editionId, eventType: DIPLOMA_EMAIL_OUTBOX_EVENT_TYPE, status: "DEAD" },
        select: { aggregateId: true },
      }),
    ]);
    return { registrationRows, cardRows, issueRows, deadEmailEvents };
  });

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Diplomas de participación" breadcrumbs={breadcrumbs} />
        <AdminMigrationNotice message={loaded.message} />
      </div>
    );
  }

  const { registrationRows, cardRows, issueRows, deadEmailEvents } = loaded.data;
  const candidates = selectDiplomaCandidates(registrationRows);
  // Una inscripción puede tener varias piezas a la vez (la emitida más la
  // que dejó un "Rehacer" en curso, más las viejas en STALE): se agrupan y
  // `elegirPiezaDeLaFila` decide cuál manda. Antes se quedaba con la última
  // que devolviera la base, que es decir cualquiera.
  const cardsByRegistration = new Map<string, typeof cardRows>();
  for (const card of cardRows) {
    const lista = cardsByRegistration.get(card.registrationId) ?? [];
    lista.push(card);
    cardsByRegistration.set(card.registrationId, lista);
  }
  const issueByRegistration = new Map(issueRows.map((i) => [i.registrationId, i]));
  // `aggregateId` del evento es el `diplomaId` (ver `diploma-email.ts`).
  const deadEmailDiplomaIds = new Set(deadEmailEvents.map((e) => e.aggregateId));

  const rows: DiplomaPanelRow[] = [];
  // Misma fuente que las filas de la tabla, no una consulta aparte: si la
  // cuenta de la confirmación saliera de `issueRows` directo (como en la
  // ronda anterior), podía incluir un diploma cuya inscripción ya no está
  // acreditada (se revirtió el check-in después de emitirlo) — esa fila no
  // aparece en `candidates`/`rows`, pero seguía contando en el diálogo. El
  // número que ve la persona tiene que ser exactamente el de lo que ve en
  // pantalla.
  const emailPreviewInput: { email: string; emailStatus: string }[] = [];

  for (const c of candidates) {
    const card = elegirPiezaDeLaFila(cardsByRegistration.get(c.registrationId) ?? []);
    const issue = issueByRegistration.get(c.registrationId) ?? null;
    rows.push({
      registrationId: c.registrationId,
      fullName: c.fullName,
      visibleCode: c.visibleCode,
      accreditedAtIso: c.accreditedAt.toISOString(),
      state: deriveDiplomaRowState(card),
      errorCode: card?.errorCode ?? null,
      diplomaId: issue?.id ?? null,
      emailStatus: issue?.emailStatus ?? null,
      emailDead: issue ? deadEmailDiplomaIds.has(issue.id) : false,
    });
    if (issue) {
      emailPreviewInput.push({ email: c.email, emailStatus: issue.emailStatus });
    }
  }
  rows.sort((a, b) => a.accreditedAtIso.localeCompare(b.accreditedAtIso));

  const emitidos = rows.filter((r) => r.state === "emitido").length;
  const enProceso = rows.filter((r) => r.state === "en_proceso").length;
  const fallidos = rows.filter((r) => r.state === "fallido").length;
  // Lo que "Generar los diplomas" va a encolar ahora mismo: nuevos (sin
  // pieza todavía) más los que agotaron sus reintentos y hay que revivir.
  // Los que ya están en curso no se tocan (ver `enqueueDiplomaQueueRow`).
  const porGenerar = rows.length - emitidos - enProceso;

  // Cuenta previa para el diálogo de confirmación de "Enviar por correo" —
  // misma clasificación que después aplica `enqueueEditionDiplomaEmails`,
  // pero de sólo lectura y sobre el mismo universo que `rows` (ver arriba).
  const emailPreview = previewDiplomaEmailBatch(emailPreviewInput);

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
        pendingEmailCount={emailPreview.pending}
        withoutEmailCount={emailPreview.withoutEmail}
        rows={rows}
      />
    </div>
  );
}
