import type { VisualReference } from "../domain/visual-reference.js";
import type { VisualReferenceNiche } from "../domain/visual-reference-niche.js";

export type VisualReplyKind = "EMPTY" | "WITH_REFERENCES" | "GENERIC";

export function buildVisualReferenceReply(input: {
  niche?: VisualReferenceNiche;
  selected: VisualReference[];
}): { text: string; kind: VisualReplyKind; copyId: string } {
  const { niche, selected } = input;
  if (!niche) {
    return {
      kind: "GENERIC",
      copyId: "VISUAL_GENERIC",
      text: "Todavía no estoy mostrando fotos dentro de la conversación, pero ya anoté que buscás referencias visuales.",
    };
  }

  if (selected.length === 0) {
    return {
      kind: "EMPTY",
      copyId: "VISUAL_NICHE_EMPTY",
      text: `Todavía no tengo referencias autorizadas para mostrarte de ${niche}. Cuando carguemos una selección propia, van a aparecer acá.`,
    };
  }

  const purpose = selected[0]?.educationalPurpose[0];
  const hint =
    purpose === "congelamiento de acción" || purpose === "anticipación del momento"
      ? "cómo separan al atleta del fondo y cómo anticipan el momento de acción"
      : purpose === "composición" || purpose === "iluminación"
        ? `cómo trabajan la ${purpose}`
        : purpose
          ? `el enfoque en ${purpose}`
          : "la composición y el momento";

  return {
    kind: "WITH_REFERENCES",
    copyId: "VISUAL_NICHE_WITH_REFS",
    text: `Te muestro algunas referencias de ${niche}. Fijate especialmente en ${hint}.`,
  };
}
