import { etiquetaEspecialidad } from "@/lib/membership/specialties";

/**
 * Los datos de un socio, tal como los pide una placa.
 *
 * Módulo puro —sin base ni red— para poder probar cada regla sin levantar nada: de dónde sale
 * la zona, qué foto se usa, cómo se escriben las iniciales.
 */

export type PlacaMember = {
  firstName: string;
  lastName: string;
  memberNumber: string;
  joinedAt: Date | null;
  avatarUrl: string | null;
  profilePhotoUrl: string | null;
  city: string | null;
  province: string | null;
  studioCity: string | null;
  studioProvince: string | null;
  specialties: string[];
  instagram: string | null;
};

export type PlacaInstitution = {
  name: string;
  logoUrl: string | null;
};

/** Datos que todavía no existen (Parte 2: «Más sobre mí» y las fotos elegidas por el socio). */
export type PlacaExtras = {
  aboutPhrase?: string | null;
  featuredPhotos?: (string | null)[];
};

const limpio = (v: string | null | undefined) => (v ?? "").trim();

/**
 * La foto que se muestra. La del portal es la que el socio eligió para presentarse; la del
 * carnet es de documento, y sólo se usa si no hay otra.
 */
export function placaPhoto(m: Pick<PlacaMember, "avatarUrl" | "profilePhotoUrl">): string | null {
  return limpio(m.profilePhotoUrl) || limpio(m.avatarUrl) || null;
}

/**
 * Dónde trabaja. La ciudad del estudio es pública por definición —el socio la cargó para que lo
 * encuentren—; la personal es la de su domicilio, y sólo se usa si no hay otra. Nunca la calle.
 */
export function placaZone(
  m: Pick<PlacaMember, "city" | "province" | "studioCity" | "studioProvince">,
): string | null {
  const estudio = [limpio(m.studioCity), limpio(m.studioProvince)].filter(Boolean);
  if (estudio.length > 0) return unirSinRepetir(estudio);
  const personal = [limpio(m.city), limpio(m.province)].filter(Boolean);
  return personal.length > 0 ? unirSinRepetir(personal) : null;
}

/** "Santa Fe, Santa Fe" dice lo mismo dos veces. */
function unirSinRepetir(partes: string[]): string {
  const [a, b] = partes;
  if (b && a.toLocaleLowerCase("es-AR") === b.toLocaleLowerCase("es-AR")) return a;
  return partes.join(", ");
}

/** Hasta tres especialidades: en una placa, más que eso no se lee. */
export function placaSpecialty(specialties: string[]): string | null {
  const etiquetas = specialties.map((s) => etiquetaEspecialidad(s)).filter(Boolean);
  return etiquetas.length > 0 ? etiquetas.slice(0, 3).join(" · ") : null;
}

export function placaInitials(firstName: string, lastName: string): string {
  const inicial = (s: string) => Array.from(limpio(s))[0]?.toLocaleUpperCase("es-AR") ?? "";
  return `${inicial(firstName)}${inicial(lastName)}` || "·";
}

/** El usuario se guarda sin arroba; en la placa se escribe con ella, que es como se etiqueta. */
export function placaInstagram(instagram: string | null): string | null {
  const usuario = limpio(instagram).replace(/^@+/, "");
  return usuario ? `@${usuario}` : null;
}

export function placaValues(input: {
  member: PlacaMember;
  institution: PlacaInstitution;
  extras?: PlacaExtras;
}): Record<string, string | number | Date | null> {
  const { member: m, institution, extras } = input;
  const foto = placaPhoto(m);
  const destacadas = extras?.featuredPhotos ?? [];
  return {
    fullName: `${limpio(m.firstName)} ${limpio(m.lastName)}`.trim(),
    firstName: limpio(m.firstName) || null,
    lastName: limpio(m.lastName) || null,
    // El contrato lo declara número (es el del carnet): "0128" se escribe 128.
    memberNumber: Number(limpio(m.memberNumber)) || null,
    joinedAt: m.joinedAt,
    city: limpio(m.city) || null,
    institutionName: institution.name,
    institutionLogo: institution.logoUrl,
    // La foto del carnet también va: alguien puede haber usado "Foto del socio" en una placa.
    photo: limpio(m.avatarUrl) || foto,
    profilePhoto: foto,
    initials: placaInitials(m.firstName, m.lastName),
    zone: placaZone(m),
    specialty: placaSpecialty(m.specialties),
    instagramHandle: placaInstagram(m.instagram),
    aboutPhrase: limpio(extras?.aboutPhrase) || null,
    featuredPhoto1: destacadas[0] ?? null,
    featuredPhoto2: destacadas[1] ?? null,
    featuredPhoto3: destacadas[2] ?? null,
  };
}

/**
 * El texto sugerido para acompañar la placa de bienvenida en redes.
 *
 * Es un punto de partida para copiar y retocar, no un mensaje automático: lo publica una persona.
 */
export function welcomeCaption(input: {
  member: Pick<PlacaMember, "firstName" | "lastName" | "instagram" | "specialties"> &
    Partial<Pick<PlacaMember, "city" | "province" | "studioCity" | "studioProvince">>;
  institutionName: string;
}): string {
  const { member: m } = input;
  const nombre = `${limpio(m.firstName)} ${limpio(m.lastName)}`.trim();
  const arroba = placaInstagram(m.instagram);
  const quien = arroba ? `${nombre} (${arroba})` : nombre;
  const especialidad = placaSpecialty(m.specialties);
  const zona = placaZone({
    city: m.city ?? null,
    province: m.province ?? null,
    studioCity: m.studioCity ?? null,
    studioProvince: m.studioProvince ?? null,
  });

  const lineas = [`¡Le damos la bienvenida a ${quien} a ${input.institutionName}! 📸`];
  const detalle = [
    especialidad ? `Se dedica a ${especialidad.toLocaleLowerCase("es-AR")}` : null,
    zona ? `trabaja en ${zona}` : null,
  ].filter(Boolean);
  if (detalle.length > 0) {
    const frase = detalle.join(" y ");
    lineas.push(`${frase.charAt(0).toLocaleUpperCase("es-AR")}${frase.slice(1)}.`);
  }
  lineas.push("Te invitamos a conocer su trabajo. ¡Bienvenida/o a la comunidad!");
  return lineas.join("\n\n");
}
