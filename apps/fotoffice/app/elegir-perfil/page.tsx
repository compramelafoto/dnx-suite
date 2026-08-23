import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { listUserProfiles } from "@/lib/portal/profiles";
import { chooseProfileAction, createOwnBusinessAction } from "@/app/actions/profile-choice";

export const dynamic = "force-dynamic";

/**
 * Selector de perfil.
 *
 * Una misma persona puede administrar su propio negocio y ser socia de una institución, con
 * la misma cuenta. Solo ella sabe a cuál de las dos viene hoy.
 *
 * También es el lugar donde un socio se entera de que puede usar FotoOffice para su estudio:
 * si todavía no tiene negocio, ve la invitación a crearlo. Esa creación es siempre explícita
 * — nunca ocurre por visitar una ruta.
 */
export default async function ChooseProfilePage() {
  const user = await requireAuth();
  const profiles = await listUserProfiles(user.id);

  // Con un solo perfil no hay nada que elegir: se lo manda directo.
  if (profiles.length === 1) {
    redirect(profiles[0]!.kind === "TEAM" ? "/workspace" : "/portal");
  }
  if (profiles.length === 0) redirect("/workspace");

  const hasBusiness = profiles.some((p) => p.kind === "TEAM");

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-2xl px-4 py-16 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">¿Cómo querés entrar?</h1>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Tu cuenta tiene más de un perfil. Elegí con cuál seguir; vas a poder cambiar cuando
            quieras.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {profiles.map((profile) => {
            const key = `${profile.kind}:${profile.workspaceId}`;
            return (
              <form key={key} action={chooseProfileAction}>
                <input type="hidden" name="profile" value={key} />
                <button
                  type="submit"
                  className="fo-card w-full space-y-2 p-5 text-left transition hover:border-[var(--fo-accent,#1d4ed8)]"
                >
                  <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">
                    {profile.kind === "TEAM" ? "Tu negocio" : "Institución"}
                  </p>
                  <p className="text-base font-semibold">{profile.workspaceName}</p>
                  <p className="text-xs text-[var(--fo-muted)]">
                    {profile.kind === "TEAM"
                      ? "Administrar tu estudio: clientes, cursos, sitio web."
                      : `Socio N° ${profile.memberNumber}`}
                  </p>
                  <p className="pt-1 text-sm font-medium text-[var(--fo-accent,#1d4ed8)]">
                    {profile.kind === "TEAM" ? "Administrar →" : "Entrar al portal →"}
                  </p>
                </button>
              </form>
            );
          })}
        </div>

        {!hasBusiness ? (
          <section className="fo-card space-y-3 p-5">
            <h2 className="text-sm font-semibold">¿Tenés tu propio estudio?</h2>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              FotoOffice no es solo el acceso a tu institución: podés usarlo para administrar tu
              negocio fotográfico. Se crea aparte de tu ficha de socio y lo manejás vos.
            </p>
            <form action={createOwnBusinessAction}>
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                Crear mi negocio en FotoOffice
              </button>
            </form>
          </section>
        ) : null}

        <form action="/api/auth/logout" method="post">
          <button type="submit" className="text-xs text-[var(--fo-muted)] underline">
            Cerrar sesión
          </button>
        </form>
      </main>
    </div>
  );
}
