import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { readProfileChoice } from "@/lib/portal/profile-choice";
import { listUserProfiles } from "@/lib/portal/profiles";
import { doorPathFor, resolveDoorDestination } from "@/lib/entrada/institution-door";
import { PORTAL_HOME } from "@/lib/portal/destination";
import { InstitutionDoorLogin } from "./institution-door-login";
import { findInactiveMembership } from "@/lib/portal/inactive-membership";
import { formatMinorArs } from "@/lib/membership/money";
import { InactiveMemberActions } from "./inactive-member-actions";

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
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ espacio?: string; fecha?: string; pago?: string }>;
}) {
  const { workspaceSlug } = await params;
  const query = await searchParams;
  // Si se llegó desde una reserva, la puerta la recuerda (y descarta lo que no sea un id o un
  // día: ver `doorPathFor`).
  const puerta = query.espacio
    ? doorPathFor(workspaceSlug, { spaceId: query.espacio, ymd: query.fecha })
    : doorPathFor(workspaceSlug);
  const reserva = puerta.includes("?") ? puerta.slice(puerta.indexOf("?")) : "";

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
      rememberedKey: await readProfileChoice(),
    });

    if ("redirectTo" in destino) {
      // Al panel se va por `entrar/panel`, que deja esta institución activa: una página no puede
      // escribir cookies, y sin eso una cookie vieja abriría otra institución.
      if (destino.activateWorkspaceId) redirect(`${doorPathFor(workspaceSlug)}/panel`);
      // El socio que venía de reservar vuelve a esa reserva, ahora con su precio.
      if (reserva && destino.redirectTo === PORTAL_HOME) redirect(`/portal/reservas${reserva}`);
      redirect(destino.redirectTo);
    }

    /*
      Figura, pero dado de baja. Decirle "no te encontramos" sería falso y lo mandaría a probar
      con otro correo o a crearse otra cuenta. Se le dice lo que pasa y cómo volver.
    */
    const deBaja = await findInactiveMembership({
      workspaceId: branding.workspaceId,
      userId: user.id,
      email: user.email,
    });
    if (deBaja) {
      // Vuelve de Mercado Pago y el aviso del pago todavía no llegó (si ya llegó y quedó en
      // cero, la ficha ya está activa y arriba se lo mandó al portal).
      const volvioDePagar = query.pago === "ok" || query.pago === "pendiente";
      const debe = deBaja.dueMinor > 0;
      return (
        <div className="bg-[var(--fo-bg)] text-[var(--fo-text)]">
          <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-12">
            <section className="fo-card space-y-5 p-6">
              {volvioDePagar ? (
                <div className="space-y-2">
                  <h1 className="text-xl font-semibold tracking-tight">Estamos acreditando tu pago</h1>
                  <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
                    Mercado Pago tarda unos minutos en confirmarlo. Apenas lo confirme, tu ficha de
                    socio {deBaja.memberNumber} vuelve a estar activa y entrás directo al portal.
                  </p>
                  <Link href={doorPathFor(workspaceSlug)} className="fo-btn fo-btn-primary w-full min-h-11 text-center">
                    Ver si ya está
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <h1 className="text-xl font-semibold tracking-tight">
                      Tu ficha de socio está dada de baja
                    </h1>
                    <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
                      Hola, {deBaja.firstName}. Te encontramos en {nombre} como socio{" "}
                      {deBaja.memberNumber}, pero tu ficha figura dada de baja, así que por ahora
                      no podés entrar al portal.
                    </p>
                    {debe ? (
                      <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
                        Tenés {deBaja.openCharges === 1 ? "1 cuota pendiente" : `${deBaja.openCharges} cuotas pendientes`}{" "}
                        por <strong className="text-[var(--fo-text)]">{formatMinorArs(deBaja.dueMinor)}</strong>.
                        Si las pagás ahora, tu ficha se reactiva sola apenas se acredita el pago. Si
                        preferís otro medio o querés hablarlo, pedí que te contacten.
                      </p>
                    ) : (
                      <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
                        Para reactivarla, pedí que te contacten y la Secretaría te escribe.
                      </p>
                    )}
                  </div>
                  {query.pago === "error" ? (
                    <p className="text-sm text-[var(--fo-danger)]" role="alert">
                      El pago no se completó. Podés intentarlo de nuevo.
                    </p>
                  ) : null}
                  <InactiveMemberActions
                    workspaceSlug={workspaceSlug}
                    payLabel={debe ? `Pagar ${formatMinorArs(deBaja.dueMinor)} y reactivar` : null}
                  />
                </>
              )}
              <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
                Entraste con <strong className="break-all">{user.email}</strong>.
              </p>
            </section>
          </main>
        </div>
      );
    }

    /*
      Tiene sesión pero no es nada de esta institución. No se lo echa ni se lo manda en
      silencio a otro lado: se le dice dónde está parado y con qué cuenta, que es lo único
      que le falta saber para resolverlo. Mandarlo callado a su propio panel lo dejaría
      pensando que la institución no lo tiene registrado.
    */
    return (
      <div className="bg-[var(--fo-bg)] text-[var(--fo-text)]">
        <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-12">
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
                <button type="submit" className="fo-btn fo-btn-primary w-full min-h-11">
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
      doorPath={puerta}
    />
  );
}
