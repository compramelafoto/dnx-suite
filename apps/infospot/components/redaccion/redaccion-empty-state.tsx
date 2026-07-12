import Link from "next/link";
import type { RedaccionVista } from "@/lib/redaccion-queues";

const EMPTY_COPY: Record<
  RedaccionVista,
  { title: string; description: string; actionLabel?: string; actionHref?: string }
> = {
  "mi-trabajo": {
    title: "Todavía no tenés notas en tu espacio",
    description: "Creá una nota o retomá un borrador para verla acá.",
    actionLabel: "Crear mi primera nota",
    actionHref: "/redaccion/nueva",
  },
  borradores: {
    title: "No hay borradores activos",
    description: "Los borradores sin devolución pendiente aparecen en esta bandeja.",
    actionLabel: "Crear una nota",
    actionHref: "/redaccion/nueva",
  },
  "en-revision": {
    title: "Nada en revisión",
    description: "Cuando alguien envíe una nota a revisión, la vas a ver acá.",
  },
  devueltas: {
    title: "No hay notas devueltas",
    description: "Si el Director devuelve una nota con observación, aparece en esta bandeja.",
  },
  "listas-publicar": {
    title: "Nada lista para publicar",
    description: "Las notas aprobadas editorialmente aparecen acá antes de salir al sitio.",
  },
  publicadas: {
    title: "Todavía no hay notas publicadas",
    description: "Las notas con estado publicada se listan en esta sección.",
  },
  despublicadas: {
    title: "No hay notas despublicadas",
    description: "Las notas que saques del sitio aparecen acá hasta republicarlas o archivarlas.",
  },
  archivadas: {
    title: "No hay notas archivadas",
    description: "Las notas que archives dejan el flujo activo y aparecen acá.",
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
