import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { findClaimableMembership } from "@/lib/portal/claim";
import { listUserProfiles } from "@/lib/portal/profiles";
import { resolveWelcomeAccess } from "@/lib/entrada/welcome-access";
import { createOwnBusinessAction } from "@/app/actions/profile-choice";

export const dynamic = "force-dynamic";

/**
 * "¿A qué viniste?"
 *
 * Esta pantalla existe por lo que había antes en su lugar: nada. Quien iniciaba sesión y no
 * era reconocido no veía una pregunta — se le creaba una institución con él de dueño y se lo
 * mandaba a configurarla. En producción eso dejó dos instituciones vacías, "Emeveph" y "Julio
 * Libardi", las dos de socios reales de SFPR.
 *
 * El caso de Libardi explica por qué la pregunta hace falta y por qué afinar el
 * reconocimiento no alcanzaba: en el padrón figura con su Hotmail, pero entró con su Gmail.
 * Ningún cruce de emails iba a encontrarlo. Lo que sí lo salva es no darle por supuesto nada
 * y preguntarle.
 *
 * Por eso la opción de crear un negocio está acá, abajo y explicada, en vez de ocurrir sola:
 * es la que menos gente necesita y la que más daño hace cuando se elige por error.
 */
export default async function BienvenidaPage() {
  const user = await requireAuth();

  const [profiles, claimable] = await Promise.all([
    listUserProfiles(user.id),
    findClaimableMembership({ userId: user.id, email: user.email }),
  ]);

  const acceso = resolveWelcomeAccess({ profiles, claimable: Boolean(claimable) });
  if ("redirectTo" in acceso) redirect(acceso.redirectTo);

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Hola, ¿a qué viniste?</h1>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Entraste con <strong className="break-all">{user.email}</strong> y todavía no
            tenemos nada asociado a esa dirección. Contanos qué buscás y te llevamos.
          </p>
        </header>

        {/*
          Primero la opción más probable. Quien llega acá casi siempre es alguien que YA
          pertenece a una institución: el fallo no fue suyo, fue que no lo reconocimos.
        */}
        <section className="fo-card space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Soy socio o formo parte de una institución</h2>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Es lo más común cuando aparece esta pantalla: tu institución te tiene registrado
              con <strong>otra dirección de correo</strong>. Pasa seguido cuando uno entra con
              Google y en la institución figura el correo de siempre.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--fo-border)] p-4 space-y-3 text-sm leading-relaxed">
            <p className="font-medium">Dos formas de resolverlo:</p>
            <ul className="space-y-2 text-[var(--fo-muted)]">
              <li>
                <strong className="text-[var(--fo-text)]">Entrá con el otro correo.</strong> Si
                tenés idea de cuál es el que figura en tu institución, probá con ese.
              </li>
              <li>
                <strong className="text-[var(--fo-text)]">Pediles la invitación.</strong>{" "}
                Escribile a tu institución y pedí que te manden el acceso a este correo. Te
                llega un enlace y con eso entrás directo.
              </li>
            </ul>
          </div>

          <form action="/api/auth/logout" method="post">
            <button type="submit" className="fo-btn fo-btn-secondary w-full sm:w-auto min-h-11">
              Salir y entrar con otro correo
            </button>
          </form>
        </section>

        <section className="fo-card space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Quiero usar FotoOffice para mi trabajo</h2>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Si tenés un estudio, una agencia o una institución y querés administrarla acá,
              creamos tu espacio de trabajo y te acompañamos a configurarlo.
            </p>
          </div>

          {/*
            El aviso no es decorativo. Es exactamente lo que nadie vio cuando esto pasaba solo:
            que apretar acá te deja al frente de una institución nueva.
          */}
          <p className="rounded-lg border border-[var(--fo-border)] bg-[var(--fo-surface)] p-3 text-xs text-[var(--fo-muted)] leading-relaxed">
            Esto crea un espacio nuevo y vacío, con vos como responsable. Si lo que querés es
            entrar a una institución que ya existe, no es por acá.
          </p>

          <form action={createOwnBusinessAction}>
            <button type="submit" className="fo-btn fo-btn-primary w-full sm:w-auto min-h-11">
              Crear mi espacio de trabajo
            </button>
          </form>
        </section>

        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          ¿No es ninguna de las dos? Escribinos y lo vemos. Mientras tanto no se creó nada a tu
          nombre.
        </p>
      </main>
    </div>
  );
}
