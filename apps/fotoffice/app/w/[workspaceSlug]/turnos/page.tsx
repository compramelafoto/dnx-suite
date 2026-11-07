import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FotoTurno } from "@/components/turnos/foto-turno";
import { ETIQUETA_MODALIDAD, TITULO_PAGINA_POR_OMISION } from "@/lib/turnos/constantes";
import { leerAjustesTurnos, negocioPorSlug, tiposPublicados } from "@/lib/turnos/publico";
import { duracionTexto } from "@/lib/turnos/textos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const negocio = await negocioPorSlug((await params).workspaceSlug);
  if (!negocio) return {};
  const ajustes = await leerAjustesTurnos(negocio.workspaceId);
  return { title: ajustes.pageTitle ?? TITULO_PAGINA_POR_OMISION };
}

const PASOS = ["Elegí el tipo de turno", "Elegí día y horario", "Te llega la confirmación"];

/** Turnos de servicio: los tipos que el estudio publicó para que el cliente reserve solo. */
export default async function TurnosPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const negocio = await negocioPorSlug(workspaceSlug);
  if (!negocio) notFound();
  const [ajustes, tipos] = await Promise.all([leerAjustesTurnos(negocio.workspaceId), tiposPublicados(negocio.workspaceId)]);

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-12 md:px-8 md:py-16">
      <header className="mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{ajustes.pageTitle ?? TITULO_PAGINA_POR_OMISION}</h1>
        <p className="whitespace-pre-line text-base leading-relaxed text-[var(--fo-muted)]">
          {ajustes.pageIntro ?? "Elegí el tipo de turno, el día y el horario que te quede cómodo. La confirmación te llega por correo."}
        </p>
        <ol className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-2 text-sm text-[var(--fo-muted)]">
          {PASOS.map((p, i) => (
            <li key={p} className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--fo-accent)] text-xs font-semibold text-white">{i + 1}</span>
              {p}
            </li>
          ))}
        </ol>
      </header>

      {tipos.length === 0 ? (
        <div className="fo-card p-6 text-center text-sm text-[var(--fo-muted)]">Por ahora no hay turnos para reservar en línea.</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {tipos.map((t) => (
            <section key={t.id} className="fo-card flex flex-col gap-4 p-6">
              <div className="flex items-center gap-4">
                <FotoTurno url={t.imageUrl} nombre={t.name} />
                <div className="min-w-0 space-y-2">
                  <h2 className="text-lg font-semibold leading-snug md:text-xl">{t.name}</h2>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-[var(--fo-border)] px-2.5 py-1 text-[var(--fo-muted)]">{ETIQUETA_MODALIDAD[t.modality]}</span>
                    <span className="rounded-full border border-[var(--fo-border)] px-2.5 py-1 text-[var(--fo-muted)]">{duracionTexto(t.durationMinutes)}</span>
                  </div>
                </div>
              </div>
              {t.publicDescription ? <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--fo-muted)]">{t.publicDescription}</p> : null}
              <div className="mt-auto pt-1">
                <Link href={`/w/${workspaceSlug}/turnos/${t.id}`} className="fo-btn fo-btn-primary text-sm">
                  Elegir día y hora →
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}

      {ajustes.cancelWindowHours > 0 ? (
        <p className="text-center text-xs leading-relaxed text-[var(--fo-muted-soft)]">
          ¿No podés venir? Cambiá o cancelá el turno desde el enlace del correo, con al menos {ajustes.cancelWindowHours} horas de anticipación.
        </p>
      ) : null}
    </main>
  );
}
