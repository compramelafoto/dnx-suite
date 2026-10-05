import { formatMoney } from "@/lib/format";
import { duracionLegible } from "@/lib/course-classroom/aula";
import { PublicCourseEnrollmentForm } from "@/components/presential-courses/public-course-enrollment-form";

type Clase = {
  id: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  isPreview: boolean;
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
}: {
  workspaceSlug: string;
  courseSlug: string;
  appUrl: string;
  precioArs: string | null;
  accessMonths: number;
  publicado: boolean;
  clases: Clase[];
  gratisParaSocios: { institucion: string } | null;
}) {
  const total = clases.reduce((s, c) => s + (c.durationSeconds ?? 0), 0);
  const plazo = accessMonths === 1 ? "1 mes" : `${accessMonths} meses`;
  return (
    <section className="fo-card space-y-4">
      <h2 className="text-xl font-semibold">Clases</h2>
      <p className="text-sm text-[var(--fo-muted)]">
        {clases.length} {clases.length === 1 ? "clase" : "clases"}
        {total > 0 ? ` · ${duracionLegible(total)} en total` : ""} · Lo mirás a tu ritmo, durante {plazo}.
      </p>
      <ol className="space-y-2">
        {clases.map((clase, i) => (
          <li
            key={clase.id}
            className="flex items-start justify-between gap-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {i + 1}. {clase.title}
              </p>
              {clase.description ? (
                <p className="text-sm text-[var(--fo-muted)] line-clamp-2">{clase.description}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right text-sm text-[var(--fo-muted)]">
              <p>{duracionLegible(clase.durationSeconds)}</p>
              {clase.isPreview && publicado && appUrl ? (
                <a
                  href={`${appUrl}/w/${workspaceSlug}/cursos/${courseSlug}/muestra/${clase.id}`}
                  className="text-[var(--fo-accent)] underline"
                >
                  Ver gratis
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {gratisParaSocios ? (
        <p className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-accent)]/40 p-3 text-sm">
          <strong>Gratis para socios de {gratisParaSocios.institucion}.</strong>{" "}
          <a href={`${appUrl}/login?next=/portal/cursos`} className="text-[var(--fo-accent)] underline">
            Entrá a tu portal
          </a>{" "}
          y anotate sin pagar.
        </p>
      ) : null}
      {precioArs ? (
        <p className="text-lg font-semibold">{formatMoney(Number(precioArs), "ARS")}</p>
      ) : null}
      {publicado && precioArs ? (
        <details className="pt-2">
          <summary className="cursor-pointer text-sm text-[var(--fo-accent)]">Comprar el curso</summary>
          <div className="pt-3">
            <PublicCourseEnrollmentForm workspaceSlug={workspaceSlug} courseSlug={courseSlug} />
          </div>
        </details>
      ) : null}
    </section>
  );
}
