import { redirect } from "next/navigation";
import { canDesignTemplates } from "@/lib/template-v2/access";
import { prisma } from "@repo/db";
import {
  CreateTemplateV2Button,
  TEMPLATE_V2_BASE_PATHS,
  TemplateV2RowActions,
  templateV2EditorPath,
} from "@repo/template-editor-ui";
import { CreateCarnetTemplate } from "@/components/members/create-carnet-template";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { listKeyedTemplates } from "@/lib/template-v2/keyed-template";
import { isPlacaTemplateKey } from "@/lib/placas/constants";
import { CARNET_TEMPLATE_KEY } from "@/lib/carnet/template";
// El import registra el runtime del editor: base, sesión y almacenamiento de esta app.
import "@/lib/template-v2/server";

export const dynamic = "force-dynamic";

type Plantilla = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  currentVersionId: string | null;
  updatedAt: Date;
};

/** Prisma avisa la tabla ausente con P2021; el mensaje crudo cubre el resto de los casos. */
function esTablaAusente(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "P2021" || code === "P2022") return true;
  const message = "message" in error ? String((error as { message?: unknown }).message) : "";
  return /(?:table|relation).*does not exist/i.test(message);
}

const fecha = (v: Date | null) =>
  v ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(v) : "—";

/**
 * Plantillas de la institución.
 *
 * Se listan las del workspace activo, no las del usuario: la plantilla es de la institución.
 * Si dependiera de quién la creó, el día que esa persona deja la comisión directiva la
 * institución perdería su propio carnet.
 */
export default async function PlantillasPage() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  // Diseñar la identidad visual pide gestionar Socios (members MANAGE), no sólo consultarlo.
  if (!(await canDesignTemplates(user.id, workspace.id))) redirect("/workspace");

  const v = await loadPersonVocabulary(workspace.id);

  // Las tablas del editor todavía no existen en todas las bases: hay una migración vieja que
  // las salteó a propósito. Sin esta tolerancia, la pantalla rompería con un error de Prisma en
  // vez de explicar qué falta. Mismo criterio que `withClickatonDb`.
  let templates: Plantilla[] = [];
  let faltaMigracion = false;
  let tieneCarnet = false;
  let carnetId: string | null = null;
  try {
    // Las placas de Comunicación se diseñan con este mismo editor, pero son de otra área y
    // tienen su propia lista (Comunicación → Plantillas). Acá no se mezclan.
    const conMarca = await listKeyedTemplates(workspace.id);
    const placas = new Set(
      conMarca.filter((t) => isPlacaTemplateKey(t.templateKey)).map((t) => t.templateId),
    );
    carnetId = conMarca.find((t) => t.templateKey === CARNET_TEMPLATE_KEY)?.templateId ?? null;
    tieneCarnet = carnetId !== null;
    const todas = await prisma.templateV2.findMany({
      where: { workspaceId: workspace.id, status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        currentVersionId: true,
        updatedAt: true,
      },
    });
    templates = todas.filter((t) => !placas.has(t.id));
  } catch (error) {
    if (!esTablaAusente(error)) throw error;
    faltaMigracion = true;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Plantillas"
        description={`El diseño de las piezas de la institución: el carnet de ${v.singular} y lo que venga después.`}
        actions={<CreateTemplateV2Button basePath={TEMPLATE_V2_BASE_PATHS.fotoffice} />}
      />

      {faltaMigracion ? (
        <section className="fo-card space-y-2 p-8">
          <p className="text-sm font-medium">El editor de plantillas todavía no está habilitado.</p>
          <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
            Falta crear las tablas del módulo de diseño en esta base de datos. Es una migración
            pendiente, no un error de esta pantalla.
          </p>
        </section>
      ) : !tieneCarnet && templates.length === 0 ? (
        <section className="fo-card space-y-3 p-8">
          <p className="text-sm">Todavía no hay plantillas.</p>
          <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
            El carnet ya tiene un diseño de fábrica. Traelo acá y vas a poder cambiarle los
            colores, la tipografía y la disposición sin tocar código.
          </p>
          <CreateCarnetTemplate />
        </section>
      ) : (
        <>
        {!tieneCarnet ? (
          <section className="fo-card space-y-3 p-6">
            <p className="text-sm">El carnet todavía usa el diseño de fábrica.</p>
            <CreateCarnetTemplate />
          </section>
        ) : null}
        <section className="fo-card overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--fo-border)] text-[var(--fo-muted-soft)]">
              <tr>
                <th className="px-5 py-3 font-medium">Plantilla</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Última edición</th>
                <th className="px-5 py-3 font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-[var(--fo-border)]">
                  <td className="px-5 py-3">
                    <p className="font-medium">{t.name}</p>
                    {t.description ? (
                      <p className="text-xs text-[var(--fo-muted)]">{t.description}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--fo-muted)]">{t.status}</td>
                  <td className="px-5 py-3 text-[var(--fo-muted)]">{fecha(t.updatedAt)}</td>
                  <td className="px-5 py-3">
                    <TemplateV2RowActions
                      templateId={t.id}
                      name={t.name}
                      editorHref={
                        t.currentVersionId
                          ? templateV2EditorPath(
                              TEMPLATE_V2_BASE_PATHS.fotoffice,
                              t.id,
                              t.currentVersionId,
                            )
                          : null
                      }
                      deleteWarning={
                        t.id === carnetId
                          ? `Es el diseño del carnet: los carnets van a volver al diseño de fábrica.`
                          : undefined
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        </>
      )}
    </div>
  );
}
