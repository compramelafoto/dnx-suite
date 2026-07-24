import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateDistanceKm,
  distanceKm,
  haversineDistanceMeters,
  isWithinRadius,
  buildBoundingBox,
  formatDistanceLabel,
  validateCoordinates,
  encodeGeohash,
  geohashPrefixForRadiusKm,
  geohashSharesPrefix,
  normalizePlaceToken,
  placesMatch,
  validateLocationForPublish,
  rankGeoItems,
  planNearbyQuery,
  filterNearbyInMemory,
} from "./index";
import {
  infoSpotArticleToLocation,
  infoSpotArticleToFeedItem,
} from "./adapters/infospot";
import { clfEventToFeedItem } from "./adapters/compramelafoto";
import { clickatonVenueToLocation } from "./adapters/clickaton";
import { fotorankToLocation } from "./adapters/fotorank";
import { fotofficeToLocation } from "./adapters/fotoffice";

describe("distance", () => {
  it("haversine Rosario–BsAs ~280–320 km", () => {
    const km = distanceKm(
      { latitude: -32.9442, longitude: -60.6505 },
      { latitude: -34.6037, longitude: -58.3816 },
    );
    assert.ok(km > 270 && km < 330);
  });

  it("aliases coinciden", () => {
    const a = calculateDistanceKm(-32.9, -60.6, -32.91, -60.61);
    const b = haversineDistanceMeters(-32.9, -60.6, -32.91, -60.61) / 1000;
    assert.ok(Math.abs(a - b) < 0.05);
  });

  it("isWithinRadius + bounding box", () => {
    const origin = { latitude: -32.94, longitude: -60.65 };
    const near = { latitude: -32.95, longitude: -60.66 };
    assert.equal(isWithinRadius(origin, near, 20), true);
    const box = buildBoundingBox(origin, 10);
    assert.ok(box.minLat < origin.latitude && box.maxLat > origin.latitude);
  });

  it("formatDistanceLabel", () => {
    assert.equal(formatDistanceLabel(0.4), "A menos de 1 km");
    assert.ok(formatDistanceLabel(3.2)?.includes("km"));
  });
});

describe("coordinates", () => {
  it("rechaza 0,0 y fuera de rango", () => {
    assert.equal(validateCoordinates(0, 0).ok, false);
    assert.equal(validateCoordinates(91, 0).ok, false);
    assert.equal(validateCoordinates(-32.9, -60.6).ok, true);
  });
});

describe("geohash", () => {
  it("encode estable y prefijos", () => {
    const h = encodeGeohash(-32.9442, -60.6505, 7);
    assert.equal(h.length, 7);
    assert.equal(geohashPrefixForRadiusKm(2), 6);
    assert.equal(geohashSharesPrefix(h, h.slice(0, 5) + "xx", 5), true);
  });
});

describe("normalize", () => {
  it("tokens y match", () => {
    assert.equal(normalizePlaceToken("  Rosario  "), "rosario");
    assert.equal(placesMatch("Santa Fe", "santa fe"), true);
  });
});

describe("location publish rules", () => {
  it("local exige coords; nacional país; unspecified ok", () => {
    assert.ok(
      validateLocationForPublish({
        geographicScope: "LOCAL",
        countryName: "AR",
        provinceName: "SF",
        cityName: "Rosario",
      }).length > 0,
    );
    assert.equal(
      validateLocationForPublish({
        geographicScope: "NATIONAL",
        countryName: "Argentina",
      }).length,
      0,
    );
    assert.equal(
      validateLocationForPublish({ geographicScope: "UNSPECIFIED" }).length,
      0,
    );
  });
});

describe("ranking", () => {
  it("prioriza cercanos con mismos pesos", () => {
    const origin = { latitude: -32.94, longitude: -60.65 };
    const ranked = rankGeoItems(
      [
        {
          id: "far",
          latitude: -34.6,
          longitude: -58.4,
          publishedAt: new Date(),
          priority: 50,
        },
        {
          id: "near",
          latitude: -32.95,
          longitude: -60.66,
          publishedAt: new Date(),
          priority: 50,
        },
      ],
      origin,
    );
    assert.equal(ranked[0]?.item.id, "near");
    assert.ok((ranked[0]?.distanceKm ?? 99) < (ranked[1]?.distanceKm ?? 0));
  });
});

describe("nearby", () => {
  it("plan + filtro en memoria", () => {
    const origin = { latitude: -32.94, longitude: -60.65 };
    const plan = planNearbyQuery(origin, 15);
    assert.ok(plan.geohashPrefix.length >= 4);
    const matches = filterNearbyInMemory(
      [
        { id: "1", latitude: -32.95, longitude: -60.66 },
        { id: "2", latitude: -34.6, longitude: -58.4 },
      ],
      origin,
      20,
    );
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.item.id, "1");
  });
});

describe("adapters", () => {
  it("InfoSpot / CLF / Clickatón / stubs", () => {
    const loc = infoSpotArticleToLocation({
      id: "a1",
      title: "Nota",
      slug: "nota",
      geographicScope: "LOCAL",
      city: "Rosario",
      province: "Santa Fe",
      countryName: "Argentina",
      latitude: -32.94,
      longitude: -60.65,
    });
    assert.equal(loc.cityName, "Rosario");
    assert.ok(loc.geohash);

    const feed = infoSpotArticleToFeedItem({
      id: "a1",
      title: "Nota",
      slug: "nota",
      latitude: -32.94,
      longitude: -60.65,
    });
    assert.equal(feed.source, "INFOSPOT_ARTICLE");

    const clf = clfEventToFeedItem({
      id: 9,
      title: "Evento",
      shareSlug: "abc",
      city: "Rosario",
      latitude: -32.9,
      longitude: -60.6,
    });
    assert.equal(clf.source, "CLF_EVENT");

    const venue = clickatonVenueToLocation({
      id: 1,
      name: "Sede",
      city: "Córdoba",
    });
    assert.equal(venue.geographicScope, "PROVINCIAL");

    assert.equal(fotorankToLocation({ id: 1, title: "C" }).geographicScope, "UNSPECIFIED");
    assert.equal(
      fotofficeToLocation({ id: 1, name: "Estudio", city: "Mendoza" }).geographicScope,
      "PROVINCIAL",
    );
  });
});
