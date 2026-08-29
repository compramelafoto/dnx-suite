import Link from "next/link";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { resolveEnabledNavModules } from "@/lib/modules/nav";
import { submodulesFor } from "@/lib/modules/submodules";
import { canManageMembers } from "@/lib/members/role-policy";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";

export default async function WorkspaceHomePage() {
  const user = await requireAuth();
  const ensured = await ensureFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  const [branding, profile, enabledModuleKeys] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: ensured.workspaceId },
    }),
    prisma.fotofficePhotographerProfile.findUnique({ where: { userId: user.id } }),
    getEnabledModuleKeysForWorkspace(ensured.workspaceId),
  ]);
  const modules = resolveEnabledNavModules(enabledModuleKeys);

  // Las tarjetas listan las pantallas de cada módulo. Sin esto, desde el inicio no había forma
  // de enterarse de que existían: la tarjeta decía "Socios" y nada más.
  const puedeAdministrarSocios = canManageMembers(
    await resolveWorkspaceRole(user.id, ensured.workspaceId),
  );

  const pending: string[] = [];
  if (!profile?.displayName) pending.push("Nombre visible");
  if (!branding?.activityType) pending.push("Tipo de organización");
  if (!branding?.city) pending.push("Ciudad");
  if (!branding?.specialties?.length) pending.push("Especialidades");
  if (!branding?.logoUrl) pending.push("Logo del negocio");

  const display = profile?.displayName ?? user.name ?? "fotógrafo";

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--fo-text)]">
          Hola, {display}
        </h1>
        <p className="text-[var(--fo-muted)] leading-relaxed max-w-2xl">
          Este es tu workspace de{" "}
          <strong className="text-[var(--fo-text)] font-medium">
            {branding?.commercialName ?? "tu negocio"}
          </strong>
          . Desde acá vas a administrar clientes, trabajos y la operación del estudio.
        </p>
      </section>

      <section className="fo-card space-y-4">
        <h2 className="text-lg font-semibold text-[var(--fo-text)]">Estado de configuración</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Perfil y negocio con lo esencial completo.
          </p>
        ) : (
          <>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Todavía podés completar:
            </p>
            <ul className="list-disc pl-5 text-sm text-[var(--fo-text)] space-y-1">
              {pending.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link href="/workspace/configuracion" className="fo-btn fo-btn-primary inline-flex w-fit">
              Completar configuración
            </Link>
          </>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--fo-text)]">Módulos</h2>
        {modules.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {modules.map((m) => {
              // El permiso es por módulo: el de Socios no habilita nada en otro.
              const pantallas = submodulesFor(m.key, {
                canManage:
                  m.key === MEMBERS_MODULE_KEY ? puedeAdministrarSocios : true,
              });
              return (
                <div
                  key={m.key}
                  className="fo-card flex flex-col gap-3 transition-colors hover:border-[var(--fo-accent)]/40"
                >
                  <Link href={m.route} className="font-medium text-[var(--fo-text)] hover:underline">
                    {m.label}
                  </Link>
                  {pantallas.length > 0 ? (
                    <ul className="space-y-1.5">
                      {pantallas.map((sub) => (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            className="group block rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-[var(--fo-surface-hover)]"
                          >
                            <span className="block text-sm text-[var(--fo-text)] group-hover:text-[var(--fo-accent)]">
                              {sub.label}
                            </span>
                            <span className="block text-xs text-[var(--fo-muted)] leading-relaxed">
                              {sub.description}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Todavía no tenés módulos habilitados en este workspace. Pedí a un administrador de
            plataforma que active alguno.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--fo-text)]">Accesos rápidos</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/workspace/configuracion" className="fo-card hover:border-[var(--fo-accent)]/40">
            <p className="font-medium text-[var(--fo-text)]">Configuración del negocio</p>
            <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
              Nombre, contacto, ubicación y especialidades.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
