/**
 * Selfcheck de la placa de agradecimiento a sponsors de FotoRank.
 *
 * Verifica la agregación de sponsors desde la config de premios y renderiza el
 * PNG con datos de ejemplo. No toca la base de datos.
 *
 * Uso: pnpm --filter fotorank selfcheck:sponsor-card [directorio-salida]
 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  closeTemplatePreviewBrowser,
  renderSponsorThankYouCardPng,
} from "@repo/template-engine-renderer";
import {
  DEFAULT_FOTORANK_SPONSOR_MESSAGE,
  aggregateContestSponsors,
} from "../app/lib/fotorank/partners/contest-sponsor-card";
import { FOTORANK_CARD_LOGO_DATA_URL } from "../app/lib/fotorank/partners/sponsor-card-logo-asset";

const outDir = process.argv[2]?.replace(/\/$/, "") ?? "";

async function main() {
  // 1) Agregación desde la configuración de premios y recompensas.
  const sponsors = aggregateContestSponsors({
    premiosRecompensas: {
      prizes: [
        {
          id: "p1",
          name: "Primer premio",
          type: "PHYSICAL_PRODUCT",
          shortDescription: "Cámara",
          scope: "GENERAL",
          sponsorName: "Estudio Luz",
          sponsorUrl: "https://instagram.com/estudioluz",
          sponsorLogoUrl: "https://cdn.example.com/estudio-luz.png",
        },
      ],
      rewards: [
        {
          id: "r1",
          name: "Descuento en revelado",
          type: "DISCOUNT",
          description: "20% off",
          recipients: "ALL",
          sponsorName: "estudio  luz",
        },
      ],
      economy: { entryMode: "FREE" },
    },
  });

  assert.equal(sponsors.length, 1, "los sponsors con distinto formato de nombre se unifican");
  assert.equal(sponsors[0]!.name, "Estudio Luz");
  assert.equal(sponsors[0]!.roleLabel, "Sponsor oficial");
  assert.equal(sponsors[0]!.prizeNames.length, 1);
  assert.equal(sponsors[0]!.rewardNames.length, 1);
  console.log("[ok] agregación de sponsors desde premios y recompensas");

  // 2) Render real de la placa.
  const card = await renderSponsorThankYouCardPng({
    product: "fotorank",
    data: {
      sponsor: {
        name: "Estudio Luz",
        logoUrl: FOTORANK_CARD_LOGO_DATA_URL,
        tierLabel: "Sponsor oficial",
        instagram: "@estudioluz",
        message: DEFAULT_FOTORANK_SPONSOR_MESSAGE,
      },
      program: {
        productLabel: "FotoRank",
        name: "Concurso Primavera 2026",
        dateFormatted: "20 DE SEPTIEMBRE",
        city: "",
        logoUrl: FOTORANK_CARD_LOGO_DATA_URL,
      },
    },
  });

  assert.equal(card.width, 1080);
  assert.equal(card.height, 1920);
  assert.equal(card.templateKey, "FOTORANK_SPONSOR_THANKYOU_STORY_V1");
  // Una placa sin logo ni texto pesa poco: el umbral detecta renders vacíos.
  assert.ok(card.png.length > 40_000, `PNG sospechosamente liviano (${card.png.length} bytes)`);

  if (outDir) {
    writeFileSync(`${outDir}/sponsor-fotorank-real.png`, card.png);
  }

  console.log(
    `[ok] render ${card.templateKey} ${card.width}×${card.height} ${card.png.length} bytes en ${card.durationMs}ms`
  );
}

main()
  .then(async () => {
    await closeTemplatePreviewBrowser();
    console.log("sponsor-thankyou-card.selfcheck: ok");
  })
  .catch(async (err) => {
    await closeTemplatePreviewBrowser();
    console.error("sponsor-thankyou-card.selfcheck: FAILED");
    console.error(err);
    process.exit(1);
  });
