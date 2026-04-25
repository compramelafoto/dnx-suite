import Link from "next/link";
import { prisma } from "@repo/db";
import { requireActiveWorkspace, isCoursesSalesEnabledForWorkspace } from "@/lib/workspace";
import { isMissingCoursesSalesSchemaError } from "@/lib/courses-sales/prisma-errors";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ courses?: string; forbidden?: string }>;
}) {
  const { user, workspace } = await requireActiveWorkspace();
  const sp = await searchParams;
  const coursesOff = sp.courses === "off";
  const forbiddenAdmin = sp.forbidden === "admin";

  const memberships = await prisma.membership.count({ where: { userId: user.id } });
  const coursesOn =
    workspace !== null ? await isCoursesSalesEnabledForWorkspace(workspace.id) : false;

  let branding: { publicSlug: string; commercialName: string } | null = null;
  if (workspace !== null) {
    try {
      branding = await prisma.fotofficeWorkspaceBranding.findUnique({
        where: { workspaceId: workspace.id },
        select: { publicSlug: true, commercialName: true },
      });
    } catch (e) {
      if (!isMissingCoursesSalesSchemaError(e)) throw e;
    }
  }

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--fo-text)]">
          Hola{user.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-[var(--fo-muted)] max-w-2xl leading-relaxed">
          Panel de Fotoffice. Gestioná la venta de cursos de tu workspace cuando el módulo esté
          activo.
        </p>
      </header>

      {forbiddenAdmin ? (
        <div className="fo-card fo-alert-error" role="alert">
          <p className="text-sm text-[var(--fo-text)] font-medium">Acceso denegado</p>
          <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
            No tenés permisos para el panel de administración general. Si creés que es un error,
            contactá a un SUPER_ADMIN.
          </p>
        </div>
      ) : null}

      {coursesOff ? (
        <div
          className="fo-card fo-alert-warning"
          role="status"
        >
          <p className="text-sm text-[var(--fo-text)] font-medium">Módulo desactivado</p>
          <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
            El módulo «Venta de cursos» no está habilitado para este workspace. Contactá al
            administrador de la plataforma o elegí otro workspace.
          </p>
        </div>
      ) : null}

      {memberships === 0 ? (
        <div className="fo-card">
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Tu usuario no tiene workspaces asignados. Pedí a un administrador que te invite a un
            workspace.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="fo-card space-y-3">
          <h2 className="text-base font-semibold text-[var(--fo-text)]">Workspace</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            {workspace ? (
              <>
                <span className="text-[var(--fo-text)] font-medium">{workspace.name}</span>
                {branding ? (
                  <>
                    <br />
                    Nombre comercial: {branding.commercialName}
                    <br />
                    Slug público:{" "}
                    <code className="text-xs bg-[var(--fo-code-bg)] px-1.5 py-0.5 rounded border border-[var(--fo-border)]">
                      {branding.publicSlug}
                    </code>
                  </>
                ) : coursesOn ? (
                  <>
                    <br />
                    Configurá branding y slug público en{" "}
                    <Link href="/courses/settings" className="text-[var(--fo-accent)] underline">
                      Configuración del módulo
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    <br />
                    Cuando el módulo esté activo podrás configurar marca y slug público para las
                    landings.
                  </>
                )}
              </>
            ) : (
              "No hay workspace activo."
            )}
          </p>
        </div>

        <div className="fo-card space-y-3">
          <h2 className="text-base font-semibold text-[var(--fo-text)]">Venta de cursos</h2>
          {coursesOn ? (
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              El módulo está activo. Podés gestionar{" "}
              <Link href="/dashboard/courses" className="text-[var(--fo-accent)] underline">
                cursos
              </Link>
              ,{" "}
              <Link href="/courses/teachers" className="text-[var(--fo-accent)] underline">
                docentes
              </Link>{" "}
              e{" "}
              <Link href="/courses/leads" className="text-[var(--fo-accent)] underline">
                inscripciones
              </Link>
              .
            </p>
          ) : (
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              El módulo no está habilitado para este workspace. Los ítems de menú del módulo no se
              muestran hasta que un administrador de plataforma lo active.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
