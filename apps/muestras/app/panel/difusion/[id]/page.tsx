import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  RSVP_MODE_LABELS, SOCIAL_VARIANT_LABELS, SOCIAL_VARIANT_PARAMS, availableSocialVariants, isRsvpMode, openingHasTime,
  openingWhenText, recommendedVariant, type SocialVariant,
} from "@repo/muestras";
import { enlace, nota, seccion } from "@/components/difusion/estilos";
import { PiezasRedes } from "@/components/difusion/piezas-redes";
import { CopiarEnlace } from "@/components/enlace/copiar-enlace";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { cargarMuestraParaDifusion } from "@/lib/redes/cargar";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Difusión" };

type Props = { params: Promise<{ id: string }> };

const PARAM = Object.fromEntries(Object.entries(SOCIAL_VARIANT_PARAMS).map(([p, v]) => [v, p])) as Record<SocialVariant, string>;

export default async function DifusionDeMuestra({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/difusion/${id}`);
  // Sin `promote` (rol de textos, ajenos): no existe.
  const a = await cargarMuestraParaDifusion(id, usuario);
  if (!a) notFound();
  const ahora = new Date();
  const publicada = a.reviewStatus === "APPROVED";
  const muestra = { ...a, worksCount: a.works.length };
  const disponibles = availableSocialVariants(muestra, ahora);
  const recomendada = recommendedVariant(muestra, ahora);
  const paraRedes = disponibles.filter((v) => v !== "INVITATION");
  const inicial = recomendada && recomendada !== "INVITATION" ? recomendada : paraRedes[0];
  const obras = [...a.works]
    .sort((x, y) => Number(y.isHighlight) - Number(x.isHighlight))
    .map((w) => ({ id: w.id, etiqueta: `${w.title} — ${w.authorName}${w.isHighlight ? " (destacada)" : ""}` }));
  const conHora = openingHasTime(a.openingAt);
  const modo = isRsvpMode(a.rsvpStatus) ? a.rsvpStatus : "OFF";

  return (
    <main className="max-w-3xl space-y-8">
      <Link href="/panel/difusion" className="text-sm underline underline-offset-4">Volver a Difusión</Link>
      <header className="space-y-3">
        <p className="text-sm text-[var(--mf-muted)]">{a.title}</p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Difusión</h1>
        {!publicada ? (
          <p className="text-lg">Las piezas se arman cuando la muestra esté publicada.</p>
        ) : a.isCancelled ? (
          <p className="text-lg text-[var(--mf-alerta)]">La muestra está cancelada: no se arman piezas.</p>
        ) : null}
      </header>

      {publicada && !a.isCancelled ? (
        <>
          <section className={seccion}>
            <h2 className="text-lg">Piezas para redes</h2>
            {paraRedes.length && inicial ? (
              <PiezasRedes
                activityId={a.id}
                nombre="redes"
                variantes={paraRedes.map((v) => ({ param: PARAM[v], etiqueta: SOCIAL_VARIANT_LABELS[v] }))}
                inicial={PARAM[inicial]}
                obras={obras}
              />
            ) : (
              <p className={nota}>Ya no hay piezas para armar: la muestra cerró.</p>
            )}
          </section>

          <section className={seccion}>
            <h2 className="text-lg">Invitación</h2>
            {disponibles.includes("INVITATION") ? (
              <>
                <p className={nota}>Con un QR que lleva a la página de la inauguración. También para imprimir.</p>
                <PiezasRedes
                  activityId={a.id}
                  nombre="invitacion"
                  variantes={[{ param: PARAM.INVITATION, etiqueta: SOCIAL_VARIANT_LABELS.INVITATION }]}
                  inicial={PARAM.INVITATION}
                  impresos
                />
              </>
            ) : a.isVirtualOnly ? (
              <p className={nota}>La invitación es para muestras presenciales.</p>
            ) : !conHora ? (
              <p className={nota}>
                <Link href={`/panel/muestras/${a.id}`} className={enlace}>Cargá la hora de la inauguración en la ficha</Link> para armar la invitación.
              </p>
            ) : (
              <p className={nota}>La inauguración ya pasó.</p>
            )}
          </section>
        </>
      ) : null}

      {!a.isVirtualOnly ? (
        <section className={seccion}>
          <h2 className="text-lg">Inauguración</h2>
          {a.openingAt ? <p className="text-[15px]">{openingWhenText(a.openingAt, a.openingEndsAt)}</p> : null}
          <p className="text-[15px]">Confirmación de asistencia: {RSVP_MODE_LABELS[modo]}.</p>
          {publicada && conHora ? (
            <CopiarEnlace url={`${baseUrlPublica()}/m/${a.slug}/inauguracion`} etiqueta="Enlace público de la invitación" />
          ) : null}
          <p><Link href={`/panel/difusion/${a.id}/inauguracion`} className={enlace}>Ver la lista y configurar</Link></p>
        </section>
      ) : null}
    </main>
  );
}
