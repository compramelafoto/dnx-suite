import { normalizarSitioWeb } from "@/lib/membership/social";

/**
 * «Más sobre mí»: las preguntas, cómo se validan y cómo se cuentan.
 *
 * Módulo puro: lo usan el formulario del portal (cliente), la tarjeta del socio de la semana y
 * la placa. Sin base ni red.
 */

export const ABOUT_ME_INTRO = {
  titulo: "¿Para qué es esto?",
  parrafos: [
    "La fotografía es un oficio que se hace mejor en comunidad. Cada semana la institución presenta a un socio como Socio de la semana, para que nos conozcamos más allá del nombre: de dónde sos, qué te apasiona, en qué podés dar una mano y en qué te gustaría crecer.",
    "Conocerse es el primer paso para armar una red de colegas fuerte: alguien a quien recomendar cuando no podés tomar un trabajo, con quien asociarte en un evento grande, a quien pedirle un reemplazo o un consejo. Muchas alianzas y trabajos futuros nacen de una charla entre colegas.",
    "Todas las preguntas son opcionales y sólo se muestra lo que contestes. En algún momento te va a tocar ser el Socio de la semana: cuanto más completes, mejor te van a conocer.",
  ],
} as const;

export const ABOUT_ME_QUESTIONS = [
  { key: "howStarted", pregunta: "¿Cómo empezaste en la fotografía?", max: 400 },
  { key: "passion", pregunta: "¿Qué es lo que más te apasiona fotografiar?", max: 300 },
  { key: "inspiration", pregunta: "¿Qué fotógrafo o fotógrafa te inspira?", max: 200 },
  { key: "gear", pregunta: "¿Con qué equipo trabajás? (cámara o lente favoritos)", max: 200 },
  {
    key: "proudPhotoText",
    pregunta: "Una foto tuya de la que estés orgulloso/a, y por qué",
    max: 400,
  },
  {
    key: "canHelpWith",
    pregunta: "¿En qué podés dar una mano a otros colegas?",
    ayuda: "Por ejemplo: edición, iluminación, reemplazos en eventos.",
    max: 300,
  },
  { key: "wantsToLearn", pregunta: "¿En qué te gustaría que te ayuden o aprender?", max: 300 },
  {
    key: "beyondPhotography",
    pregunta: "Algo de vos que no tenga que ver con la foto",
    ayuda: "Un hobby, un dato curioso.",
    max: 300,
  },
] as const;

export type AboutMeAnswerKey = (typeof ABOUT_ME_QUESTIONS)[number]["key"];

export type AboutMeAnswers = Record<AboutMeAnswerKey, string | null>;

export type AboutMe = AboutMeAnswers & {
  proudPhotoUrl: string | null;
  whatsappOptIn: boolean;
  spotlightNoticeAt: Date | null;
  featuredPhotoUrls: string[];
};

export const MAX_FEATURED_PHOTOS = 3;

export type ParseAboutMeResult =
  | {
      ok: true;
      value: AboutMeAnswers & {
        proudPhotoUrl: string | null;
        whatsappOptIn: boolean;
        spotlightNotice: boolean;
        featuredPhotoUrls: string[];
      };
    }
  | { ok: false; error: string; field: string };

/** Lo que llega del formulario, ya validado. */
export function parseAboutMe(input: {
  answers: Record<string, unknown>;
  proudPhotoUrl: unknown;
  whatsappOptIn: boolean;
  spotlightNotice: boolean;
  featuredPhotoUrls: unknown[];
  /** Las únicas direcciones de foto aceptadas: las de su portfolio y las que subió para esto. */
  allowedPhotoUrls: ReadonlySet<string>;
}): ParseAboutMeResult {
  const answers = {} as AboutMeAnswers;
  for (const q of ABOUT_ME_QUESTIONS) {
    const bruto = input.answers[q.key];
    const texto = typeof bruto === "string" ? bruto.replace(/\s+\n/g, "\n").trim() : "";
    if (texto.length > q.max) {
      return { ok: false, field: q.key, error: `"${q.pregunta}" admite hasta ${q.max} caracteres.` };
    }
    answers[q.key] = texto || null;
  }

  let proudPhotoUrl: string | null = null;
  const linkBruto = typeof input.proudPhotoUrl === "string" ? input.proudPhotoUrl.trim() : "";
  if (linkBruto) {
    const link = normalizarSitioWeb(linkBruto);
    if (!link.ok) {
      return { ok: false, field: "proudPhotoUrl", error: "El link de la foto no parece una dirección web." };
    }
    proudPhotoUrl = link.valor;
  }

  const fotos: string[] = [];
  for (const u of input.featuredPhotoUrls) {
    if (typeof u !== "string" || !u) continue;
    if (!input.allowedPhotoUrls.has(u)) {
      return { ok: false, field: "featuredPhotoUrls", error: "Una de las fotos elegidas ya no está disponible." };
    }
    if (!fotos.includes(u)) fotos.push(u);
  }
  if (fotos.length > MAX_FEATURED_PHOTOS) {
    return {
      ok: false,
      field: "featuredPhotoUrls",
      error: `Podés elegir hasta ${MAX_FEATURED_PHOTOS} fotos para tu placa.`,
    };
  }

  return {
    ok: true,
    value: {
      ...answers,
      proudPhotoUrl,
      whatsappOptIn: input.whatsappOptIn,
      spotlightNotice: input.spotlightNotice,
      featuredPhotoUrls: fotos,
    },
  };
}

/** Las respuestas contestadas, en el orden de las preguntas, para mostrar. */
export function answeredQuestions(about: Partial<AboutMeAnswers> | null | undefined) {
  if (!about) return [];
  return ABOUT_ME_QUESTIONS.flatMap((q) => {
    const r = about[q.key]?.trim();
    return r ? [{ key: q.key, pregunta: q.pregunta, respuesta: r }] : [];
  });
}

export function hasAnyAnswer(about: Partial<AboutMeAnswers> | null | undefined): boolean {
  return answeredQuestions(about).length > 0;
}

/** Primera letra en minúscula, para encadenar una respuesta dentro de una frase. */
function enFrase(texto: string): string {
  const t = texto.trim().replace(/[.。]+$/, "");
  if (!t) return t;
  // No se baja una sigla ("RAW", "IA") ni un nombre propio largo en mayúsculas.
  if (/^[A-ZÁÉÍÓÚÑ]{2,}/.test(t)) return t;
  return t.charAt(0).toLocaleLowerCase("es-AR") + t.slice(1);
}

/**
 * La frase para acercarse como colegas, armada con las preguntas 6 y 7:
 * "Juan puede darte una mano con iluminación de estudio y quiere aprender video."
 */
export function colleaguePhrase(
  firstName: string,
  about: Partial<Pick<AboutMeAnswers, "canHelpWith" | "wantsToLearn">> | null | undefined,
): string | null {
  const nombre = firstName.trim() || "Este colega";
  const ayuda = about?.canHelpWith?.trim();
  const aprender = about?.wantsToLearn?.trim();
  if (ayuda && aprender) {
    return `${nombre} puede darte una mano con ${enFrase(ayuda)} y quiere aprender ${enFrase(aprender)}.`;
  }
  if (ayuda) return `${nombre} puede darte una mano con ${enFrase(ayuda)}.`;
  if (aprender) return `${nombre} quiere aprender ${enFrase(aprender)}. ¿Le podés dar una mano?`;
  return null;
}

/** La frase que va en la placa: lo que más le apasiona, o lo primero que haya contestado. */
export function placaAboutPhrase(about: Partial<AboutMeAnswers> | null | undefined): string | null {
  const pasion = about?.passion?.trim();
  if (pasion) return recortar(pasion, 150);
  const primera = answeredQuestions(about)[0]?.respuesta;
  return primera ? recortar(primera, 150) : null;
}

function recortar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max - 1);
  const espacio = corte.lastIndexOf(" ");
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}

/** El mensaje con el que se abre WhatsApp desde la tarjeta. */
export function spotlightWhatsappMessage(input: {
  firstName: string;
  institution: string;
}): string {
  return `Hola ${input.firstName.trim()}, te vi como Socio de la semana en ${input.institution} y quería conocerte. ¡Un gusto!`;
}

/** El texto sugerido para acompañar la placa del socio de la semana en redes. */
export function spotlightCaption(input: {
  firstName: string;
  lastName: string;
  instagram: string | null;
  institutionName: string;
  specialty: string | null;
  zone: string | null;
  about: Partial<AboutMeAnswers> | null;
}): string {
  const nombre = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
  const usuario = (input.instagram ?? "").trim().replace(/^@+/, "");
  const quien = usuario ? `${nombre} (@${usuario})` : nombre;
  const lineas = [`✨ Socio de la semana en ${input.institutionName}: ${quien}.`];
  const detalle = [
    input.specialty ? `se dedica a ${input.specialty.toLocaleLowerCase("es-AR")}` : null,
    input.zone ? `trabaja en ${input.zone}` : null,
  ].filter(Boolean);
  if (detalle.length) {
    const frase = detalle.join(" y ");
    lineas.push(`${frase.charAt(0).toLocaleUpperCase("es-AR")}${frase.slice(1)}.`);
  }
  const pasion = input.about?.passion?.trim();
  if (pasion) lineas.push(`Lo que más le apasiona: ${enFrase(pasion)}.`);
  const colega = colleaguePhrase(input.firstName, input.about);
  if (colega) lineas.push(colega);
  lineas.push("Conocelo, escribile y sumate a la red de colegas. 📸");
  return lineas.join("\n\n");
}
