import type {
  PackBenefitKind,
  BenefitSelectionMode,
  BenefitTemplatePolicy,
} from "@/lib/prisma";
import { templatePolicyShortEs } from "@/lib/preventa-canjeable/benefit-copy";
import { extraUnitPriceTermsParagraph } from "@/lib/preventa-canjeable/extra-unit-price-copy";
import type {
  PreventaTermsSectionDoc,
  TermsContentBlock,
  TermsPackItemCard,
} from "@/lib/preventa-canjeable/preventa-terms-types";
import type { PreventaTermsPriceRow } from "@/lib/preventa-canjeable/preventa-terms-post-checkout";

export type { PreventaTermsSectionDoc } from "@/lib/preventa-canjeable/preventa-terms-types";

export type LegacyProductLine = {
  name: string;
  price: number;
  requiresDesign: boolean;
  minFotos: number;
  maxFotos: number;
};

export type BuildPreventaTermsInput = {
  albumTitle: string;
  preCompraCloseAt: Date | null;
  requireClientApproval: boolean;
  legacyProducts: LegacyProductLine[];
  packs: Array<{
    name: string;
    description: string | null;
    priceClientArs: number;
    validFrom: Date | null;
    validUntil: Date | null;
    redemptionDeadlineAt: Date | null;
    benefits: Array<{
      kind: PackBenefitKind;
      includedQuantity: number;
      selectionMode: BenefitSelectionMode;
      requiredPhotoCount: number;
      maxPhotosPerUnit: number | null;
      templatePolicy: BenefitTemplatePolicy;
      templateName: string | null;
      photographerProductLabel: string | null;
      extraUnitPriceOverrideArs: number | null;
      /** Precio de lista de referencia después de la preventa (si el fotógrafo lo cargó). */
      regularUnitPriceAfterPreventaArs: number | null;
    }>;
  }>;
  /** % fee plataforma (sobre precio base del fotógrafo). */
  platformFeePercent: number;
  /** Filas prearmadas: precios orientativos en el checkout del álbum fuera del pack. */
  postCheckoutPriceRows: PreventaTermsPriceRow[];
};

function fmtDate(d: Date): string {
  return d.toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" });
}

function getSharedPackCloseAt(
  packs: Array<{ validUntil: Date | null }>
): Date | null {
  const dates = packs.map((p) => p.validUntil).filter(Boolean) as Date[];
  if (dates.length === 0) return null;
  const uniq = new Set(dates.map((d) => d.getTime()));
  if (uniq.size !== 1) return null;
  return new Date([...uniq][0]);
}

function hasAnyPackCloseAt(packs: Array<{ validUntil: Date | null }>): boolean {
  return packs.some((p) => p.validUntil != null);
}

/** Texto breve por ítem: evita repetir el mismo párrafo en cada pack. */
function buildPackItemCard(
  b: BuildPreventaTermsInput["packs"][0]["benefits"][0]
): TermsPackItemCard {
  const isDigital = b.kind === "DIGITAL";
  const title = isDigital
    ? "Fotos en formato digital"
    : b.photographerProductLabel
      ? `Producto impreso: ${b.photographerProductLabel}`
      : "Productos impresos";

  const quantityLabel = `${b.includedQuantity} unidad${b.includedQuantity !== 1 ? "es" : ""} incluida${b.includedQuantity !== 1 ? "s" : ""}`;

  const lines: string[] = [];

  if (isDigital) {
    const n = b.includedQuantity;
    const base =
      n === 1
        ? "Una foto digital a elegir en el álbum cuando las imágenes estén disponibles."
        : `${n} fotos digitales a elegir en el álbum cuando las imágenes estén disponibles.`;
    lines.push(`${base} Envío por email según indique el fotógrafo o el evento.`);
    if (b.selectionMode === "MULTI_PHOTO_FIXED" && b.requiredPhotoCount > 1) {
      lines.push(
        `Cada unidad de este ítem usa ${b.requiredPhotoCount} fotos distintas del álbum.`
      );
    }
  } else {
    lines.push(
      `Incluye ${b.includedQuantity} unidad${b.includedQuantity !== 1 ? "es" : ""} de este impreso. Producción y entrega se coordinan con el fotógrafo o la institución.`
    );
    if (b.templatePolicy !== "NONE") {
      lines.push(
        b.templateName
          ? `Plantilla (${templatePolicyShortEs(b.templatePolicy)}): ${b.templateName}.`
          : `Puede aplicarse plantilla (${templatePolicyShortEs(b.templatePolicy)}).`
      );
    }
    if (b.selectionMode === "SINGLE_PHOTO") {
      lines.push("En lo habitual, cada unidad corresponde a una foto elegida del álbum.");
    } else if (b.selectionMode === "MULTI_PHOTO_FIXED") {
      lines.push(
        `Cada unidad requiere ${b.requiredPhotoCount} foto${b.requiredPhotoCount !== 1 ? "s" : ""} distintas del álbum.`
      );
    } else if (b.maxPhotosPerUnit != null) {
      lines.push(`Hasta ${b.maxPhotosPerUnit} foto${b.maxPhotosPerUnit !== 1 ? "s" : ""} por unidad (orientativo).`);
    }
  }

  lines.push(extraUnitPriceTermsParagraph(b.extraUnitPriceOverrideArs));

  return { title, quantityLabel, lines };
}

/** Tabla compacta: precios finales y fechas, sin desglosar fee (el cliente ya ve el total en la página). */
function buildPreciosYPlazosSection(input: BuildPreventaTermsInput): PreventaTermsSectionDoc {
  const rows: { label: string; value: string; hint?: string }[] = [];
  const usePackDates = input.packs.length > 0;
  const sharedPackCloseAt = usePackDates ? getSharedPackCloseAt(input.packs) : null;
  const hasPackCloseDates = usePackDates && hasAnyPackCloseAt(input.packs);

  if (usePackDates) {
    if (sharedPackCloseAt) {
      rows.push({
        label: "Último día para comprar en esta preventa",
        value: fmtDate(sharedPackCloseAt),
      });
    } else if (hasPackCloseDates) {
      rows.push({
        label: "Cierre de preventa",
        value: "Depende del pack que elijas",
      });
    }
  } else if (input.preCompraCloseAt) {
    rows.push({
      label: "Último día para comprar en esta preventa",
      value: fmtDate(input.preCompraCloseAt),
    });
  } else {
    rows.push({
      label: "Cierre de preventa",
      value: "Sin fecha límite cargada",
    });
  }

  if (input.requireClientApproval) {
    rows.push({
      label: "Aprobación del fotógrafo",
      value: "Puede pedirse antes de ver todas las fotos",
      hint: "No cancela lo que pagás en la preventa; puede cambiar cuándo ves o descargás el material.",
    });
  }

  for (const p of input.packs) {
    const hints: string[] = [];
    if (p.validFrom) hints.push(`Vigencia desde: ${fmtDate(p.validFrom)}`);
    if (p.validUntil) hints.push(`Hasta: ${fmtDate(p.validUntil)}`);
    if (p.redemptionDeadlineAt) hints.push(`Usar lo comprado antes de: ${fmtDate(p.redemptionDeadlineAt)}`);
    rows.push({
      label: `Pack «${p.name}»`,
      value: `$${p.priceClientArs.toLocaleString("es-AR")} total`,
      hint: hints.length ? hints.join(" · ") : undefined,
    });
  }

  return {
    id: "precios-y-plazos",
    title: "Precios y plazos",
    blocks: [
      {
        kind: "paragraphs",
        paragraphs: [
          "Montos y fechas según la configuración de este álbum. Si algo no coincide con lo acordado con el fotógrafo, consultalo antes de pagar.",
        ],
      },
      {
        kind: "priceList",
        title: "Resumen",
        rows,
      },
    ],
  };
}

function buildSobrePreventaSection(input: BuildPreventaTermsInput): PreventaTermsSectionDoc {
  const blocks: TermsContentBlock[] = [
    {
      kind: "paragraphs",
      paragraphs: [
        `Con esta preventa reservás productos vinculados al álbum «${input.albumTitle}» antes de elegir las fotos finales, cuando corresponda.`,
        "La elección de imágenes, datos o la entrega pueden completarse más adelante, cuando el material esté disponible.",
      ],
    },
  ];

  const bullets: string[] = [];
  if (input.packs.length > 0) {
    const sharedPackCloseAt = getSharedPackCloseAt(input.packs);
    if (sharedPackCloseAt) {
      bullets.push(
        `La oferta de preventa cierra el ${fmtDate(sharedPackCloseAt)}; después puede no repetirse en las mismas condiciones.`
      );
    } else if (hasAnyPackCloseAt(input.packs)) {
      bullets.push("La fecha de cierre depende del pack que elijas.");
    }
  } else if (input.preCompraCloseAt) {
    bullets.push(
      `La oferta de preventa cierra el ${fmtDate(input.preCompraCloseAt)}; después puede no repetirse en las mismas condiciones.`
    );
  }
  if (input.requireClientApproval) {
    bullets.push(
      "Este álbum puede exigir aprobación del fotógrafo antes de mostrar todas las fotos; no afecta el monto abonado en la preventa."
    );
  }
  if (bullets.length) {
    blocks.push({ kind: "bullets", items: bullets });
  }

  return { id: "sobre-preventa", title: "Sobre esta preventa", blocks };
}

export function buildPreventaTermsDocument(input: BuildPreventaTermsInput): PreventaTermsSectionDoc[] {
  const sections: PreventaTermsSectionDoc[] = [];

  sections.push(buildSobrePreventaSection(input));
  sections.push(buildPreciosYPlazosSection(input));

  // Detalle de artículos
  const s2Blocks: TermsContentBlock[] = [];

  if (input.packs.length > 0) {
    for (const p of input.packs) {
      const validityLines: string[] = [];
      if (p.validFrom) validityLines.push(`Válido desde: ${fmtDate(p.validFrom)}`);
      if (p.validUntil) validityLines.push(`Válido hasta: ${fmtDate(p.validUntil)}`);
      if (p.redemptionDeadlineAt) {
        validityLines.push(`Plazo para usar lo comprado: ${fmtDate(p.redemptionDeadlineAt)}`);
      }

      const items =
        p.benefits.length > 0
          ? p.benefits.map((b) => buildPackItemCard(b))
          : [];

      s2Blocks.push({
        kind: "packBlock",
        packName: p.name,
        priceLabel: `$${p.priceClientArs.toLocaleString("es-AR")}`,
        intro: p.description?.trim() || undefined,
        validityLines: validityLines.length ? validityLines : undefined,
        items:
          items.length > 0
            ? items
            : [
                {
                  title: "Contenido del pack",
                  quantityLabel: "—",
                  lines: [
                    "Los ítems de este pack no están detallados en el sistema. Consultá al fotógrafo para saber qué incluye exactamente.",
                  ],
                },
              ],
      });
    }
  }

  if (input.legacyProducts.length > 0) {
    if (input.packs.length > 0) {
      s2Blocks.push({
        kind: "paragraphs",
        paragraphs: [
          "También podés elegir productos del catálogo por unidad (independiente de los packs anteriores):",
        ],
      });
    }
    s2Blocks.push({
      kind: "legacyProducts",
      products: input.legacyProducts.map((pr) => ({
        name: pr.name,
        priceLabel: `$${pr.price.toLocaleString("es-AR")}`,
        lines: [
          `Selección de fotos: entre ${pr.minFotos} y ${pr.maxFotos} por unidad, según el producto.`,
          pr.requiresDesign
            ? "Incluye diseño en plantilla."
            : "Revisá en el flujo si aplica plantilla o diseño.",
        ],
      })),
    });
  }

  if (s2Blocks.length === 0) {
    s2Blocks.push({
      kind: "paragraphs",
      paragraphs: [
        "No hay artículos cargados en este resumen. Si estás viendo productos en la página, actualizá o consultá al fotógrafo.",
      ],
    });
  }

  sections.push({
    id: "detalle-articulos",
    title: "Qué incluye cada pack",
    blocks: s2Blocks,
  });

  if (input.postCheckoutPriceRows.length > 0) {
    sections.push({
      id: "precios-despues-preventa",
      title: "Si comprás algo más en el álbum después",
      blocks: [
        {
          kind: "paragraphs",
          paragraphs: [
            "Cuando las fotos estén publicadas podés sumar digitales o impresos fuera del pack. Los montos de abajo son orientativos y pueden cambiar; el precio final aparece en el checkout del álbum.",
          ],
        },
        {
          kind: "priceList",
          title: "Referencias de precio",
          rows: input.postCheckoutPriceRows,
        },
      ],
    });
  }

  sections.push({
    id: "eleccion-fotos",
    title: "Después de pagar: elección, entrega y extras",
    blocks: [
      {
        kind: "paragraphs",
        paragraphs: [
          "Vas a volver al álbum o al flujo que indique el fotógrafo para elegir fotos, completar datos o confirmar cómo recibís el material.",
          "Si un ítem pide una cantidad fija de fotos por unidad, se respeta al elegir.",
          "Los impresos se producen y entregan con el fotógrafo o la institución. Si un ítem admite unidades extra al canjear, el costo se suma a lo ya pagado y se confirma en ese momento.",
        ],
      },
    ],
  });

  sections.push({
    id: "selfie",
    title: "Selfie para buscar fotos",
    blocks: [
      {
        kind: "highlight",
        tone: "amber",
        title: "Importante",
        paragraphs: [
          "En algunos álbumes podés cargar una selfie para ubicar más rápido fotos en las que podrías aparecer; es una ayuda, no una identificación infalible.",
          "Los resultados dependen de la calidad de las fotos del evento, luz, ángulo y cobertura: no garantiza encontrar todas las imágenes.",
        ],
      },
    ],
  });

  sections.push({
    id: "proteccion-datos",
    title: "Tus datos",
    blocks: [
      {
        kind: "paragraphs",
        paragraphs: [
          "Los datos y las imágenes se usan para operar la compra, ubicar fotos si corresponde y coordinar la entrega, con acceso acotado y criterios de confidencialidad alineados a la normativa argentina de datos personales. Más detalle en la política de privacidad del sitio o los canales del fotógrafo.",
        ],
      },
    ],
  });

  sections.push({
    id: "importes-aceptacion",
    title: "Aceptación",
    blocks: [
      {
        kind: "paragraphs",
        paragraphs: [
          "Los precios de los packs en esta preventa son los totales que ves al pagar. Las referencias «después en el álbum» son orientativas.",
          "Al confirmar la compra aceptás estas condiciones y las que rijan el pago y la gestión posterior del pedido.",
        ],
      },
    ],
  });

  return sections;
}

