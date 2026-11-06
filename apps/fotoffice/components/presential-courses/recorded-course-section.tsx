import { formatMoney } from "@/lib/format";
import { duracionLegible } from "@/lib/course-classroom/aula";
import { montosDeCompraSinReparto } from "@/lib/course-marketplace/compra";
import { PublicCourseEnrollmentForm } from "@/components/presential-courses/public-course-enrollment-form";

type Clase = {
  id: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  isPreview: boolean;
  thumbnailUrl?: string | null;
};

/**
 * La parte de venta de un curso grabado: qué clases trae, cuánto cuesta y el formulario.
 *
 * La muestra gratuita abre en el dominio de FOTOFFICE (`appUrl`) y no en el de la institución:
 * los videos sólo se reproducen desde fotoffice.com. Sólo se ofrece con el curso publicado:
 * la página de muestra exige PUBLISHED y un curso "Próximamente" daría un 404.
 */
export function RecordedCourseSection({
  workspaceSlug,
  courseSlug,
  appUrl,
  precioArs,
  accessMonths,
  publicado,
  clases,
  gratisParaSocios,
  cargoServicioBps,
  aLaVenta,
  dueno,
  precioSocios,
  cursoDe,
  gratuito = false,
}: {
  workspaceSlug: string;
  courseSlug: string;
  appUrl: string;
  precioArs: string | null;
  accessMonths: number;
  publicado: boolean;
  clases: Clase[];
  gratisParaSocios: { institucion: string } | null;
  /** Cargo de servicio de la plataforma, en puntos básicos (500 = 5%). */
  cargoServicioBps: number;
  /** false cuando el curso tiene reparto: no se vende hasta la etapa del split. */
  aLaVenta: boolean;
  dueno: { workspaceId: string; nombre: string };
  /** Precio para los socios de quien vende, cuando revende con descuento. */
  precioSocios: { institucion: string; amountArs: string } | null;
  /** Nombre del dueño cuando el curso es de otro negocio: "Un curso de …". */
  cursoDe: string | null;
  /** Grabado sin precio: todas las clases se ven sin registrarse. */
  gratuito?: boolean;
}) {
  const montos = precioArs
    ? montosDeCompraSinReparto({ listaArs: precioArs, comisionPlataformaBps: cargoServicioBps, owner: dueno })
    : null;
  const total = clases.reduce((s, c) => s + (c.durationSeconds ?? 0), 0);
  const plazo = gratuito
    ? "gratis y sin registrarte"
    : accessMonths === 0 ? "cuando quieras, sin vencimiento" : accessMonths === 1 ? "durante 1 mes" : `durante ${accessMonths} meses`;
  return (
    <section className="fo-card space-y-4">
      {cursoDe ? <p className="text-xs text-[var(--fo-muted)]">Un curso de {cursoDe}</p> : null}
      <h2 className="text-xl font-semibold">Clases</h2>
      <p className="text-sm text-[var(--fo-muted)]">
        {clases.length} {clases.length === 1 ? "clase" : "clases"}
        {total > 0 ? ` · ${duracionLegible(total)} en total` : ""} · Lo mirás a tu ritmo, {plazo}.
      </p>
      <ol className="space-y-2">
        {clases.map((clase, i) => {
          const verHref =
            (clase.isPreview || gratuito) && publicado && appUrl
              ? `${appUrl}/w/${workspaceSlug}/cursos/${courseSlug}/muestra/${clase.id}`
              : null;
          const miniatura = clase.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clase.thumbnailUrl}
              alt=""
              loading="lazy"
              className="aspect-video w-20 shrink-0 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] object-cover"
            />
          ) : null;
          return (
          <li
            key={clase.id}
            className="flex items-start justify-between gap-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3"
          >
            {miniatura ? (
              verHref ? (
                <a href={verHref} aria-label={`Ver ${clase.title}`} className="shrink-0">
                  {miniatura}
                </a>
              ) : (
                miniatura
              )
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {i + 1}. {clase.title}
              </p>
              {clase.description ? (
                <p className="text-sm text-[var(--fo-muted)] line-clamp-2">{clase.description}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right text-sm text-[var(--fo-muted)]">
              <p>{duracionLegible(clase.durationSeconds)}</p>
              {verHref ? (
                <a href={verHref} className="text-[var(--fo-accent)] underline">
                  {gratuito ? "Ver clase" : "Ver gratis"}
                </a>
              ) : null}
            </div>
          </li>
          );
        })}
      </ol>
      {gratuito && publicado && clases[0] ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-accent)]/40 p-3 text-sm">
          <strong>Curso gratuito.</strong>
          <span className="text-[var(--fo-muted)]">Mirá todas las clases sin registrarte ni pagar.</span>
          <a
            href={`${appUrl}/w/${workspaceSlug}/cursos/${courseSlug}/muestra/${clases[0].id}`}
            className="fo-btn fo-btn-primary text-sm"
          >
            Empezar el curso
          </a>
        </div>
      ) : null}
      {gratisParaSocios && publicado && !gratuito ? (
        <p className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-accent)]/40 p-3 text-sm">
          <strong>Gratis para socios de {gratisParaSocios.institucion}.</strong>{" "}
          <a href={`${appUrl}/login?next=/portal/cursos`} className="text-[var(--fo-accent)] underline">
            Entrá a tu portal
          </a>{" "}
          y anotate sin pagar.
        </p>
      ) : null}
      {precioArs && !gratuito ? (
        montos?.ok && Number(montos.platformFeeArs) > 0 ? (
          <p className="text-lg">
            <strong>{formatMoney(Number(montos.listPriceArs), "ARS")}</strong> +{" "}
            {formatMoney(Number(montos.platformFeeArs), "ARS")} de cargo por servicio ={" "}
            <strong>{formatMoney(Number(montos.amountArs), "ARS")}</strong>
          </p>
        ) : (
          <p className="text-lg font-semibold">{formatMoney(Number(precioArs), "ARS")}</p>
        )
      ) : null}
      {precioSocios && publicado && aLaVenta ? (
        <p className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-accent)]/40 p-3 text-sm">
          <strong>Socios de {precioSocios.institucion}: {formatMoney(Number(precioSocios.amountArs), "ARS")}.</strong>{" "}
          <a href={`${appUrl}/login?next=/portal/cursos`} className="text-[var(--fo-accent)] underline">
            Entrá a tu portal
          </a>{" "}
          para comprarlo con tu descuento.
        </p>
      ) : null}
      {publicado && precioArs && !gratuito && !aLaVenta ? (
        <p className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 text-sm font-medium">
          Disponible próximamente
        </p>
      ) : null}
      {publicado && precioArs && !gratuito && aLaVenta ? (
        <details id="comprar" className="scroll-mt-6 pt-2" open>
          <summary className="cursor-pointer text-sm text-[var(--fo-accent)]">Comprar el curso</summary>
          <div className="pt-3">
            <PublicCourseEnrollmentForm workspaceSlug={workspaceSlug} courseSlug={courseSlug} />
          </div>
        </details>
      ) : null}
    </section>
  );
}
