import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";
import { listActiveOfficeHolders } from "@/lib/commission/terms";
import { groupBoardSeats } from "@/lib/commission/public-board";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string }> };

/**
 * Proponer pide la sesión del portal, que vive en el dominio de FOTOFFICE: desde el dominio
 * propio esta dirección se redirige sola allá (`lib/website/domain/routing.ts`), y sin sesión el
 * login vuelve acá con `next`.
 */
const PROPONER_PATH = "/portal/proyectos/proponer";

async function resolverWorkspace(workspaceSlug: string) {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!branding) notFound();
  return branding;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { commercialName: true },
  });
  if (!branding) return {};
  return {
    title: `Institucional · ${branding.commercialName}`,
    description: `La comisión directiva de ${branding.commercialName} y cómo presentarle un proyecto.`,
  };
}

/**
 * La página Institucional: quiénes integran hoy la comisión directiva y, si Gobierno está
 * encendido, cómo un socio le presenta un proyecto. La comisión sale de los mandatos vigentes de
 * Configuración → Comisión: cambiar a alguien ahí cambia esta página, sin tocar el sitio.
 */
export default async function InstitucionalPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const branding = await resolverWorkspace(workspaceSlug);

  const [holders, gobierno, vocabulario] = await Promise.all([
    listActiveOfficeHolders(branding.workspaceId),
    isModuleEnabledForWorkspace(branding.workspaceId, GOVERNANCE_MODULE_KEY),
    loadPersonVocabulary(branding.workspaceId),
  ]);
  const seats = groupBoardSeats(holders);

  return (
    <main className="mx-auto max-w-5xl space-y-16 px-4 py-12 md:px-8 md:py-16">
      <section className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Comisión Directiva</h1>
          <p className="text-sm opacity-80">
            Quienes conducen {branding.commercialName} en este período.
          </p>
        </header>

        {seats.length === 0 ? (
          <p className="text-sm opacity-70">La comisión directiva todavía no está publicada.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {seats.map((seat) => (
              <li
                key={seat.officeName}
                className="rounded-lg border p-5"
                style={{ borderColor: "color-mix(in srgb, var(--wsite-text) 15%, transparent)" }}
              >
                <p
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: "var(--wsite-primary)" }}
                >
                  {seat.officeName}
                </p>
                <ul className="mt-2 space-y-1">
                  {seat.names.map((nombre) => (
                    <li key={nombre} className="text-lg font-medium">
                      {nombre}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {gobierno ? (
        <section
          className="space-y-6 rounded-xl p-6 md:p-10"
          style={{ backgroundColor: "color-mix(in srgb, var(--wsite-text) 6%, transparent)" }}
        >
          <header className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">¿Tenés un proyecto? Presentalo</h2>
            <p className="opacity-80">
              La comisión quiere escuchar a {vocabulario.plural}. Si tenés una idea para una salida
              fotográfica, un taller, una muestra, una mejora para la sede o un convenio que nos sume,
              podés presentarla desde tu portal.
            </p>
          </header>

          <ol className="space-y-4">
            <Paso numero={1} titulo="Entrá a tu portal">
              Ingresá con tu cuenta. Si todavía no la activaste, escribinos y te ayudamos.
            </Paso>
            <Paso numero={2} titulo="Contanos tu idea">
              En «Mis proyectos», tocá «Proponer un proyecto»: qué es, para qué le sirve a la
              institución y cómo podrías ayudar. Si querés, sumá un costo aproximado, una fecha y archivos.
            </Paso>
            <Paso numero={3} titulo="La comisión la analiza">
              Tu propuesta llega directo a la comisión directiva. Si la acepta, se trata en la próxima
              reunión; si no avanza, te contamos por qué.
            </Paso>
            <Paso numero={4} titulo="Seguila y sumate">
              Ves el estado de tu propuesta en «Mis proyectos». Si se aprueba, quizás te pidamos que
              te sumes con alguna tarea: la vas a encontrar en «Mis tareas».
            </Paso>
          </ol>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={PROPONER_PATH}
              className="inline-flex items-center rounded-md px-5 py-3 font-medium"
              style={{ backgroundColor: "var(--wsite-primary)", color: "var(--wsite-bg)" }}
            >
              Presentar un proyecto
            </Link>
            <p className="text-sm opacity-70">No hace falta tener todo resuelto: una buena idea alcanza para empezar.</p>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        style={{ backgroundColor: "var(--wsite-primary)", color: "var(--wsite-bg)" }}
      >
        {numero}
      </span>
      <div className="space-y-1">
        <p className="font-medium">{titulo}</p>
        <p className="text-sm opacity-80">{children}</p>
      </div>
    </li>
  );
}
