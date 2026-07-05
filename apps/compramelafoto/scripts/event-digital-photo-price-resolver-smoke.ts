/**
 * Smoke tests manuales del resolver de precios digitales por evento (Paso 13A).
 *
 * Ejecutar: npx tsx scripts/event-digital-photo-price-resolver-smoke.ts
 */

import { EventPhotoPricingMode } from "@prisma/client";
import { resolveEventDigitalPhotoBasePrice } from "@/lib/pricing/event-digital-photo-price-resolver";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok — ${name}`);
}

check("sin evento mantiene precio legacy", () => {
  const r = resolveEventDigitalPhotoBasePrice({
    currentResolvedBasePrice: 7200,
  });
  assert(r.basePrice === 7200, "precio");
  assert(r.appliedRule === "CURRENT_BEHAVIOR", "rule");
  assert(!r.didOverrideCurrentPrice, "override");
});

check("photographer decides", () => {
  const r = resolveEventDigitalPhotoBasePrice({
    currentResolvedBasePrice: 1000,
    event: {
      photoPricingMode: EventPhotoPricingMode.PHOTOGRAPHER_DECIDES,
    },
  });
  assert(r.basePrice === 1000, "precio");
  assert(r.appliedRule === "PHOTOGRAPHER_DECIDES", "rule");
});

check("fixed organizador puede bajar/subir vs legacy", () => {
  let r = resolveEventDigitalPhotoBasePrice({
    currentResolvedBasePrice: 5000,
    event: {
      photoPricingMode: EventPhotoPricingMode.ORGANIZER_FIXED,
      fixedPhotoPrice: 4200,
    },
  });
  assert(r.basePrice === 4200 && r.didOverrideCurrentPrice, "fixed difiere ↑/↓");

  r = resolveEventDigitalPhotoBasePrice({
    currentResolvedBasePrice: 4200,
    event: {
      photoPricingMode: EventPhotoPricingMode.ORGANIZER_FIXED,
      fixedPhotoPrice: 4200,
    },
  });
  assert(!r.didOverrideCurrentPrice, "igual no override");
});

check("minimum sube sólo cuando hace falta", () => {
  let r = resolveEventDigitalPhotoBasePrice({
    currentResolvedBasePrice: 9000,
    event: {
      photoPricingMode: EventPhotoPricingMode.ORGANIZER_MINIMUM,
      minimumPhotoPrice: 3000,
    },
  });
  assert(r.basePrice === 9000 && !r.didOverrideCurrentPrice, "ya sobre el mínimo");

  r = resolveEventDigitalPhotoBasePrice({
    currentResolvedBasePrice: 1100,
    event: {
      photoPricingMode: EventPhotoPricingMode.ORGANIZER_MINIMUM,
      minimumPhotoPrice: 8500,
    },
  });
  assert(r.basePrice === 8500 && r.didOverrideCurrentPrice, "sube por mínimo");
});

check("fixed inválido cae en legacy CURRENT_BEHAVIOR", () => {
  const r = resolveEventDigitalPhotoBasePrice({
    currentResolvedBasePrice: 333,
    event: {
      photoPricingMode: EventPhotoPricingMode.ORGANIZER_FIXED,
      fixedPhotoPrice: null,
    },
  });
  assert(r.basePrice === 333, "fallback precio");
  assert(r.appliedRule === "CURRENT_BEHAVIOR", "fallback rule");
  assert(r.reason.includes("invalid_event_pricing_config"), "reason code");
});

check("inferencia auditoría álbum coincide con legacy price", () => {
  const r = resolveEventDigitalPhotoBasePrice({
    currentResolvedBasePrice: 6000,
    album: { digitalPhotoPriceCents: 6000 },
    event: {
      photoPricingMode: EventPhotoPricingMode.PHOTOGRAPHER_DECIDES,
    },
  });
  assert(r.source === "album", "source album audit");
});

check("global minimum opcional después de reglas organizer", () => {
  const r = resolveEventDigitalPhotoBasePrice({
    currentResolvedBasePrice: 100,
    event: {
      photoPricingMode: EventPhotoPricingMode.ORGANIZER_FIXED,
      fixedPhotoPrice: 500,
    },
    globalMinimumPrice: 800,
  });
  assert(r.basePrice === 800 && r.source === "global_minimum", "global sobrepuesto");
});

console.log(`\nTodos los chequeos pasaron (${passed}).`);
