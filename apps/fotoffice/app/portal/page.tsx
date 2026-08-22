import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { resolveFotofficeUserKind } from "@/lib/portal/user-kind";

export const dynamic = "force-dynamic";

/**
 * Portal del socio.
 *
 * Destino real de quien activa su acceso, y frontera con el panel administrativo: acá se
 * entra por tener ficha de socio propia, no por un rol de equipo.
 *
 * A propósito NO muestra módulos: hoy no hay pagos, comprobantes ni beneficios. Anunciarlos
 * sería prometer algo que no existe; el mensaje dice lo que es cierto y nada más.
 */
export default async function PortalPage() {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);

  if (!context) {
    // Quien no es socio no tiene nada que hacer acá. Si administra una institución se lo
    // devuelve a su panel; si no, al inicio de sesión.
    const kind = await resolveFotofficeUserKind(user.id);
    redirect(kind === "TEAM" ? "/workspace" : "/login");
  }

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: context.workspace.id },
    select: { commercialName: true, logoUrl: true },
  });
  const institution = branding?.commercialName?.trim() || context.workspace.name;

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-lg px-4 py-16">
        <section className="fo-card space-y-6">
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- el logo es una URL externa de R2
              <img
                src={branding.logoUrl}
                alt=""
                className="h-12 w-12 rounded-lg object-contain"
              />
            ) : null}
            <p className="text-sm font-semibold">{institution}</p>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">
              Hola, {context.member.firstName}
            </h1>
            <p className="text-sm text-[var(--fo-text)]">Tu acceso está activo.</p>
          </div>

          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Acá vas a encontrar los servicios que {institution} habilite para sus socios. Todavía
            no hay nada disponible; cuando lo haya, lo vas a ver en esta pantalla.
          </p>

          <form action="/api/auth/logout" method="post">
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">
              Cerrar sesión
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
