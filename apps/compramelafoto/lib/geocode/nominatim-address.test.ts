/**
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/geocode/nominatim-address.test.ts
 */

import assert from "node:assert/strict";
import {
  extractCityFromNominatimAddress,
  mapNominatimSearchResults,
  normalizeGeocodeQuery,
  parseLatLon,
} from "./nominatim-address";

{
  const city = extractCityFromNominatimAddress({
    tourism: "Monumento Histórico Nacional a la Bandera",
    house_number: "581",
    road: "Santa Fe",
    suburb: "Rosario Centro",
    city: "Rosario",
    state: "Santa Fe",
    country: "Argentina",
  });
  assert.equal(city, "Rosario");
}

{
  assert.equal(
    extractCityFromNominatimAddress({ house_number: "581", road: "Santa Fe" }),
    ""
  );
}

{
  assert.equal(
    extractCityFromNominatimAddress({
      town: "Villa General Belgrano",
      state: "Córdoba",
    }),
    "Villa General Belgrano"
  );
}

{
  assert.equal(normalizeGeocodeQuery("ab"), null);
  assert.equal(normalizeGeocodeQuery("  rosario  "), "rosario");
  assert.equal(normalizeGeocodeQuery(null), null);
  const long = "x".repeat(250);
  assert.equal(normalizeGeocodeQuery(long)?.length, 200);
}

{
  assert.equal(parseLatLon("abc", "1").ok, false);
  assert.equal(parseLatLon("91", "0").ok, false);
  assert.equal(parseLatLon("-34.6", "-58.4").ok, true);
  const ok = parseLatLon("-34.6", "-58.4");
  if (ok.ok) {
    assert.equal(ok.lat, -34.6);
    assert.equal(ok.lon, -58.4);
  }
}

{
  const mapped = mapNominatimSearchResults([
    {
      lat: "-34.6",
      lon: "-58.4",
      display_name: "Buenos Aires, Argentina",
      address: { city: "Buenos Aires", country: "Argentina" },
    },
  ]);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0]?.city, "Buenos Aires");
  assert.equal(mapped[0]?.displayName, "Buenos Aires, Argentina");
  assert.equal(typeof mapped[0]?.lat, "number");
  assert.ok(!("osm_id" in (mapped[0] as object)));
}

console.log("nominatim-address.test.ts OK");
