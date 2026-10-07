import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SponsorLogo } from "@/components/sponsors/sponsor-logo";
import { requireSponsorsViewer } from "@/lib/sponsors/access";
import { getWorkspaceSponsor } from "@/lib/sponsors/repository";
import { partnersReader, sponsorsWriteBlockedReason } from "@/lib/sponsors/clients";
import { selfSignupStatuses, type SelfSignupStatus } from "@/lib/sponsors/self-signup";
import { FOTOFFICE_SPONSOR_PLACEMENTS, placementLabel, placementWhere } from "@/lib/sponsors/constants";
import { diaArgentino, fechaCorta } from "@/lib/sponsors/slots";
import {
  asignarEspacioAction,
  desvincularSponsorAction,
  guardarDatosPropiosAction,
  guardarFichaComunAction,
  quitarEspacioAction,
  subirLogoAction,
} from "../actions";
import { GenerarEnlaceAutoalta } from "../enlace-autoalta";

export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  vinculado: "Listo: el sponsor ya es de la institución. Ahora elegí en qué espacios aparece.",
  creado: "Sponsor creado. Subí su logo y elegí en qué espacios aparece.",
  comun: "Guardado. El cambio se ve en todas las plataformas donde está este sponsor.",
  propios: "Guardado.",
  logo: "Logo actualizado.",
  asignado: "Listo: el sponsor quedó en ese espacio.",
  quitado: "El sponsor salió de ese espacio.",
};

const DIA_MS = 24 * 60 * 60 * 1000;

function fechaYHora(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function estadoDelEnlace(estado: SelfSignupStatus): string {
  switch (estado.kind) {
    case "NONE":
      return "Todavía no le mandaste ningún enlace.";
    case "WAITING":
      return estado.openedAt
        ? `Abrió el enlace el ${fechaYHora(estado.openedAt)} pero todavía no mandó sus datos.`
        : `Generaste un enlace el ${fechaYHora(estado.createdAt)}. Todavía no lo abrió.`;
    case "SUBMITTED":
      return `Completó sus datos el ${fechaYHora(estado.submittedAt)}. Revisá la ficha de la marca y el texto de la institución, más abajo.`;
    case "EXPIRED":
      return "El último enlace venció sin que lo usara. Generá otro si hace falta.";
  }
}

export default async function SponsorPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, canManage } = await requireSponsorsViewer();
  const { partnerId } = await params;
  const aviso = await searchParams;
  const sponsor = await getWorkspaceSponsor(workspace.id, partnerId);
  if (!sponsor) notFound();
  const autoalta =
    (await selfSignupStatuses(await partnersReader(), workspace.id, [sponsor.partnerId]).catch(() => null))?.get(
      sponsor.partnerId,
    ) ?? ({ kind: "NONE" } as const);

  const puedeEditar = canManage && !sponsorsWriteBlockedReason();
  const ahora = new Date();
  const hoy = diaArgentino(ahora);
  const enUnMes = diaArgentino(new Date(ahora.getTime() + 30 * DIA_MS));

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        title={sponsor.name}
        description="Su ficha, el texto que ve la institución y en qué espacios aparece."
        actions={
          <Link href="/sponsors" className="fo-btn fo-btn-secondary text-sm">
            Volver
          </Link>
        }
      />

      {aviso.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {aviso.error}
        </p>
      ) : null}
      {aviso.ok ? <p className="fo-alert-success p-4 text-sm">{AVISOS[aviso.ok] ?? "Listo."}</p> : null}

      {/* Espacios primero: es lo que se viene a hacer acá. */}
      <section className="fo-card space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Dónde aparece</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Cada espacio muestra a los sponsors vigentes ese día. Al terminar el período, el logo se baja solo.
          </p>
        </div>

        {sponsor.placements.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no está en ningún espacio.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border-muted)] rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
            {sponsor.placements.map((p) => (
              <li key={p.bookingId} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{placementLabel(p.placementKey)}</p>
                  <p className="text-xs text-[var(--fo-muted)]">
                    Del {fechaCorta(diaArgentino(p.startsAt))} al{" "}
                    {fechaCorta(diaArgentino(p.endsAt, { esFin: true }))}
                    {p.vigente ? " · se está mostrando" : " · todavía no empezó"}
                  </p>
                </div>
                {puedeEditar ? (
                  <form action={quitarEspacioAction}>
                    <input type="hidden" name="partnerId" value={sponsor.partnerId} />
                    <input type="hidden" name="bookingId" value={p.bookingId} />
                    <button type="submit" className="fo-btn fo-btn-ghost text-sm">
                      Quitar
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {puedeEditar ? (
          <form action={asignarEspacioAction} className="grid gap-4 border-t border-[var(--fo-border-muted)] pt-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <input type="hidden" name="partnerId" value={sponsor.partnerId} />
            <label className="fo-field-stack">
              <span className="fo-label">Espacio</span>
              <select name="placementKey" required className="fo-input" defaultValue="">
                <option value="" disabled>
                  Elegí dónde
                </option>
                {FOTOFFICE_SPONSOR_PLACEMENTS.map((key) => (
                  <option key={key} value={key}>
                    {placementLabel(key)}
                  </option>
                ))}
              </select>
            </label>
            <label className="fo-field-stack">
              <span className="fo-label">Desde</span>
              <input type="date" name="desde" required defaultValue={hoy} className="fo-input" />
            </label>
            <label className="fo-field-stack">
              <span className="fo-label">Hasta (incluido)</span>
              <input type="date" name="hasta" required defaultValue={enUnMes} className="fo-input" />
            </label>
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Agregar
            </button>
          </form>
        ) : null}

        <dl className="grid gap-x-6 gap-y-2 text-xs text-[var(--fo-muted)] sm:grid-cols-2">
          {FOTOFFICE_SPONSOR_PLACEMENTS.map((key) => (
            <div key={key}>
              <dt className="font-medium text-[var(--fo-text-secondary)]">{placementLabel(key)}</dt>
              <dd>{placementWhere(key)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="fo-card space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Que el sponsor cargue sus datos</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Generá un enlace y mandáselo: el sponsor sube su logo, sus redes, el beneficio para los socios y un
            contacto, sin necesidad de cuenta. Lo que cargue queda en esta ficha.
          </p>
        </div>
        <p className="text-sm">{estadoDelEnlace(autoalta)}</p>
        {autoalta.kind === "SUBMITTED" && autoalta.contact ? (
          <p className="text-sm text-[var(--fo-text-secondary)]">
            Contacto que dejó: <span className="font-medium">{autoalta.contact.name}</span>
            {autoalta.contact.email ? (
              <>
                {" · "}
                <a href={`mailto:${autoalta.contact.email}`} className="underline">
                  {autoalta.contact.email}
                </a>
              </>
            ) : null}
            {autoalta.contact.phone ? ` · ${autoalta.contact.phone}` : null}
          </p>
        ) : null}
        {puedeEditar ? (
          <GenerarEnlaceAutoalta
            partnerId={sponsor.partnerId}
            institucion={workspace.name}
            yaHayUno={autoalta.kind === "WAITING"}
          />
        ) : null}
      </section>

      <section className="fo-card space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Ficha de la marca</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            {sponsor.otherLinks > 0
              ? "Esta ficha es común a toda la red de DNX: este sponsor también trabaja con otras plataformas, y lo que cambies acá se ve allá."
              : "Esta ficha es común a toda la red de DNX: si otra plataforma suma a este sponsor, va a ver estos mismos datos."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <SponsorLogo name={sponsor.name} src={sponsor.logoSrc} className="size-20" />
          {puedeEditar ? (
            <form action={subirLogoAction} encType="multipart/form-data" className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="partnerId" value={sponsor.partnerId} />
              <label className="fo-field-stack">
                <span className="fo-label">{sponsor.logoSrc ? "Cambiar logo" : "Subir logo"}</span>
                <input type="file" name="file" required accept="image/png,image/jpeg,image/webp" className="text-sm" />
              </label>
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                Subir
              </button>
            </form>
          ) : null}
        </div>
        <p className="fo-helper">PNG, JPG o WebP, hasta 4 MB. Mejor con fondo transparente.</p>
        <form action={guardarFichaComunAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="partnerId" value={sponsor.partnerId} />
          <label className="fo-field-stack sm:col-span-2">
            <span className="fo-label">Nombre</span>
            <input name="name" required minLength={2} maxLength={120} defaultValue={sponsor.name} className="fo-input" disabled={!puedeEditar} />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Sitio web</span>
            <input name="websiteUrl" defaultValue={sponsor.websiteUrl ?? ""} className="fo-input" disabled={!puedeEditar} />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Instagram</span>
            <input name="instagram" defaultValue={sponsor.instagram ?? ""} className="fo-input" disabled={!puedeEditar} />
          </label>
          {puedeEditar ? (
            <div className="sm:col-span-2">
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                Guardar ficha
              </button>
            </div>
          ) : null}
        </form>
      </section>

      <section className="fo-card space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Lo que muestra la institución</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Sólo para esta institución. El título y el texto salen en la sección de sponsors del portal y en la
            ventana de bienvenida.
          </p>
        </div>
        <form action={guardarDatosPropiosAction} className="grid gap-4">
          <input type="hidden" name="partnerId" value={sponsor.partnerId} />
          <label className="fo-field-stack">
            <span className="fo-label">Título</span>
            <input name="title" maxLength={120} defaultValue={sponsor.title ?? ""} placeholder="Ej.: 15% de descuento para socios" className="fo-input" disabled={!puedeEditar} />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Texto</span>
            <textarea name="description" maxLength={600} rows={3} defaultValue={sponsor.description ?? ""} className="fo-input" disabled={!puedeEditar} />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Enlace al tocar el logo</span>
            <input name="destinationUrl" defaultValue={sponsor.destinationUrl ?? ""} placeholder="Si lo dejás vacío, va a la web de la marca" className="fo-input" disabled={!puedeEditar} />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Notas internas</span>
            <textarea name="notes" maxLength={4000} rows={3} defaultValue={sponsor.notes ?? ""} placeholder="Acuerdo, contacto, lo que haga falta recordar. No se publica." className="fo-input" disabled={!puedeEditar} />
          </label>
          {puedeEditar ? (
            <div>
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                Guardar
              </button>
            </div>
          ) : null}
        </form>
      </section>

      {puedeEditar ? (
        <section className="fo-card space-y-3 p-5">
          <h2 className="text-base font-semibold">Desvincular</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Deja de ser sponsor de la institución y sale de todos sus espacios. La ficha de la marca no se borra:
            sigue en la base común de DNX y se puede volver a vincular.
          </p>
          <form action={desvincularSponsorAction}>
            <input type="hidden" name="partnerId" value={sponsor.partnerId} />
            <button type="submit" className="fo-btn fo-btn-danger-outline text-sm">
              Desvincular de la institución
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
