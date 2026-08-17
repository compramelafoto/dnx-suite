/**
 * Regresión: pérdida de contenido / geolocalización / portada al volver de
 * Vista previa (reporte de redacción, 2026-08). Causa raíz cubierta acá:
 * un autosave con campos ausentes o vacíos (payload atrasado, hidratación
 * incompleta) no debe interpretarse como una eliminación intencional.
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/editorial/article-autosave-guards.test.ts
 */

import assert from "node:assert/strict";
import {
  resolveAutosaveCategoryId,
  resolveAutosaveContent,
  resolveAutosaveCoverImageId,
  resolveLocationPresentKeys,
  type ExistingLocationForGuard,
} from "./article-autosave-guards";

const fullLocation: ExistingLocationForGuard = {
  geographicScope: "LOCAL",
  countryCode: "AR",
  countryName: "Argentina",
  province: "Santa Fe",
  city: "Rosario",
  placeName: "Estadio Gigante",
  address: "Génova 640",
  formattedAddress: "Génova 640, Rosario, Santa Fe, Argentina",
  latitude: -32.94,
  longitude: -60.65,
};

const emptyLocation: ExistingLocationForGuard = {
  geographicScope: null,
  countryCode: null,
  countryName: null,
  province: null,
  city: null,
  placeName: null,
  address: null,
  formattedAddress: null,
  latitude: null,
  longitude: null,
};

// --- 1. Contenido: un guardado con cuerpo real persiste ese cuerpo ---
{
  const body = "Un cuerpo real de más de cuarenta caracteres para la nota.";
  assert.equal(resolveAutosaveContent(body, ""), body);
  assert.equal(resolveAutosaveContent(body, "Cuerpo viejo"), body);
}

// --- 2. Contenido: un payload vacío NUNCA borra un cuerpo ya persistido ---
// (Antes del fix esto solo se protegía si el cuerpo existente tenía más de
// 40 caracteres — un borrador corto seguía expuesto al vaciado.)
{
  assert.equal(
    resolveAutosaveContent("", "Corto"),
    "Corto",
    "un cuerpo corto también debe preservarse",
  );
  assert.equal(
    resolveAutosaveContent("   ", "Cuerpo persistido con contenido real."),
    "Cuerpo persistido con contenido real.",
  );
}

// --- 3. Contenido: si nunca hubo nada guardado, un payload vacío persiste vacío ---
{
  assert.equal(resolveAutosaveContent("", ""), "");
  assert.equal(resolveAutosaveContent("", null), "");
}

// --- 4. Portada: coverImageId ausente conserva la portada ya persistida ---
{
  assert.equal(resolveAutosaveCoverImageId(null, "asset-1", false), "asset-1");
  assert.equal(resolveAutosaveCoverImageId("", "asset-1", false), "asset-1");
}

// --- 5. Portada: coverImageId nuevo reemplaza al anterior ---
{
  assert.equal(resolveAutosaveCoverImageId("asset-2", "asset-1", false), "asset-2");
}

// --- 6. Portada: "Eliminar portada" (eliminación explícita) sí borra ---
{
  assert.equal(resolveAutosaveCoverImageId(null, "asset-1", true), null);
  assert.equal(resolveAutosaveCoverImageId("", "asset-1", true), null);
}

// --- 7. Portada: sin portada previa y sin selección, se mantiene null ---
{
  assert.equal(resolveAutosaveCoverImageId(null, null, false), null);
}

// --- 8. Categoría: ausente conserva la ya elegida ---
{
  assert.equal(resolveAutosaveCategoryId(null, "cat-1"), "cat-1");
  assert.equal(resolveAutosaveCategoryId("", "cat-1"), "cat-1");
  assert.equal(resolveAutosaveCategoryId("cat-2", "cat-1"), "cat-2");
}

// --- 9. Ubicación: alcance inválido/vacío en un autosave stale no borra el alcance ---
{
  const raw = { geographicScope: "" };
  const present = resolveLocationPresentKeys(raw, fullLocation, false);
  assert.equal(present.has("geographicScope"), false);
}

// --- 10. Ubicación: ciudad, provincia, dirección y coordenadas vacías en el
// payload NO deben borrar los valores ya persistidos (gap real: antes del
// fix solo geographicScope estaba protegido, el resto se pisaba siempre) ---
{
  const raw = {
    geographicScope: "LOCAL",
    countryCode: "",
    countryName: "",
    province: "",
    city: "",
    placeName: "",
    address: "",
    formattedAddress: "",
    latitude: "",
    longitude: "",
  };
  const present = resolveLocationPresentKeys(raw, fullLocation, false);
  for (const key of [
    "countryCode",
    "countryName",
    "province",
    "city",
    "placeName",
    "address",
    "formattedAddress",
    "latitude",
    "longitude",
  ]) {
    assert.equal(present.has(key), false, `${key} no debería sobrescribirse con vacío`);
  }
  // El alcance sí llegó como válido: se escribe.
  assert.equal(present.has("geographicScope"), true);
}

// --- 11. Ubicación: actualizar solo la ciudad no debe tocar el resto ---
{
  const raw = {
    geographicScope: "LOCAL",
    countryCode: "AR",
    countryName: "Argentina",
    province: "Santa Fe",
    city: "Funes",
    placeName: "Estadio Gigante",
    address: "Génova 640",
    formattedAddress: "Génova 640, Rosario, Santa Fe, Argentina",
    latitude: "-32.94",
    longitude: "-60.65",
  };
  const present = resolveLocationPresentKeys(raw, fullLocation, false);
  assert.equal(present.has("city"), true);
  assert.equal(present.has("province"), true);
}

// --- 12. Ubicación: "Limpiar ubicación" (eliminación explícita) sí borra todo ---
{
  const raw = {
    geographicScope: "",
    countryCode: "",
    countryName: "",
    province: "",
    city: "",
    placeName: "",
    address: "",
    formattedAddress: "",
    latitude: "",
    longitude: "",
  };
  const present = resolveLocationPresentKeys(raw, fullLocation, true);
  for (const key of [
    "geographicScope",
    "countryCode",
    "countryName",
    "province",
    "city",
    "placeName",
    "address",
    "formattedAddress",
    "latitude",
    "longitude",
  ]) {
    assert.equal(present.has(key), true, `${key} debe incluirse al limpiar explícitamente`);
  }
}

// --- 13. Ubicación: cargar el editor sin datos todavía hidratados (nota sin
// ubicación previa) no debe fallar ni inventar valores ---
{
  const raw = { geographicScope: "" };
  const present = resolveLocationPresentKeys(raw, emptyLocation, false);
  // No hay nada que preservar; el campo vacío se escribe tal cual (queda null).
  assert.equal(present.has("geographicScope"), true);
}

// --- 14. Contenido: sin señal explícita, vaciar el cuerpo NO se persiste
// (evita que un payload accidentalmente vacío borre contenido real) ---
{
  assert.equal(
    resolveAutosaveContent("", "Cuerpo persistido con contenido real.", false),
    "Cuerpo persistido con contenido real.",
  );
}

// --- 15. Contenido: con contentCleared explícito, vaciar el cuerpo SÍ se persiste
// (eliminación deliberada — el redactor lo vació y guardó así a propósito) ---
{
  assert.equal(
    resolveAutosaveContent("", "Cuerpo persistido con contenido real.", true),
    "",
  );
}

// --- 16. Precedencia / payloads contradictorios: un valor nuevo real siempre
// gana sobre una señal de eliminación desactualizada — nunca se descarta
// silenciosamente una edición real por una bandera "cleared" residual. ---
{
  // Portada nueva + coverImageCleared="1" simultáneos: gana la portada nueva.
  assert.equal(resolveAutosaveCoverImageId("asset-nuevo", "asset-1", true), "asset-nuevo");

  // Contenido nuevo + contentCleared="1" simultáneos: gana el contenido nuevo.
  assert.equal(
    resolveAutosaveContent("Texto nuevo real.", "Texto viejo.", true),
    "Texto nuevo real.",
  );

  // Ubicación: locationCleared="1" pero con una ciudad nueva no vacía en el
  // mismo payload — la ciudad nueva se escribe (progresión coherente:
  // "empecé de nuevo y ya cargué la ciudad"), los campos que siguen vacíos
  // quedan nulos porque locationCleared desactiva la preservación.
  {
    const raw = {
      geographicScope: "",
      countryCode: "AR",
      countryName: "Argentina",
      province: "",
      city: "Funes",
      placeName: "",
      address: "",
      formattedAddress: "",
      latitude: "",
      longitude: "",
    };
    const present = resolveLocationPresentKeys(raw, fullLocation, true);
    assert.equal(present.has("city"), true, "la ciudad nueva no debe descartarse");
    assert.equal(present.has("province"), true, "cleared desactiva la preservación del resto");
  }
}

console.log("article-autosave-guards tests: ok");
