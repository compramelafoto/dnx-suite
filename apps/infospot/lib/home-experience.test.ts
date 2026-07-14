/**
 * Tests del resolver de Home adaptativa (sin red / sin Prisma).
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/home-experience.test.ts
 */

import assert from "node:assert/strict";
import {
  HOME_MODE_DEFAULT_PRIORITY,
  parseHomeExperienceCookie,
  pickDefaultHomeMode,
  resolveHomeExperience,
} from "./home-experience";

// 1. Visitante
{
  const exp = resolveHomeExperience({ activeProfiles: [] });
  assert.equal(exp.mode, "GUEST");
  assert.equal(exp.canSwitchMode, false);
  assert.equal(exp.blocks[0], "hero");
  assert.ok(exp.blocks.includes("organizer_pitch"));
  assert.ok(exp.headerPrimaryCta?.href.includes("publicar-evento"));
}

// 2. Solo CUSTOMER — prioriza agenda / cerca / categorías
{
  const exp = resolveHomeExperience({ activeProfiles: ["CUSTOMER"] });
  assert.equal(exp.mode, "CUSTOMER");
  assert.deepEqual(exp.blocks.slice(0, 4), [
    "hero",
    "upcoming_events",
    "near_you",
    "category_favorites",
  ]);
  assert.equal(exp.canSwitchMode, false);
}

// 3. Solo PHOTOGRAPHER — convocatorias primero
{
  const exp = resolveHomeExperience({ activeProfiles: ["PHOTOGRAPHER"] });
  assert.equal(exp.mode, "PHOTOGRAPHER");
  assert.deepEqual(exp.blocks.slice(0, 3), [
    "hero",
    "photographer_calls",
    "coverages",
  ]);
}

// 4. Solo ORGANIZER — publicar / pitch primero
{
  const exp = resolveHomeExperience({ activeProfiles: ["ORGANIZER"] });
  assert.equal(exp.mode, "ORGANIZER");
  assert.ok(exp.blocks.indexOf("organizer_pitch") < exp.blocks.indexOf("news"));
  assert.equal(exp.headerPrimaryCta?.label, "Publicar evento");
}

// 5. Multi-perfil: prioridad default ORGANIZER > PHOTOGRAPHER > CUSTOMER
{
  assert.deepEqual(HOME_MODE_DEFAULT_PRIORITY, [
    "ORGANIZER",
    "PHOTOGRAPHER",
    "CUSTOMER",
  ]);
  assert.equal(
    pickDefaultHomeMode(["CUSTOMER", "PHOTOGRAPHER", "ORGANIZER"]),
    "ORGANIZER",
  );
  assert.equal(pickDefaultHomeMode(["CUSTOMER", "PHOTOGRAPHER"]), "PHOTOGRAPHER");
}

// 6. Cookie válida gana sobre default
{
  const exp = resolveHomeExperience({
    activeProfiles: ["CUSTOMER", "PHOTOGRAPHER", "ORGANIZER"],
    preferredMode: "CUSTOMER",
  });
  assert.equal(exp.mode, "CUSTOMER");
  assert.equal(exp.canSwitchMode, true);
  assert.deepEqual(exp.availableModes, [
    "ORGANIZER",
    "PHOTOGRAPHER",
    "CUSTOMER",
  ]);
}

// 7. Cookie inválida / perfil no activo se ignora
{
  const exp = resolveHomeExperience({
    activeProfiles: ["CUSTOMER"],
    preferredMode: "ORGANIZER",
  });
  assert.equal(exp.mode, "CUSTOMER");
  assert.equal(parseHomeExperienceCookie("photographer"), "PHOTOGRAPHER");
  assert.equal(parseHomeExperienceCookie("hacker"), null);
  assert.equal(parseHomeExperienceCookie(""), null);
}

// 8. Header no expone redacción
{
  for (const mode of ["GUEST", "CUSTOMER", "PHOTOGRAPHER", "ORGANIZER"] as const) {
    const exp = resolveHomeExperience({
      activeProfiles: mode === "GUEST" ? [] : [mode],
    });
    const hrefs = [
      exp.headerPrimaryCta?.href,
      ...exp.headerSecondaryLinks.map((l) => l.href),
    ].filter(Boolean);
    assert.ok(!hrefs.some((h) => h?.startsWith("/redaccion")));
    assert.ok(!hrefs.some((h) => h?.startsWith("/admin")));
  }
}

console.log("home-experience tests: ok");
