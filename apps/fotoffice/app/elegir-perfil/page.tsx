import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { findClaimableMembership } from "@/lib/portal/claim";
import {
  entryProfileForInstitution,
  institutionChoices,
  listUserProfiles,
  profileDestination,
} from "@/lib/portal/profiles";
import { readProfileChoice } from "@/lib/portal/profile-choice";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { WELCOME_PATH } from "@/lib/entrada/welcome";
import { chooseInstitutionAction, createOwnBusinessAction } from "@/app/actions/profile-choice";

export const dynamic = "force-dynamic";

/**
 * Selector de institución (la ruta conserva su nombre histórico).
 *
 * Una misma persona puede administrar su propio negocio y ser socia de una institución, con
 * la misma cuenta. Solo ella sabe a cuál de las dos viene hoy. Se elige la INSTITUCIÓN, no el
 * perfil: adentro, socio ⇄ Comisión/Administración se cambia con el selector de rol del menú.
 *
 * También es el lugar donde un socio se entera de que puede usar FotoOffice para su estudio:
 * si todavía no tiene negocio, ve la invitación a crearlo. Esa creación es siempre explícita
 * — nunca ocurre por visitar una ruta.
 */
export default async function ChooseProfilePage() {
  const user = await requireAuth();

  // Quien ya figura en un padrón con este mismo email no es alguien que recién llega: se le
  // ofrece reconocer su ficha antes de proponerle crear un negocio propio.
  if (await findClaimableMembership({ userId: user.id, email: user.email })) {
    redirect("/soy-socio");
  }

  const profiles = await listUserProfiles(user.id);

  // Sin ningún perfil no hay nada que elegir, y mandarlo a `/workspace` era el atajo por el
  // que igual terminaba con una institución creada. La pregunta va en la bienvenida.
  if (profiles.length === 0) redirect(WELCOME_PATH);

  const institutions = institutionChoices(profiles);
  // Con una sola institución no hay nada que elegir: se lo manda a su vista por defecto.
  if (institutions.length === 1) {
    const entry = entryProfileForInstitution(
      profiles,
      institutions[0]!.workspaceId,
      await readProfileChoice(),
    );
    redirect(entry ? profileDestination(entry) : WELCOME_PATH);
  }

  const vocabularies = await Promise.all(
    institutions.map((i) => (i.memberNumber ? loadPersonVocabulary(i.workspaceId) : null)),
  );
  const hasBusiness = profiles.some((p) => p.kind === "TEAM");

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-2xl px-4 py-16 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">¿A dónde querés entrar?</h1>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Tu cuenta está en más de una institución. Elegí a cuál entrar; vas a poder cambiar
            cuando quieras.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {institutions.map((institution, index) => {
            const vocabulary = vocabularies[index];
            const team = institution.profiles.find((p) => p.kind === "TEAM");
            const detail = institution.ownBusiness
              ? "Administrar tu estudio: clientes, cursos, sitio web."
              : [
                  institution.memberNumber && vocabulary
                    ? `${vocabulary.Singular} N° ${institution.memberNumber}`
                    : null,
                  team?.kind === "TEAM"
                    ? team.role === "STAFF"
                      ? "Comisión"
                      : "Administración"
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
            return (
              <form key={institution.workspaceId} action={chooseInstitutionAction}>
                <input type="hidden" name="workspaceId" value={institution.workspaceId} />
                <button
                  type="submit"
                  className="fo-card w-full space-y-2 p-5 text-left transition hover:border-[var(--fo-accent,#1d4ed8)]"
                >
                  <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">
                    {institution.ownBusiness ? "Tu negocio" : "Institución"}
                  </p>
                  <p className="text-base font-semibold">{institution.workspaceName}</p>
                  {detail ? <p className="text-xs text-[var(--fo-muted)]">{detail}</p> : null}
                  <p className="pt-1 text-sm font-medium text-[var(--fo-accent,#1d4ed8)]">
                    {institution.ownBusiness ? "Administrar →" : "Entrar →"}
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
