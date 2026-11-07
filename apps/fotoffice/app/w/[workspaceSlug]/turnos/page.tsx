import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TITULO_PAGINA_POR_OMISION } from "@/lib/turnos/constantes";
import { leerAjustesTurnos, negocioPorSlug, tiposPublicados } from "@/lib/turnos/publico";
import { resumenDelTipo } from "@/lib/turnos/textos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const negocio = await negocioPorSlug((await params).workspaceSlug);
  if (!negocio) return {};
  const ajustes = await leerAjustesTurnos(negocio.workspaceId);
  return { title: ajustes.pageTitle ?? TITULO_PAGINA_POR_OMISION };
}

/** Turnos de servicio: los tipos que el estudio publicó para que el cliente reserve solo. */
export default async function TurnosPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const negocio = await negocioPorSlug(workspaceSlug);
  if (!negocio) notFound();
  const [ajustes, tipos] = await Promise.all([leerAjustesTurnos(negocio.workspaceId), tiposPublicados(negocio.workspaceId)]);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-12 md:px-8 md:py-16">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{ajustes.pageTitle ?? TITULO_PAGINA_POR_OMISION}</h1>
        <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-[var(--fo-muted)]">
          {ajustes.pageIntro ?? "Elegí el tipo de turno, el día y el horario que te quede cómodo. La confirmación te llega por correo."}
        </p>
      </div>

      {tipos.length === 0 ? (
        <div className="fo-card p-6 text-center text-sm text-[var(--fo-muted)]">Por ahora no hay turnos para reservar en línea.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tipos.map((t) => (
            <section key={t.id} className="fo-card flex flex-col gap-3 p-5">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{t.name}</h2>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted-soft)]">{resumenDelTipo(t)}</p>
              </div>
              {t.publicDescription ? <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--fo-muted)]">{t.publicDescription}</p> : null}
              <div className="mt-auto pt-2">
                <Link href={`/w/${workspaceSlug}/turnos/${t.id}`} className="fo-btn fo-btn-primary text-sm">
                  Elegir día y hora
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}

      {ajustes.cancelWindowHours > 0 ? (
        <p className="text-xs leading-relaxed text-[var(--fo-muted-soft)]">
          Si no podés venir, cancelá o cambiá el turno desde el enlace del correo con al menos {ajustes.cancelWindowHours} horas de anticipación.
        </p>
      ) : null}
    </main>
  );
}
