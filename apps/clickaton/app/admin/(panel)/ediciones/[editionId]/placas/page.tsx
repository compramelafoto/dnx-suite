import { notFound } from "next/navigation";
import {
  listTemplateV2ForPicker,
  loadTemplateV2LegacyPayload,
} from "@repo/db/template-v2-repository";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import {
  assignCardTemplateFormAction,
  toggleCardTemplateFormAction,
} from "@/lib/admin/editions/card-template-mutations";
import { getEditionById } from "@/lib/admin/editions/queries";
import { validateClickatonCardTemplate } from "@/lib/participant-cards/participant-card-template-source";

type Props = {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
};

const CARDS = [
  {
    key: "welcome" as const,
    dbType: "WELCOME" as const,
    title: "Bienvenida",
    description: "Se genera al confirmarse el pago de la inscripción.",
  },
  {
    key: "member" as const,
    dbType: "MEMBER" as const,
    title: "Soy parte",
    description: "Placa de pertenencia que el participante puede compartir.",
  },
];

export default async function EditionCardTemplatesPage({ params, searchParams }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;
  const flash = await searchParams;

  const editionResult = await getEditionById(editionId);
  if (!editionResult.ok || !editionResult.data) notFound();
  const edition = editionResult.data;

  const loaded = await withClickatonDb(async () => {
    const [assignments, templates] = await Promise.all([
      prisma.clickatonCardTemplateAssignment.findMany({
        where: { editionId },
        select: {
          cardType: true,
          templateId: true,
          versionId: true,
          enabled: true,
          updatedAt: true,
        },
      }),
      listTemplateV2ForPicker(prisma, { limit: 100 }),
    ]);

    // Se valida la plantilla vigente de cada placa para avisar antes de que
    // falle en la generación real.
    const health = await Promise.all(
      assignments.map(async (a) => {
        const template = await loadTemplateV2LegacyPayload(prisma, {
          templateId: a.templateId,
          versionId: a.versionId,
        });
        if (!template) {
          return { cardType: a.cardType, name: null, problems: ["La plantilla ya no existe"] };
        }
        return {
          cardType: a.cardType,
          name: template.templateName,
          version: template.versionNumber,
          problems: validateClickatonCardTemplate(template.payload).map((i) => i.message),
        };
      })
    );

    return { assignments, templates, health };
  });

  const breadcrumbs = [
    { label: "Ediciones", href: adminRoutes.editions },
    { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
    { label: "Placas" },
  ];

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Placas" breadcrumbs={breadcrumbs} />
        <AdminMigrationNotice message={loaded.message} />
      </div>
    );
  }

  const { assignments, templates, health } = loaded.data;

  return (
    <div className="min-w-0 space-y-10">
      <AdminPageHeader
        title="Placas de participante"
        description="Elegí qué plantilla usa cada placa de esta edición. Sin plantilla elegida se usa el diseño oficial de Clickatón."
        breadcrumbs={breadcrumbs}
      />

      {flash.error ? (
        <Card variant="outlined" className="border-red-500/40 p-4 text-sm text-red-200">
          {flash.error}
        </Card>
      ) : null}
      {flash.ok ? (
        <Card variant="outlined" className="border-emerald-500/30 p-4 text-sm text-ck-text-secondary">
          Operación correcta ({flash.ok}).
        </Card>
      ) : null}

      {templates.length === 0 ? (
        <Card variant="outlined" className="space-y-2 p-5">
          <p className="text-sm text-ck-text-secondary">
            Todavía no hay plantillas guardadas en el editor visual.
          </p>
          <p className="text-xs text-ck-text-muted">
            Las plantillas se diseñan en el editor Template V2 y quedan disponibles acá
            automáticamente. Mientras tanto, las placas usan el diseño oficial.
          </p>
        </Card>
      ) : null}

      {CARDS.map((card) => {
        const assignment = assignments.find((a) => a.cardType === card.dbType);
        const status = health.find((h) => h.cardType === card.dbType);
        const usesTemplate = Boolean(assignment && assignment.enabled);
        const hasProblems = (status?.problems.length ?? 0) > 0;

        return (
          <section key={card.key} className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-ck-text">{card.title}</h2>
              <Badge variant="neutral">
                {usesTemplate && !hasProblems
                  ? "Plantilla propia"
                  : "Diseño oficial"}
              </Badge>
            </div>

            <Card variant="outlined" className="space-y-5 p-5">
              <p className="text-sm text-ck-text-muted">{card.description}</p>

              {assignment ? (
                <div className="space-y-2 rounded-lg border border-ck-border p-4">
                  <p className="text-sm text-ck-text">
                    Plantilla asignada:{" "}
                    <span className="font-medium">{status?.name ?? assignment.templateId}</span>
                    {status?.version ? (
                      <span className="text-ck-text-muted"> · versión {status.version}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-ck-text-muted">
                    {assignment.versionId
                      ? "Fijada a una versión: los cambios en el editor no afectan las placas hasta que la vuelvas a asignar."
                      : "Sigue la versión vigente: al guardar en el editor, las placas nuevas usan el diseño actualizado."}
                  </p>

                  {hasProblems ? (
                    <p className="text-sm text-red-200">
                      No se está usando: {status?.problems.join(" · ")}
                    </p>
                  ) : null}

                  {!assignment.enabled ? (
                    <p className="text-sm text-ck-text-secondary">
                      Pausada: las placas salen con el diseño oficial.
                    </p>
                  ) : null}

                  <form action={toggleCardTemplateFormAction}>
                    <input type="hidden" name="editionId" value={editionId} />
                    <input type="hidden" name="cardType" value={card.key} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={assignment.enabled ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="text-xs text-ck-text-secondary underline-offset-2 hover:underline"
                    >
                      {assignment.enabled ? "Pausar plantilla" : "Reactivar plantilla"}
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-sm text-ck-text-secondary">
                  Sin plantilla asignada: se usa el diseño oficial de Clickatón.
                </p>
              )}

              <form
                action={assignCardTemplateFormAction}
                className="space-y-4 border-t border-ck-border pt-5"
              >
                <input type="hidden" name="editionId" value={editionId} />
                <input type="hidden" name="cardType" value={card.key} />

                <Field id={`templateId-${card.key}`} label="Plantilla">
                  <Select name="templateId" defaultValue={assignment?.templateId ?? ""}>
                    <option value="">Diseño oficial de Clickatón</option>
                    {templates.map((t) => (
                      <option key={t.templateId} value={t.templateId}>
                        {t.name}
                        {t.canvasWidth && t.canvasHeight
                          ? ` (${t.canvasWidth}×${t.canvasHeight})`
                          : ""}
                        {t.product ? ` · ${t.product}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>

                <label className="flex items-center gap-2 text-sm text-ck-text-secondary">
                  <input
                    type="checkbox"
                    name="pinVersion"
                    defaultChecked={Boolean(assignment?.versionId)}
                  />
                  Fijar la versión actual (no seguir los cambios del editor)
                </label>

                <Button type="submit">Guardar</Button>
              </form>
            </Card>
          </section>
        );
      })}

      <Card variant="outlined" className="space-y-2 p-5">
        <p className="text-sm font-medium text-ck-text">Cómo funciona</p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-ck-text-muted">
          <li>
            La plantilla se valida al asignarla: si usa variables que Clickatón no conoce, se
            rechaza acá y no llega a producir una placa rota.
          </li>
          <li>
            Si una plantilla deja de ser válida más adelante, las placas vuelven solas al diseño
            oficial en vez de fallar.
          </li>
          <li>
            Cambiar el diseño regenera las placas: cada una guarda una huella del diseño con el
            que se hizo.
          </li>
        </ul>
      </Card>
    </div>
  );
}
