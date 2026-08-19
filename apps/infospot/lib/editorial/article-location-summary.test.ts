/**
 * Resumen de ubicación para el panel lateral (rediseño editor de noticias).
 * pnpm --filter infospot test:article-location-summary
 */

import assert from "node:assert/strict";
import { articleLocationSummary } from "./article-location";

// --- Sin alcance elegido: pendiente ---
{
  const empty = articleLocationSummary({
    geographicScope: "",
    city: "",
    province: "",
    placeName: "",
  });
  assert.equal(empty, "Sin definir");
}

// --- Alcance "sin ubicación específica" ---
{
  const unspecified = articleLocationSummary({
    geographicScope: "UNSPECIFIED",
    city: "",
    province: "",
    placeName: "",
  });
  assert.equal(unspecified, "Sin ubicación específica");
}

// --- Ciudad + provincia: caso más común ---
{
  const withCityProvince = articleLocationSummary({
    geographicScope: "LOCAL",
    city: "Rosario",
    province: "Santa Fe",
    placeName: "",
  });
  assert.equal(withCityProvince, "Rosario, Santa Fe");
}

// --- Solo ciudad (sin provincia) ---
{
  const cityOnly = articleLocationSummary({
    geographicScope: "LOCAL",
    city: "Rosario",
    province: "",
    placeName: "",
  });
  assert.equal(cityOnly, "Rosario");
}

// --- Sin ciudad/provincia pero con lugar ---
{
  const placeOnly = articleLocationSummary({
    geographicScope: "LOCAL",
    city: "",
    province: "",
    placeName: "Estadio Gigante de Arroyito",
  });
  assert.equal(placeOnly, "Estadio Gigante de Arroyito");
}

// --- Alcance elegido sin ningún dato geográfico todavía: cae al label del alcance ---
{
  const scopeOnly = articleLocationSummary({
    geographicScope: "NATIONAL",
    city: "",
    province: "",
    placeName: "",
  });
  assert.ok(scopeOnly.length > 0);
  assert.notEqual(scopeOnly, "Sin definir");
}

console.log("article-location-summary tests: ok");
