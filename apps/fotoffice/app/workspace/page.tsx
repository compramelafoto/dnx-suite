import Link from "next/link";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";

export default async function WorkspaceHomePage() {
  const user = await requireAuth();
  const ensured = await ensureFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  const [branding, profile] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: ensured.workspaceId },
    }),
    prisma.fotofficePhotographerProfile.findUnique({ where: { userId: user.id } }),
  ]);

  const pending: string[] = [];
  if (!profile?.displayName) pending.push("Nombre visible");
  if (!branding?.activityType) pending.push("Tipo de actividad");
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
        <h2 className="text-lg font-semibold text-[var(--fo-text)]">Accesos rápidos</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/workspace/configuracion" className="fo-card hover:border-[var(--fo-accent)]/40">
            <p className="font-medium text-[var(--fo-text)]">Configuración del negocio</p>
            <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
              Nombre, contacto, ubicación y especialidades.
            </p>
          </Link>
          <div className="fo-card border-dashed opacity-80">
            <p className="font-medium text-[var(--fo-text)]">Nuevo trabajo</p>
            <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
              Módulo aún no implementado.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
