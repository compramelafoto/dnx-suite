import assert from "node:assert/strict";
import {
  formatPrizeAmount,
  groupPrizesByCategory,
  resolveCategoryPresentation,
  resolvePublicContestPrizes,
  toPublicPrizePresentations,
  type ContestPrizePresentation,
} from "./index";
import { SANTA_FE_EN_FOCO_PUBLIC_PRIZES } from "./santa-fe-en-foco-prizes";
import type { ContestPrizeItem } from "../prizesRewards";

/* ——— Categorías ——— */

const amateur = resolveCategoryPresentation({
  id: "1",
  name: "Fotógrafo Amateur",
  slug: "fotografo-amateur",
  description: "Participantes aficionados.",
  maxFiles: 1,
});
assert.equal(amateur.kind, "amateur");
assert.ok(amateur.badges.some((b) => b.label.includes("Celular")));
assert.ok(amateur.badges.some((b) => b.label.includes("1 fotografía")));
assert.ok(amateur.icon);

const pro = resolveCategoryPresentation({
  id: "2",
  name: "Fotógrafo Profesional",
  slug: "fotografo-profesional",
  description: null,
  maxFiles: 1,
});
assert.equal(pro.kind, "professional");
assert.ok(pro.primaryLabel?.toLowerCase().includes("cámara"));
assert.equal(pro.requirementNote, null);

const press = resolveCategoryPresentation({
  id: "3",
  name: "Reportero Gráfico",
  slug: "reportero-grafico",
  description: "x",
  maxFiles: 2,
});
assert.equal(press.kind, "press");
assert.ok(press.requirementNote?.includes("ARGRA"));
assert.ok(press.badges.some((b) => b.key === "verify"));
assert.ok(press.badges.some((b) => b.label.includes("2 fotografías")));

const aerial = resolveCategoryPresentation({
  id: "4",
  name: "Fotografía Aérea",
  slug: "fotografia-aerea",
  description: "x",
  maxFiles: 1,
});
assert.equal(aerial.kind, "aerial");
assert.ok(aerial.primaryLabel?.toLowerCase().includes("dron"));

const unknown = resolveCategoryPresentation({
  id: "5",
  name: "Paisaje urbano",
  slug: "paisaje-urbano",
  description: null,
  maxFiles: 3,
});
assert.equal(unknown.kind, "generic");
assert.ok(unknown.badges.some((b) => b.label.includes("3 fotografías")));
assert.equal(unknown.primaryLabel, null);
assert.equal(unknown.requirementNote, null);

/* Una sola categoría / impar: el resolver no falla */
assert.equal(
  resolveCategoryPresentation({
    id: "solo",
    name: "Única",
    slug: "unica",
    description: "Solo una",
    maxFiles: 5,
  }).kind,
  "generic",
);

/* ——— Premios: filtrado por visibilidad ——— */

const sample: ContestPrizeItem[] = [
  {
    id: "d1",
    name: "Borrador",
    type: "CASH",
    shortDescription: "no público",
    scope: "GENERAL",
    visiblePublic: false,
    isPrimary: true,
    isMonetary: true,
    amount: 1000,
    currency: "ARS",
  },
  {
    id: "pending-like",
    name: "Pendiente",
    type: "TROPHY",
    shortDescription: "confirmado internamente pero no público",
    scope: "GENERAL",
    visiblePublic: false,
    isMonetary: false,
  },
  {
    id: "p1",
    name: "Gran Premio",
    type: "CASH",
    shortDescription: "Premio principal",
    scope: "GENERAL",
    visiblePublic: true,
    isPrimary: true,
    isMonetary: true,
    amount: 500000,
    currency: "ARS",
  },
  {
    id: "p2",
    name: "1.er premio Amateur",
    type: "CASH",
    shortDescription: "",
    scope: "CATEGORY",
    categoryId: "c1",
    positionLabel: "1.er puesto",
    visiblePublic: true,
    isMonetary: true,
    amount: 300000,
    currency: "ARS",
    sponsorName: "Sponsor X",
  },
  {
    id: "p3",
    name: "Mención",
    type: "DIPLOMA",
    shortDescription: "Sin sponsor",
    scope: "GENERAL",
    visiblePublic: true,
    isMonetary: false,
    sponsorContribution: "Diploma digital",
  },
];

const pubs = toPublicPrizePresentations(sample, [{ id: "c1", name: "Amateur" }]);
assert.equal(pubs.length, 3, "solo visiblePublic");
assert.ok(!pubs.some((p) => p.id === "d1" || p.id === "pending-like"));
assert.equal(pubs[0]?.featured, true);
assert.equal(pubs[0]?.monetaryAmount, 500000);
assert.equal(pubs.find((p) => p.id === "p2")?.categoryName, "Amateur");
assert.equal(pubs.find((p) => p.id === "p2")?.sponsorName, "Sponsor X");
assert.equal(pubs.find((p) => p.id === "p3")?.benefitLabel, "Diploma digital");
assert.equal(pubs.find((p) => p.id === "p3")?.sponsorName, undefined);

const money = formatPrizeAmount(500000, "ARS");
assert.match(money, /500/);
assert.ok(!money.includes("500000")); // formateado, no crudo

const groups = groupPrizesByCategory(
  pubs.filter((p) => !p.featured) as ContestPrizePresentation[],
);
assert.ok(groups.some((g) => g.categoryId === "c1"));
assert.ok(groups.some((g) => g.categoryId === null));

/* Preset Santa Fe oficial (sfef-2026-bases-v2) + resolve sin módulo */
assert.equal(SANTA_FE_EN_FOCO_PUBLIC_PRIZES.length, 3);
assert.ok(SANTA_FE_EN_FOCO_PUBLIC_PRIZES.every((p) => p.status === "PUBLIC"));
assert.equal(SANTA_FE_EN_FOCO_PUBLIC_PRIZES[0]?.monetaryAmount, 500_000);
assert.equal(
  resolvePublicContestPrizes({
    contestSlug: "santa-fe-en-foco",
    rulesData: {},
    categories: [],
  }).length,
  3,
);

assert.equal(
  resolvePublicContestPrizes({
    contestSlug: "otro",
    rulesData: { premiosRecompensas: { prizes: [], rewards: [] } },
    categories: [],
  }).length,
  0,
);

/* Módulo con premio público gana sobre preset vacío */
const fromModule = resolvePublicContestPrizes({
  contestSlug: "santa-fe-en-foco",
  rulesData: {
    premiosRecompensas: {
      prizes: [
        {
          id: "mod-1",
          name: "Premio módulo",
          type: "CASH",
          shortDescription: "ok",
          scope: "GENERAL",
          visiblePublic: true,
          isPrimary: true,
          isMonetary: true,
          amount: 100,
          currency: "ARS",
        },
      ],
      rewards: [],
    },
  },
  categories: [],
});
assert.equal(fromModule.length, 1);
assert.equal(fromModule[0]?.title, "Premio módulo");

/* Orden: featured primero */
assert.equal(fromModule[0]?.featured, true);

console.log("contest-public-presentation.selfcheck: OK");
