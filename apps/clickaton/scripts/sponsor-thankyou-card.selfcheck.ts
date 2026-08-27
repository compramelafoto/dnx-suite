/**
 * Selfcheck de las placas de agradecimiento a sponsors.
 *
 * Renderiza ambos productos con datos de ejemplo y verifica que el PNG salga
 * en 1080×1920 con el logo del sponsor visible. No toca la base de datos.
 *
 * Uso: pnpm --filter clickaton selfcheck:sponsor-card [directorio-salida]
 */
import { writeFileSync } from "node:fs";
import {
  closeTemplatePreviewBrowser,
  renderSponsorThankYouCardPng,
} from "@repo/template-engine-renderer";
import { CLICKATON_CARD_LOGO_DATA_URL } from "@/lib/participant-cards/participant-card-branding-logo";
import { DEFAULT_SPONSOR_THANKYOU_MESSAGE } from "@/lib/sponsor-cards/sponsor-thankyou-card";

const outDir = process.argv[2]?.replace(/\/$/, "") ?? "";

const cases = [
  {
    product: "clickaton" as const,
    file: "sponsor-clickaton.png",
    data: {
      sponsor: {
        name: "Óptica Del Centro",
        logoUrl: CLICKATON_CARD_LOGO_DATA_URL,
        tierLabel: "Sponsor oficial",
        instagram: "@opticadelcentro",
        message: DEFAULT_SPONSOR_THANKYOU_MESSAGE,
      },
      program: {
        productLabel: "Clickatón",
        name: "Clickatón Córdoba 2026",
        dateFormatted: "11 DE OCTUBRE",
        city: "Córdoba",
        logoUrl: CLICKATON_CARD_LOGO_DATA_URL,
      },
    },
  },
  {
    product: "fotorank" as const,
    file: "sponsor-fotorank.png",
    data: {
      sponsor: {
        name: "Estudio Luz",
        logoUrl: CLICKATON_CARD_LOGO_DATA_URL,
        tierLabel: "Auspiciante",
        instagram: "@estudioluz",
        message:
          "Gracias por apoyar a quienes compiten, comparten y elevan el nivel de la fotografía.",
      },
      program: {
        productLabel: "FotoRank",
        name: "Concurso Primavera 2026",
        dateFormatted: "20 DE SEPTIEMBRE",
        city: "Córdoba",
        logoUrl: CLICKATON_CARD_LOGO_DATA_URL,
      },
    },
  },
];

let failures = 0;

try {
  for (const testCase of cases) {
    const card = await renderSponsorThankYouCardPng({
      product: testCase.product,
      data: testCase.data,
    });

    const problems: string[] = [];
    if (card.width !== 1080 || card.height !== 1920) {
      problems.push(`dimensiones ${card.width}×${card.height} (esperado 1080×1920)`);
    }
    // Una placa sin logo ni texto pesa poco: el umbral detecta renders vacíos.
    if (card.png.length < 40_000) {
      problems.push(`PNG sospechosamente liviano (${card.png.length} bytes)`);
    }
    if (card.warnings.some((w) => w.includes("sponsor-logo"))) {
      problems.push(`logo del sponsor no resuelto: ${card.warnings.join(", ")}`);
    }

    if (outDir) {
      writeFileSync(`${outDir}/${testCase.file}`, card.png);
    }

    if (problems.length > 0) {
      failures += 1;
      console.error(`[FAIL] ${testCase.product}: ${problems.join(" | ")}`);
    } else {
      console.log(
        `[ok] ${testCase.product}: ${card.templateKey} ${card.width}×${card.height} ` +
          `${card.png.length} bytes en ${card.durationMs}ms`
      );
    }
  }
} finally {
  await closeTemplatePreviewBrowser();
}

if (failures > 0) {
  console.error("sponsor-thankyou-card.selfcheck: FAILED");
  process.exit(1);
}

console.log("sponsor-thankyou-card.selfcheck: ok");
