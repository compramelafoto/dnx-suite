import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { etiquetaEspecialidad } from "@/lib/membership/specialties";
import { PORTFOLIO_MODULE_KEY, PORTFOLIO_PUBLIC_SEGMENT } from "@/lib/portfolio/constants";
import { loadPublicDirectory, type DirectoryEntry } from "@/lib/portfolio/public-queries";

type Props = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ especialidad?: string }>;
};

async function resolverWorkspace(workspaceSlug: string) {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!branding) notFound();
  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, PORTFOLIO_MODULE_KEY))) notFound();
  return branding;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!branding) return {};
  const vocabulario = await loadPersonVocabulary(branding.workspaceId);
  return {
    title: `${vocabulario.Plural} · ${branding.commercialName}`,
    description: `La obra de ${vocabulario.plural} de ${branding.commercialName}.`,
  };
}

/**
 * El directorio: quiénes publicaron su portfolio.
 *
 * El filtro por especialidad va por la dirección (`?especialidad=retrato`) y no por JavaScript: así
 * funciona sin scripts, el resultado se puede compartir como enlace y queda en el historial del
 * navegador. Para una lista de este tamaño, filtrar en memoria es suficiente — no hace falta
 * volver a la base por cada clic.
 */
export default async function PublicDirectoryPage({ params, searchParams }: Props) {
  const { workspaceSlug } = await params;
  const { especialidad } = await searchParams;

  const branding = await resolverWorkspace(workspaceSlug);
  const [vocabulario, todos] = await Promise.all([
    loadPersonVocabulary(branding.workspaceId),
    loadPublicDirectory(branding.workspaceId),
  ]);

  // Sólo las especialidades que alguien publicado declara: ofrecer filtros vacíos es prometer algo
  // que no está.
  const especialidadesPresentes = [...new Set(todos.flatMap((e) => e.specialties))].sort((a, b) =>
    etiquetaEspecialidad(a).localeCompare(etiquetaEspecialidad(b), "es"),
  );

  const filtroActivo =
    especialidad && especialidadesPresentes.includes(especialidad) ? especialidad : null;
  const listados = filtroActivo
    ? todos.filter((e) => e.specialties.includes(filtroActivo))
    : todos;

  const base = `/w/${workspaceSlug}/${PORTFOLIO_PUBLIC_SEGMENT}`;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-12 md:px-8 md:py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{vocabulario.Plural}</h1>
        <p className="text-sm opacity-80">
          La obra de {vocabulario.plural} de {branding.commercialName}.
        </p>
      </header>

      {especialidadesPresentes.length > 1 ? (
        <nav aria-label="Filtrar por especialidad" className="flex flex-wrap gap-2">
          <FiltroChip href={base} activo={filtroActivo === null} etiqueta="Todas" />
          {especialidadesPresentes.map((id) => (
            <FiltroChip
              key={id}
              href={`${base}?especialidad=${encodeURIComponent(id)}`}
              activo={filtroActivo === id}
              etiqueta={etiquetaEspecialidad(id)}
            />
          ))}
        </nav>
      ) : null}

      {listados.length === 0 ? (
        <p className="text-sm opacity-70">
          {todos.length === 0
            ? `Todavía no hay ${vocabulario.plural} con su portfolio publicado.`
            : "No hay nadie con esa especialidad por ahora."}
        </p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listados.map((entrada) => (
            <TarjetaDeSocio key={entrada.publicSlug} entrada={entrada} base={base} />
          ))}
        </ul>
      )}
    </main>
  );
}

function FiltroChip({
  href,
  activo,
  etiqueta,
}: {
  href: string;
  activo: boolean;
  etiqueta: string;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className="rounded-full border px-3 py-1 text-sm"
      style={
        activo
          ? {
              borderColor: "var(--wsite-primary)",
              backgroundColor: "var(--wsite-primary)",
              color: "var(--wsite-bg)",
            }
          : { borderColor: "var(--wsite-text)", opacity: 0.75 }
      }
    >
      {etiqueta}
    </Link>
  );
}

function TarjetaDeSocio({ entrada, base }: { entrada: DirectoryEntry; base: string }) {
  return (
    <li>
      <Link
        href={`${base}/${entrada.publicSlug}`}
        className="group block space-y-3"
        style={{ color: "inherit" }}
      >
        <div
          className="overflow-hidden rounded"
          style={{ backgroundColor: "color-mix(in srgb, var(--wsite-text) 8%, transparent)" }}
        >
          {entrada.coverUrl ? (
            /* Alto y ancho reservan el espacio antes de que cargue: sin eso la grilla salta. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={entrada.coverUrl}
              alt={`Obra de ${entrada.displayName}`}
              width={entrada.coverWidth ?? undefined}
              height={entrada.coverHeight ?? undefined}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="aspect-[4/3] w-full" />
          )}
        </div>

        <div className="space-y-1">
          <h2 className="font-medium">{entrada.displayName}</h2>
          {entrada.businessName ? (
            <p className="text-sm opacity-70">{entrada.businessName}</p>
          ) : null}
          {entrada.specialties.length > 0 ? (
            <p className="text-xs opacity-60">
              {entrada.specialties.map((id) => etiquetaEspecialidad(id)).join(" · ")}
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
