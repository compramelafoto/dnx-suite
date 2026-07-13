import Link from "next/link";
import type { RedaccionVista } from "@/lib/redaccion-queues";

const EMPTY_COPY: Record<
  RedaccionVista,
  { title: string; description: string; actionLabel?: string; actionHref?: string }
> = {
  "mi-trabajo": {
    title: "Tu inbox está vacío",
    description: "Cuando tengas borradores o piezas en marcha, aparecen acá.",
    actionLabel: "Crear historia",
    actionHref: "/redaccion/asistente",
  },
  borradores: {
    title: "Nada en preparación",
    description: "Los borradores activos viven en esta bandeja.",
    actionLabel: "Crear historia",
    actionHref: "/redaccion/asistente",
  },
  "en-revision": {
    title: "Nada en revisión",
    description: "Cuando alguien envíe una pieza a revisión, la vas a ver acá.",
  },
  devueltas: {
    title: "Nada para corregir",
    description: "Si te devuelven una pieza con observación, aparece en esta bandeja.",
  },
  publicadas: {
    title: "Todavía no hay publicados",
    description: "Las piezas visibles en el sitio se listan acá.",
  },
  despublicadas: {
    title: "No hay despublicados",
    description: "Las piezas que saques del sitio aparecen acá hasta republicarlas o archivarlas.",
  },
  archivadas: {
    title: "No hay archivados",
    description: "Las piezas archivadas dejan el flujo activo y aparecen acá.",
  },
};

type Props = {
  vista: RedaccionVista;
  canCreate?: boolean;
};

export function RedaccionEmptyState({ vista, canCreate = true }: Props) {
  const copy = EMPTY_COPY[vista];
  const showAction = Boolean(canCreate && copy.actionHref && copy.actionLabel);

  return (
    <div className="rounded-[var(--is-radius-lg)] border border-dashed border-[var(--is-border-strong)] bg-[var(--is-bg-secondary)] px-6 py-14 text-center sm:px-10">
      <h3 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight text-[var(--is-text)]">
        {copy.title}
      </h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--is-text-secondary)]">
        {copy.description}
      </p>
      {showAction ? (
        <Link
          href={copy.actionHref!}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)]"
        >
          {copy.actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
