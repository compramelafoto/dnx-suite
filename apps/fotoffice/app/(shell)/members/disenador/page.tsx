import Link from "next/link";
import { redirect } from "next/navigation";
import { canDesignTemplates } from "@/lib/template-v2/access";
import { prisma } from "@repo/db";
import { CreateTemplateV2Button } from "@repo/template-editor-ui";
import { CreateCarnetTemplate } from "@/components/members/create-carnet-template";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
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

  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  // Diseñar la identidad visual es atribución de quien gobierna la institución, no de quien
  // administra el día a día.
  if (!canDesignTemplates(membership?.role)) redirect("/workspace");

  // Las tablas del editor todavía no existen en todas las bases: hay una migración vieja que
  // las salteó a propósito. Sin esta tolerancia, la pantalla rompería con un error de Prisma en
  // vez de explicar qué falta. Mismo criterio que `withClickatonDb`.
  let templates: Plantilla[] = [];
  let faltaMigracion = false;
  try {
    templates = await prisma.templateV2.findMany({
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
  } catch (error) {
    if (!esTablaAusente(error)) throw error;
    faltaMigracion = true;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Plantillas"
        description="El diseño de las piezas de la institución: el carnet de socio y lo que venga después."
        actions={<CreateTemplateV2Button />}
      />

      {faltaMigracion ? (
        <section className="fo-card space-y-2 p-8">
          <p className="text-sm font-medium">El editor de plantillas todavía no está habilitado.</p>
          <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
            Falta crear las tablas del módulo de diseño en esta base de datos. Es una migración
            pendiente, no un error de esta pantalla.
          </p>
        </section>
      ) : templates.length === 0 ? (
        <section className="fo-card space-y-3 p-8">
          <p className="text-sm">Todavía no hay plantillas.</p>
          <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
            El carnet ya tiene un diseño de fábrica. Traelo acá y vas a poder cambiarle los
            colores, la tipografía y la disposición sin tocar código.
          </p>
          <CreateCarnetTemplate />
        </section>
      ) : (
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
                    {t.currentVersionId ? (
                      <Link
                        href={`/members/disenador/${t.id}/${t.currentVersionId}`}
                        className="underline underline-offset-2"
                      >
                        Abrir editor
                      </Link>
                    ) : (
                      <span className="text-xs text-[var(--fo-muted-soft)]">Sin versión</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
