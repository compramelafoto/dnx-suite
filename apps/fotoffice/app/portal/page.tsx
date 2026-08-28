import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { resolveFotofficeUserKind } from "@/lib/portal/user-kind";
import { listUserProfiles } from "@/lib/portal/profiles";
import Link from "next/link";
import { createOwnBusinessAction, switchProfileAction } from "@/app/actions/profile-choice";
import { loadMemberAccount } from "@/lib/membership/account";
import { formatMinorArs } from "@/lib/membership/money";
import { describeSeniority } from "@/lib/portal/identity";
import { pendingPrintedCard } from "@/lib/carnet/pending-print";

export const dynamic = "force-dynamic";

/**
 * Portal del socio.
 *
 * Destino real de quien activa su acceso, y frontera con el panel administrativo: acá se
 * entra por tener ficha de socio propia, no por un rol de equipo.
 *
 * Muestra las cuotas cuando hay algo que decir. El resto de los módulos —comprobantes,
 * beneficios— sigue sin anunciarse: prometer algo que no existe es peor que no mencionarlo.
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

  const profiles = await listUserProfiles(user.id);
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: context.workspace.id },
    select: { commercialName: true, logoUrl: true },
  });
  const institution = branding?.commercialName?.trim() || context.workspace.name;
  const account = await loadMemberAccount(context.member.id);
  const antiguedad = describeSeniority(context.member.joinedAt, new Date());

  // Un pendiente que el socio no ve es un pendiente que no existe: la subida de la foto vive
  // en la pantalla del carnet y nadie llegaba sola hasta ahí.
  const impresa = await pendingPrintedCard(context.member.id);

  // Los 152 socios del padrón migrado llegan sin ninguno de estos datos: nunca hubo un
  // formulario donde cargarlos. El aviso está para eso, y desaparece solo cuando ya cargó algo.
  const perfil = await prisma.member.findUnique({
    where: { id: context.member.id },
    select: { businessName: true, bio: true, specialties: true, instagram: true, website: true },
  });
  const perfilVacio =
    !perfil?.businessName &&
    !perfil?.bio &&
    !perfil?.instagram &&
    !perfil?.website &&
    (perfil?.specialties.length ?? 0) === 0;

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

          {/*
            Identidad antes que trámite. El socio abre el portal y lo primero que ve es que la
            institución sabe quién es: su número, su categoría y desde cuándo pertenece. Son
            datos que ya existen en la ficha, así que nunca quedan desactualizados.
          */}
          <div className="space-y-3">
            <h1 className="text-xl font-semibold tracking-tight">
              Hola, {context.member.firstName}
            </h1>
            <div className="rounded-lg border border-[var(--fo-border)] px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-medium">
                  Socio N° <span className="tabular-nums">{context.member.memberNumber}</span>
                </p>
                {context.member.categoryName ? (
                  <p className="text-xs text-[var(--fo-muted)]">{context.member.categoryName}</p>
                ) : null}
              </div>
              {antiguedad.desde ? (
                <p className="mt-1 text-xs text-[var(--fo-muted)]">
                  Desde {antiguedad.desde}
                  {antiguedad.anios
                    ? ` · ${antiguedad.anios} ${antiguedad.anios === 1 ? "año" : "años"} en la institución`
                    : ""}
                </p>
              ) : null}
            </div>
          </div>

          <Link
            href="/portal/carnet"
            className={
              "block space-y-1 rounded-lg border p-4 " +
              (impresa.pedida && impresa.faltaFoto
                ? "border-[var(--fo-accent)] hover:border-[var(--fo-text)]"
                : "border-[var(--fo-border)] hover:border-[var(--fo-text)]")
            }
          >
            <p className="text-sm font-medium">
              {impresa.pedida && impresa.faltaFoto ? "Te falta subir tu foto" : "Tu carnet de socio"}
            </p>
            <p className="text-xs text-[var(--fo-muted)]">
              {impresa.pedida && impresa.faltaFoto
                ? "Ya pagaste tu credencial impresa. Sin tu foto no la podemos emitir."
                : "Mostralo para que verifiquen tu condición de socio."}
            </p>
          </Link>

          {account.charges.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-[var(--fo-border)] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">Cuotas pendientes</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMinorArs(account.totalDueMinor)}
                </p>
              </div>
              {account.overdueCount > 0 ? (
                <p className="text-xs text-[var(--fo-danger)]">
                  {account.overdueCount === 1
                    ? "Tenés 1 cuota vencida."
                    : `Tenés ${account.overdueCount} cuotas vencidas.`}
                </p>
              ) : null}
              <Link href="/portal/cuotas" className="fo-btn fo-btn-primary inline-flex text-sm">
                Ver y pagar
              </Link>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-[var(--fo-border)] p-4">
              <p className="text-sm font-medium text-[var(--fo-success)]">Estás al día</p>
              <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
                No tenés cuotas pendientes con {institution}.
              </p>
              <Link href="/portal/cuotas" className="text-xs text-[var(--fo-muted)] hover:underline">
                Ver el detalle
              </Link>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href="/portal/perfil" className="fo-btn fo-btn-secondary text-sm">
              Mi perfil profesional
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                Cerrar sesión
              </button>
            </form>
            {profiles.length > 1 ? (
              <form action={switchProfileAction}>
                <button type="submit" className="fo-btn text-sm">
                  Cambiar de perfil
                </button>
              </form>
            ) : null}
          </div>
        </section>

        {perfilVacio ? (
          <section className="fo-card mt-6 space-y-3 p-5">
            <h2 className="text-sm font-semibold">Completá tu perfil profesional</h2>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Contanos a qué te dedicás y dónde se ve tu trabajo. Es lo que {institution} usa
              para recomendarte y difundir lo que hacés. Se publica solo si lo autorizás.
            </p>
            <Link href="/portal/perfil" className="fo-btn fo-btn-primary text-sm">
              Completar mi perfil
            </Link>
          </section>
        ) : null}

        {/*
          El socio que todavía no tiene negocio se entera acá de que puede usar FotoOffice para
          administrarlo. La creación es siempre explícita: nunca ocurre por visitar una ruta.
        */}
        {!profiles.some((p) => p.kind === "TEAM") ? (
          <section className="fo-card mt-6 space-y-3 p-5">
            <h2 className="text-sm font-semibold">¿Tenés tu propio estudio?</h2>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Además de tu acceso como socio, podés usar FotoOffice para administrar tu negocio
              fotográfico. Se crea aparte de tu ficha de socio y lo manejás vos.
            </p>
            <form action={createOwnBusinessAction}>
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                Crear mi negocio en FotoOffice
              </button>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  );
}
