import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProposalByCode } from "@repo/db/partners-proposals";
import { normalizeProposalCode, proposalDaysLeft } from "@repo/partners";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";

/**
 * Recuperar una propuesta con su código.
 *
 * El vendedor arma la propuesta en la reunión, manda el PDF y el cliente
 * contesta a los diez días. Sin esta pantalla habría que rehacerla y volver a
 * pedirle el logo a alguien que ya lo mandó una vez.
 *
 * No lleva sesión a propósito: quien tiene el código es quien la armó o quien
 * la recibió. Lo que el código abre es una sola propuesta, y nada más.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recuperar una propuesta · DNX Partners",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ codigo: string }> };

/** Momentos reales: cuándo se armó, cuándo vence. */
const FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * Fechas de vigencia. Se guardaron a medianoche UTC desde un `AAAA-MM-DD`;
 * mostrarlas en hora argentina las correría un día para atrás.
 */
const VIGENCIA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default async function PropuestaGuardadaPage({ params }: Props) {
  const { codigo } = await params;
  const normalizado = normalizeProposalCode(codigo);
  if (!normalizado) notFound();

  const ahora = new Date();
  let propuesta: Awaited<ReturnType<typeof getProposalByCode>> = null;
  try {
    propuesta = await getProposalByCode({ code: normalizado, now: ahora });
  } catch {
    // La tabla puede no estar migrada todavía. Se responde como «no está»:
    // desde afuera es el mismo resultado y no revela nada del despliegue.
    propuesta = null;
  }

  if (!propuesta) {
    return (
      <Section aria-labelledby="propuesta-title">
        <Container>
          <SectionHeader
            eyebrow="DNX Partners"
            title="No encontramos esa propuesta"
            description="Puede que el código esté mal escrito o que la propuesta haya vencido. Las propuestas se guardan treinta días."
            titleId="propuesta-title"
          />
          <div className="mt-8">
            <Link
              href="/propuesta"
              className="inline-flex items-center rounded-lg bg-ck-text px-5 py-2.5 text-sm font-semibold text-white"
            >
              Armar una propuesta nueva
            </Link>
          </div>
        </Container>
      </Section>
    );
  }

  const diasRestantes = proposalDaysLeft(propuesta, ahora);
  const sinLogo = !propuesta.logoStorageKey;

  return (
    <Section aria-labelledby="propuesta-title">
      <Container>
        <SectionHeader
          eyebrow={`Propuesta ${propuesta.code}`}
          title={propuesta.brandName}
          description={
            propuesta.industry
              ? `${propuesta.industry} · armada el ${FECHA.format(propuesta.createdAt)}`
              : `Armada el ${FECHA.format(propuesta.createdAt)}`
          }
          titleId="propuesta-title"
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ck-text-muted">
              Espacios de la propuesta
            </h2>
            <ul className="mt-4 divide-y divide-ck-border rounded-xl border border-ck-border">
              {propuesta.items.map((item) => (
                <li key={item.id} className="px-4 py-3.5">
                  <div className="text-sm font-medium text-ck-text">{item.label}</div>
                  {item.location ? (
                    <div className="text-xs text-ck-text-muted">{item.location}</div>
                  ) : null}
                </li>
              ))}
            </ul>

            <p className="mt-4 text-sm text-ck-text-muted">
              Vigencia del {VIGENCIA.format(propuesta.periodStart)} al{" "}
              {VIGENCIA.format(propuesta.periodEnd)}. La disponibilidad se vuelve a
              verificar al descargar: si algún espacio se vendió mientras tanto, el
              dossier sale sin él.
            </p>
          </div>

          <aside className="rounded-xl border border-ck-border bg-ck-surface p-5">
            <p className="text-sm text-ck-text">
              {diasRestantes > 0 ? (
                <>
                  Se puede recuperar{" "}
                  <strong>
                    {diasRestantes} {diasRestantes === 1 ? "día" : "días"} más
                  </strong>
                  .
                </>
              ) : (
                <>Esta propuesta ya no vence: quedó como historial.</>
              )}
            </p>

            {sinLogo ? (
              <p className="mt-4 text-sm text-ck-text-muted">
                El logo de esta propuesta ya no está guardado, así que no se puede
                rearmar el dossier. Los datos quedan como referencia.
              </p>
            ) : (
              <a
                href={`/api/propuesta/${propuesta.code}/pdf`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-ck-text px-5 py-2.5 text-sm font-semibold text-white"
              >
                Descargar el dossier
              </a>
            )}

            <Link
              href="/propuesta"
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-ck-border px-5 py-2.5 text-sm font-semibold text-ck-text"
            >
              Armar una nueva
            </Link>
          </aside>
        </div>
      </Container>
    </Section>
  );
}
