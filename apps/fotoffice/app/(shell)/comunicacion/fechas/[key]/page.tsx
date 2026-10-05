import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireCommunicationsManager } from "@/lib/placas/access";
import { loadOccasion } from "@/lib/mailing/occasions-store";
import { loadMailingContext } from "@/lib/mailing/context";
import { buildOccasionEmail } from "@/lib/mailing/occasions";
import { OCCASION_LIMITS } from "@/lib/mailing/occasion-form";
import { topicForOccasion } from "@/lib/mailing/occasions-catalog";
import { countOccasionAudience } from "@/lib/mailing/campaigns";
import { especialidadesPorGrupo } from "@/lib/membership/specialties";
import {
  deleteCustomOccasionAction,
  saveOccasionAction,
  testOccasionAction,
} from "@/app/actions/mailing-occasions";

export const dynamic = "force-dynamic";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

type Props = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

/** Comunicación → Fechas → una fecha: texto, día, a quién va, prueba y vista previa. */
export default async function FechaPage({ params, searchParams }: Props) {
  const { workspace } = await requireCommunicationsManager();
  const key = decodeURIComponent((await params).key);
  const sp = await searchParams;
  const o = await loadOccasion(workspace.id, key).catch(() => null);
  if (!o) notFound();

  const [ctx, destinatarios] = await Promise.all([loadMailingContext(workspace.id), countOccasionAudience(workspace.id, o)]);
  const vista = buildOccasionEmail({
    brand: ctx.brand,
    occasion: o,
    vars: { nombre: "Ana", institucion: ctx.brand.name, anios: o.kind === "ANNIVERSARY" ? 10 : null },
    signature: ctx.signature,
    footer: {
      reason: ctx.reason,
      unsubscribeUrl: ctx.unsubscribe ? ctx.unsubscribe("ejemplo@correo.com", topicForOccasion(o.kind)).pageUrl : "#",
    },
  });

  const variables =
    o.kind === "ANNIVERSARY" ? "{nombre}, {institucion} y {años} (se escribe «1 año», «10 años»)" : "{nombre} y {institucion}";

  return (
    <div className="space-y-6">
      <PageHeader
        title={o.title}
        description={
          o.kind === "BIRTHDAY"
            ? "Sale a las 9 de la mañana del día del cumpleaños, a cada socio activo que tenga fecha de nacimiento y correo."
            : o.kind === "ANNIVERSARY"
              ? "Sale a las 9 de la mañana del día en que el socio cumple años en la institución (según su fecha de ingreso)."
              : "Sale a las 9 de la mañana del día elegido, todos los años."
        }
        actions={
          <Link href="/comunicacion/fechas" className="fo-btn fo-btn-ghost text-sm">
            ← Todas las fechas
          </Link>
        }
      />

      {sp.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {sp.error}
        </p>
      ) : null}
      {sp.ok ? <p className="fo-alert-success p-4 text-sm">{sp.ok}</p> : null}
      {o.hint ? <p className="fo-alert-warning p-4 text-sm">{o.hint}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={saveOccasionAction} className="fo-card space-y-4 p-5">
          <input type="hidden" name="key" value={o.key} />

          <label className="flex items-center gap-2 text-sm font-medium text-[var(--fo-text)]">
            <input type="checkbox" name="enabled" defaultChecked={o.enabled} />
            Encendido
          </label>

          {!o.builtIn ? (
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="title">
                Nombre de la fecha
              </label>
              <input id="title" name="title" className="fo-input" defaultValue={o.title} maxLength={OCCASION_LIMITS.title} required />
            </div>
          ) : (
            <input type="hidden" name="title" value={o.title} />
          )}

          {o.kind === "EFEMERIDE" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="day">
                  Día
                </label>
                <input id="day" name="day" type="number" min={1} max={31} className="fo-input" defaultValue={o.day ?? ""} />
              </div>
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="month">
                  Mes
                </label>
                <select id="month" name="month" className="fo-input" defaultValue={o.month ?? ""}>
                  <option value="">—</option>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="subject">
              Asunto
            </label>
            <input id="subject" name="subject" className="fo-input" defaultValue={o.subject} maxLength={OCCASION_LIMITS.subject} required />
          </div>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="message">
              Texto
            </label>
            <textarea
              id="message"
              name="message"
              className="fo-input min-h-[220px]"
              defaultValue={o.message}
              maxLength={OCCASION_LIMITS.message}
              required
            />
            <p className="fo-helper">Dejá una línea en blanco para separar párrafos. Podés usar {variables}.</p>
          </div>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="imageUrl">
              Imagen (opcional)
            </label>
            <input id="imageUrl" name="imageUrl" className="fo-input" defaultValue={o.imageUrl ?? ""} placeholder="https://…" />
            <p className="fo-helper">
              Una dirección que empiece con https://. Podés subir la imagen en Sitio web → Blog → Imágenes y copiar su dirección.
            </p>
          </div>

          {o.kind === "ANNIVERSARY" ? (
            <label className="flex items-center gap-2 text-sm text-[var(--fo-text)]">
              <input type="checkbox" name="milestonesOnly" defaultChecked={o.milestonesOnly} />
              Sólo en los aniversarios redondos (1, 5, 10, 15… años)
            </label>
          ) : null}

          {o.kind === "EFEMERIDE" ? (
            <fieldset className="space-y-2">
              <legend className="fo-label">¿A quién le llega?</legend>
              <p className="fo-helper">
                Sin marcar nada, a todos los socios. Si marcás especialidades, sólo a quienes tengan alguna de ellas en su
                perfil. Hoy le llegaría a {destinatarios} socios.
              </p>
              <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-[var(--fo-border)] p-3">
                {especialidadesPorGrupo().map((g) => (
                  <div key={g.id}>
                    <div className="text-xs font-semibold text-[var(--fo-muted)]">{g.label}</div>
                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                      {g.items.map((e) => (
                        <label key={e.id} className="flex items-center gap-2 text-sm text-[var(--fo-text)]">
                          <input type="checkbox" name="specialties" value={e.id} defaultChecked={o.specialties.includes(e.id)} />
                          {e.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="fo-form-actions flex flex-wrap gap-2">
            <button type="submit" className="fo-btn fo-btn-primary">
              Guardar
            </button>
          </div>
        </form>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[var(--fo-text)]">Así lo recibe el socio</h2>
            <form action={testOccasionAction}>
              <input type="hidden" name="key" value={o.key} />
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                Enviarme una prueba
              </button>
            </form>
          </div>
          <p className="text-xs text-[var(--fo-muted)]">
            Asunto: <strong className="text-[var(--fo-text)]">{vista.subject}</strong>. Vista previa con el nombre «Ana»
            {o.kind === "ANNIVERSARY" ? " y 10 años" : ""}; muestra lo último que guardaste.
          </p>
          <iframe
            title="Vista previa del correo"
            srcDoc={vista.html}
            sandbox=""
            className="h-[640px] w-full rounded-lg border border-[var(--fo-border)] bg-white"
          />
          {!o.builtIn ? (
            <form action={deleteCustomOccasionAction}>
              <input type="hidden" name="key" value={o.key} />
              <button type="submit" className="fo-btn fo-btn-danger-outline text-sm">
                Borrar esta fecha
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
