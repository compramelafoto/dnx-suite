import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { listUserProfiles } from "@/lib/portal/profiles";
import { doorPathFor, resolveDoorDestination } from "@/lib/entrada/institution-door";
import { InstitutionDoorLogin } from "./institution-door-login";

export const dynamic = "force-dynamic";

/**
 * La puerta de una institución: `fotoffice.com/w/sfpr/entrar`.
 *
 * Una sola ruta hace las dos mitades, y por eso no hace falta ninguna cookie: sin sesión
 * muestra el formulario con el nombre y el logo de la institución; con sesión resuelve a dónde
 * va esa persona *dentro de esa institución*. El formulario se manda a sí mismo como `next`,
 * que es el mecanismo que el panel de login ya sabe llevar tanto en el campo oculto como en
 * el botón de Google.
 *
 * Lo que gana la persona: si tiene su estudio Y es socia de SFPR, entrar por esta puerta ya
 * contesta la pregunta de a cuál de los dos viene. Por la puerta general habría que
 * preguntarle.
 *
 * Lo que NO hace: bloquear. Un fotógrafo que entra por la puerta de SFPR sin ser nada de SFPR
 * entra igual, a lo suyo. Es una comodidad, no una tranquera — los controles de acceso siguen
 * viviendo en cada ruta.
 */
export default async function PuertaInstitucionPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true, logoUrl: true },
  });
  if (!branding) notFound();

  const workspace = await prisma.workspace.findUnique({
    where: { id: branding.workspaceId },
    select: { name: true },
  });
  const nombre = branding.commercialName?.trim() || workspace?.name || "la institución";

  const user = await getAuthUser();

  if (user) {
    const destino = resolveDoorDestination({
      workspaceId: branding.workspaceId,
      profiles: await listUserProfiles(user.id),
    });

    if ("redirectTo" in destino) redirect(destino.redirectTo);

    /*
      Tiene sesión pero no es nada de esta institución. No se lo echa ni se lo manda en
      silencio a otro lado: se le dice dónde está parado y con qué cuenta, que es lo único
      que le falta saber para resolverlo. Mandarlo callado a su propio panel lo dejaría
      pensando que la institución no lo tiene registrado.
    */
    return (
      <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
          <section className="fo-card space-y-5 p-6">
            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">
                No te encontramos en {nombre}
              </h1>
              <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
                Entraste con <strong className="break-all">{user.email}</strong>, y con esa
                dirección no figurás en {nombre}. Si sabés que te registraron con otro correo,
                salí y entrá con ese.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <form action="/api/auth/logout" method="post" className="sm:flex-1">
                <button type="submit" className="fo-btn w-full min-h-11">
                  Salir y entrar con otro correo
                </button>
              </form>
              <Link href="/" className="fo-btn fo-btn-secondary min-h-11 sm:flex-1 text-center">
                Ir a lo mío
              </Link>
            </div>

            <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
              Tu sesión sigue abierta y no se creó nada a tu nombre.
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <InstitutionDoorLogin
      institutionName={nombre}
      logoUrl={branding.logoUrl}
      // Volver acá después de entrar es lo que hace que la puerta signifique algo: es el dato
      // de "vengo a esta institución" viajando por el `next` que ya existía.
      doorPath={doorPathFor(workspaceSlug)}
    />
  );
}
