import { formatDateEs } from "@/lib/dates";

export { suggestCategorySlug } from "@/lib/clf-readonly-queries";

export function buildClfDraftMarkdown(input: {
  title: string;
  startsAt: Date;
  city: string | null;
  locationName: string | null;
  organizerName: string;
  photographers: string[];
  albumTitle: string | null;
  photoCount: number;
}): { title: string; excerpt: string; content: string } {
  const dateLabel = formatDateEs(input.startsAt);
  const placeParts = [input.locationName, input.city].filter(Boolean);
  const place = placeParts.length ? placeParts.join(", ") : "[COMPLETAR LOCALIDAD]";
  const photoLine =
    input.photographers.length > 0
      ? `Cobertura fotográfica disponible (${input.photoCount} foto${input.photoCount === 1 ? "" : "s"})${
          input.albumTitle ? ` — álbum «${input.albumTitle}»` : ""
        }. Fotógrafo(s): ${input.photographers.join(", ")}.`
      : "[COMPLETAR: crédito fotográfico — no hay fotógrafo identificado en la base]";

  const title = `[Título editorial pendiente] ${input.title}`;
  const excerpt = `Cobertura del evento «${input.title}» realizado el ${dateLabel} en ${place}. [COMPLETAR bajada editorial]`;

  const content = `# ${title}

## El evento

- **Nombre (CLF):** ${input.title}
- **Fecha:** ${dateLabel}
- **Lugar:** ${place}
- **Organizador (según CLF):** ${input.organizerName}

[COMPLETAR POR REDACCIÓN: contexto breve del evento con fuente verificada]

## La jornada

[COMPLETAR POR REDACCIÓN]

## Participación y resultados

[COMPLETAR O ELIMINAR — no inventar resultados, ganadores ni cifras]

## Cobertura fotográfica

${photoLine}

[COMPLETAR: selección de imágenes y créditos definitivos — exigir crédito antes de publicar]

---

> Borrador generado desde ComprameLaFoto (lectura). Solo datos comprobables. Revisar, completar y fact-check antes de publicar.
`;

  return { title, excerpt, content };
}
