/**
 * Tests geolocalización Info Spot.
 * pnpm --filter infospot test:geolocation
 */

import assert from "node:assert/strict";
import {
  validateCoordinates,
  hasUsableEventCoordinates,
  encodeGeohash,
  distanceBetweenCoordinates,
  isWithinRadius,
  buildBoundingBox,
  buildPublicEventLocation,
  isEventLocationPublishReady,
  applyInboundGeolocation,
  clearGeocodeCache,
  geocodeCacheKey,
  getCachedGeocode,
  setCachedGeocode,
  ManualGeocodingProvider,
} from "./index";
import { buildEventPublishChecklist, checklistWarnings } from "../launch-content";
import { validateEventForPublish } from "../editorial/event-adapter";

async function main() {
  assert.equal(validateCoordinates(-32.9, -60.6).ok, true);
  assert.equal(validateCoordinates(91, 0).ok, false);
  assert.equal(validateCoordinates(0, 181).ok, false);
  assert.equal(validateCoordinates(0, 0).ok, false);
  assert.equal(hasUsableEventCoordinates(0, 0), false);

  const base = {
    title: "Maratón Rosario",
    description: "Descripción suficientemente larga del evento deportivo anual.",
    organizerName: "Club",
    startAt: new Date(),
    city: "Rosario",
    province: "Santa Fe",
    slug: "maraton-rosario",
    contentTag: "REAL" as const,
  };
  assert.ok(
    checklistWarnings(buildEventPublishChecklist(base)).some((x) =>
      x.includes("Georreferenciación"),
    ),
  );
  assert.ok(validateEventForPublish(base)?.includes("Georreferenciación"));
  assert.ok(
    validateEventForPublish({
      ...base,
      latitude: -32.9,
      longitude: -60.6,
    }),
  );
  assert.equal(
    validateEventForPublish({
      ...base,
      latitude: -32.9,
      longitude: -60.6,
      locationConfirmedAt: new Date(),
      geocodingStatus: "CONFIRMED",
    }),
    null,
  );
  assert.equal(
    isEventLocationPublishReady({
      ...base,
      latitude: -32.9,
      longitude: -60.6,
      locationConfirmedAt: new Date(),
    }).ready,
    true,
  );

  const withGeo = applyInboundGeolocation(
    {
      locationOverridden: false,
      coordinatesOverridden: false,
      city: "A",
      province: "A confirmar",
      address: null,
      venueName: null,
      latitude: null,
      longitude: null,
      geocodingStatus: "PENDING",
      locationConfirmedAt: null,
    },
    {
      city: "Rosario",
      province: "Santa Fe",
      address: null,
      venueName: "Parque",
      latitude: -32.9,
      longitude: -60.6,
      missingGeoref: false,
    },
  );
  assert.equal(withGeo.data.geocodingStatus, "GEOCODED");

  const noGeo = applyInboundGeolocation(
    {
      locationOverridden: false,
      coordinatesOverridden: false,
      city: "Rosario",
      province: "Santa Fe",
      address: null,
      venueName: null,
      latitude: null,
      longitude: null,
      geocodingStatus: "PENDING",
      locationConfirmedAt: null,
    },
    {
      city: "Rosario",
      province: "Santa Fe",
      address: null,
      venueName: null,
      latitude: null,
      longitude: null,
      missingGeoref: true,
    },
  );
  assert.equal(noGeo.data.geocodingStatus, "NEEDS_REVIEW");

  const overridden = applyInboundGeolocation(
    {
      locationOverridden: true,
      coordinatesOverridden: true,
      city: "Editorial City",
      province: "Santa Fe",
      address: "Calle 1",
      venueName: "Venue",
      latitude: -32.94,
      longitude: -60.65,
      geocodingStatus: "CONFIRMED",
      locationConfirmedAt: new Date(),
    },
    {
      city: "CLF City",
      province: "Buenos Aires",
      address: null,
      venueName: "Other",
      latitude: -34.6,
      longitude: -58.4,
      missingGeoref: false,
    },
  );
  assert.equal(overridden.data.latitude, undefined);
  assert.ok(overridden.skipped.includes("coordinates overridden"));

  const baseLoc = {
    city: "Rosario",
    province: "Santa Fe",
    venueName: "Monumento",
    address: "Av. Pellegrini 1234",
    latitude: -32.94,
    longitude: -60.65,
  };
  assert.ok(buildPublicEventLocation({ ...baseLoc, locationVisibility: "EXACT" }).showExactAddress);
  assert.equal(
    buildPublicEventLocation({ ...baseLoc, locationVisibility: "APPROXIMATE" }).showCoordinates,
    false,
  );
  assert.equal(
    buildPublicEventLocation({ ...baseLoc, locationVisibility: "CITY_ONLY" }).venueName,
    null,
  );
  assert.equal(
    buildPublicEventLocation({ ...baseLoc, locationVisibility: "HIDDEN" }).showCoordinates,
    false,
  );

  const gh = encodeGeohash(-32.9442, -60.6505, 7);
  assert.equal(gh.length, 7);

  const ba = { latitude: -34.6037, longitude: -58.3816 };
  const ro = { latitude: -32.9442, longitude: -60.6505 };
  const km = distanceBetweenCoordinates(ba, ro);
  assert.ok(km > 250 && km < 350, `dist=${km}`);
  assert.equal(isWithinRadius(ba, ro, 100), false);
  assert.equal(isWithinRadius(ba, ro, 400), true);
  const box = buildBoundingBox(ba, 50);
  assert.ok(box.minLat < ba.latitude);

  const provider = new ManualGeocodingProvider();
  const rev = await provider.reverse(-32.9, -60.6);
  assert.ok(rev);
  assert.equal(rev!.provider, "manual");

  clearGeocodeCache();
  const key = geocodeCacheKey("search", ["plaza", "ar"]);
  setCachedGeocode(key, [{ ok: true }]);
  assert.deepEqual(getCachedGeocode(key), [{ ok: true }]);

  console.log("geolocation tests: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
