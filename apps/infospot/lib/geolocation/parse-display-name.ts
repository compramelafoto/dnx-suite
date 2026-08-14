/**
 * Parseo puro de display_name (Nominatim / OSM) — usable en cliente y servidor.
 */

const AR_PROVINCES = [
  "Buenos Aires",
  "Ciudad Autónoma de Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

export function cleanMunicipalityLabel(value: string): string {
  return value
    .replace(/^(municipio|departamento|partido|comuna)\s+de\s+/i, "")
    .replace(/^ciudad\s+de\s+/i, "")
    .trim();
}

/**
 * Fallback cuando Nominatim no trae addressdetails útiles:
 * parsea "Lugar, …, Ciudad, …, Provincia, CP, País".
 */
export function parseDisplayNameFallback(displayName: string): {
  venueName: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  address: string | null;
} {
  const parts = displayName
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return {
      venueName: null,
      city: null,
      province: null,
      postalCode: null,
      address: null,
    };
  }

  const withoutCountry = parts.filter(
    (p) => !/^argentina$/i.test(p) && !/^ar$/i.test(p),
  );

  let postalCode: string | null = null;
  const withoutPostal = withoutCountry.filter((p) => {
    if (/^[A-Z]?\d{4}([A-Z]{3})?$/i.test(p) || /^[A-Z]\d{4}$/i.test(p)) {
      postalCode = p.toUpperCase();
      return false;
    }
    return true;
  });

  let province: string | null = null;
  const withoutProvince = withoutPostal.filter((p) => {
    const match = AR_PROVINCES.find(
      (prov) => prov.toLowerCase() === p.toLowerCase(),
    );
    if (match) {
      province = match;
      return false;
    }
    return true;
  });

  const withoutMeta = withoutProvince.filter(
    (p) =>
      !/^(gran|municipio|departamento|distrito|partido)\b/i.test(p) &&
      !/^iso3166/i.test(p),
  );

  const venueName = withoutMeta[0] || parts[0] || null;

  let city: string | null = null;
  for (let i = withoutMeta.length - 1; i >= 1; i--) {
    const candidate = cleanMunicipalityLabel(withoutMeta[i]!);
    if (!candidate) continue;
    if (/^(calle|av\.?|avenida|ruta|rp|rn)\b/i.test(candidate)) continue;
    city = candidate;
    break;
  }

  const roadLike = withoutMeta.find((p) =>
    /^(calle|av\.?|avenida|ruta|rp|rn)\b/i.test(p),
  );

  return {
    venueName,
    city,
    province,
    postalCode,
    address: roadLike || null,
  };
}
