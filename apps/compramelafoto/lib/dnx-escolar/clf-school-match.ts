/**
 * Cruce de un prospecto contra los colegios cargados en CLF (`School`). No hay CUE en la base:
 * se compara por email, teléfono, domicilio + localidad y, como respaldo, nombre + localidad.
 * Un nombre genérico (San José, Nuestra Señora de Luján...) sólo con la localidad NO alcanza:
 * queda como posible coincidencia, nunca como inequívoca.
 */

export type ClfSchoolRow = {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export type ProspectForMatch = {
  institutionName: string;
  locality: string;
  addresses: string[];
  emails: string[];
  phones: string[];
};

export type MatchResult = { kind: "inequivoca" | "posible"; schoolId: number; reason: string };

const PREFIXES =
  /\b(colegio|escuela|instituto|jardin( de infantes)?|liceo|complejo educativo|nueva escuela|particular incorporad[oa]|n[ºo°]\.?\s*\d+|\d{3,5})\b/g;
const GENERIC_NAMES = new Set([
  "san jose",
  "nuestra senora de lujan",
  "san martin",
  "santa rosa",
  "san francisco",
  "sagrado corazon",
  "maria auxiliadora",
  "la salle",
  "san antonio",
]);

export function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ntra\.?\s*sra\.?/g, "nuestra senora")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSchoolName(value: string | null | undefined): string {
  return normalizeText(value).replace(PREFIXES, " ").replace(/\s+/g, " ").trim();
}

/**
 * Última palabra de la calle + altura: "SALTA 2763", "2763 Salta, Rosario" → "salta 2763";
 * "H. Yrigoyen 3602" y "3602 Hipólito Yrigoyen" → "yrigoyen 3602". La altura es el último
 * número (en "Regimiento 11 Nº 1527" el 11 es parte de la calle).
 */
export function addressKey(value: string | null | undefined): string | null {
  const firstPart = String(value ?? "").split(/[,/]/)[0] ?? "";
  const text = normalizeText(firstPart);
  const numbers = text.match(/\b\d{2,5}\b/g);
  if (!numbers) return null;
  const number = numbers.length > 1 && /^\d{2,5}\s/.test(text) ? numbers[0] : numbers[numbers.length - 1];
  const words = text
    .replace(new RegExp(`\\b${number}\\b`), " ")
    .replace(/\b(avenida|avda|av|bulevar|bv|bvard|calle|bis|pje|pasaje|n|nro|confirmar)\b/g, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  const street = words[words.length - 1];
  return street ? `${street} ${number}` : null;
}

const STOPWORDS = new Set(["de", "del", "la", "las", "los", "el", "y", "san", "santa", "santo"]);

function significantTokens(name: string): string[] {
  return name.split(" ").filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Iguales, o todas las palabras significativas del nombre corto están en el largo y son al
 * menos dos. Así «Rosario» no coincide con «Nuestra Señora del Rosario».
 */
export function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const shortTokens = significantTokens(short);
  if (shortTokens.length < 2) return false;
  const longTokens = new Set(significantTokens(long));
  return shortTokens.every((t) => longTokens.has(t));
}

function phoneTail(value: string | null | undefined): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-7) : null;
}

function sameLocality(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeText(a).replace(/^municipio de /, "");
  const nb = normalizeText(b).replace(/^municipio de /, "");
  return Boolean(na) && na === nb;
}

export function matchProspectToClf(prospect: ProspectForMatch, schools: ClfSchoolRow[]): MatchResult | null {
  const emails = new Set(prospect.emails.map((e) => e.trim().toLowerCase()).filter(Boolean));
  const phones = new Set(prospect.phones.map(phoneTail).filter((p): p is string => Boolean(p)));
  const addresses = new Set(prospect.addresses.map(addressKey).filter((a): a is string => Boolean(a)));
  const name = normalizeSchoolName(prospect.institutionName);
  let possible: MatchResult | null = null;

  for (const school of schools) {
    const schoolEmail = school.contactEmail?.trim().toLowerCase();
    if (schoolEmail && emails.has(schoolEmail)) {
      return { kind: "inequivoca", schoolId: school.id, reason: "mismo email" };
    }
    const tail = phoneTail(school.contactPhone);
    if (tail && phones.has(tail)) {
      return { kind: "inequivoca", schoolId: school.id, reason: "mismo teléfono" };
    }
    const addr = addressKey(school.address);
    if (addr && addresses.has(addr) && (sameLocality(school.city, prospect.locality) || !school.city)) {
      return { kind: "inequivoca", schoolId: school.id, reason: "mismo domicilio y localidad" };
    }
    const schoolName = normalizeSchoolName(school.name);
    if (!name || !schoolName) continue;
    if (!namesMatch(name, schoolName)) continue;
    if (sameLocality(school.city, prospect.locality)) {
      possible ??= {
        kind: "posible",
        schoolId: school.id,
        reason: GENERIC_NAMES.has(name) ? "nombre genérico y misma localidad" : "mismo nombre y localidad, sin domicilio",
      };
    } else if (!school.city) {
      possible ??= { kind: "posible", schoolId: school.id, reason: "mismo nombre, sin localidad en CLF" };
    }
  }
  return possible;
}
