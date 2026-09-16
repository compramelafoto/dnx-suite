import { describe, expect, it } from "vitest";
import {
  CONSENT_KINDS,
  CONSENT_TEXT_VERSION_VIGENTE,
  DERIVED_SHOWCASE_CONSENT,
  REQUIRED_CONSENTS,
  consentTexts,
  deriveShowcaseConsent,
  hashConsentText,
  parseConsents,
} from "./consents";
import { formatChoiceValue } from "./request-fields";

/**
 * Los permisos, uno por uno y con la versión del texto que la persona leyó.
 *
 * No es un checkbox de "acepto todo" a propósito. Autorizar una cobertura, avisar que va a
 * haber menores y permitir que la organización muestre las fotos son tres cosas distintas, con
 * consecuencias distintas, y en el peor momento —cuando alguien reclame— hay que poder decir
 * cuál de las tres dio y qué texto exacto leyó.
 */
describe("consentTexts", () => {
  it("hay un texto por cada permiso del catálogo", () => {
    const { texts } = consentTexts("v1");
    for (const kind of CONSENT_KINDS) {
      expect(texts[kind].length).toBeGreaterThan(10);
    }
  });

  it("pedir 'v1' devuelve la versión 'v1'", () => {
    const { version } = consentTexts("v1");
    expect(version).toBe("v1");
  });

  it("una versión que no existe devuelve la vigente, no la pedida", () => {
    // Si mañana existe v2 y alguien pide "v7" por error, tiene que quedar claro en el dato
    // (la versión vigente, no "v7") qué texto se sirvió en realidad.
    const { version, texts } = consentTexts("v7-no-existe");
    expect(version).toBe(CONSENT_TEXT_VERSION_VIGENTE);
    expect(version).not.toBe("v7-no-existe");
    expect(texts).toBeTruthy();
  });

  it("el hash cambia si el texto cambia", () => {
    // Es el punto de todo: si mañana se reescribe un texto, los consentimientos viejos tienen
    // que seguir apuntando al que se firmó.
    expect(hashConsentText("Autorizo la cobertura.")).not.toBe(
      hashConsentText("Autorizo la cobertura fotográfica."),
    );
  });

  it("el mismo texto da siempre el mismo hash", () => {
    expect(hashConsentText("Autorizo")).toBe(hashConsentText("Autorizo"));
  });
});

describe("parseConsents", () => {
  function formularioCompleto(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const kind of REQUIRED_CONSENTS) out[`consent_${kind}`] = "on";
    return out;
  }

  it("con los obligatorios tildados, pasa", () => {
    const r = parseConsents(formularioCompleto(), "v1");
    expect(r.ok).toBe(true);
  });

  it("falta uno obligatorio: no pasa, y dice cuál", () => {
    const form = formularioCompleto();
    delete form[`consent_${REQUIRED_CONSENTS[0]}`];
    const r = parseConsents(form, "v1");
    expect(r.ok).toBe(false);
  });

  it("guarda la versión y el hash de cada uno", () => {
    const r = parseConsents(formularioCompleto(), "v1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const fila of r.data) {
        expect(fila.textVersion).toBe("v1");
        expect(fila.textHash).toHaveLength(64);
      }
    }
  });

  it("con una versión que no existe, guarda la vigente en cada fila, no la pedida", () => {
    // El día que exista v2 y la vigente cambie sin que "v7-no-existe" se sume al mapa, cada
    // fila tiene que decir la verdad: qué texto se mostró de verdad, no el número que llegó
    // por parámetro.
    const r = parseConsents(formularioCompleto(), "v7-no-existe");
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const fila of r.data) {
        expect(fila.textVersion).toBe(CONSENT_TEXT_VERSION_VIGENTE);
        expect(fila.textVersion).not.toBe("v7-no-existe");
      }
    }
  });

  it("un permiso opcional no tildado se guarda como negado, no se omite", () => {
    // Guardar el "no" importa tanto como el "sí": es la diferencia entre "dijo que no" y
    // "nunca se le preguntó".
    const r = parseConsents(formularioCompleto(), "v1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const opcional = r.data.find((c) => !REQUIRED_CONSENTS.includes(c.kind));
      expect(opcional?.granted).toBe(false);
    }
  });

  it("hay una fila por cada permiso del catálogo, siempre", () => {
    const r = parseConsents(formularioCompleto(), "v1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toHaveLength(CONSENT_KINDS.length);
  });
});

/**
 * El permiso de difusión, deducido de la pregunta por el alcance.
 *
 * "¿Nos autorizan a compartir material del evento?" y el tilde de USO_INSTITUCIONAL son la
 * misma pregunta: una con cuatro niveles y la otra con un sí o un no. Cuando la institución
 * hace la primera, la segunda no se muestra y el permiso sale de la respuesta. Lo que **no**
 * cambia es el registro: se guarda igual la fila con su texto, su versión y su hash.
 */
describe("deriveShowcaseConsent", () => {
  it("«pueden compartir lo que quieran» es un sí", () => {
    expect(deriveShowcaseConsent("TODO")).toBe(true);
  });

  it("«con restricciones» y «sin personas» son un sí con condiciones", () => {
    // La organización autoriza a difundir y aclara hasta dónde; la aclaración vive en el campo,
    // a la vista de quien prepara la publicación.
    expect(deriveShowcaseConsent("CON_RESTRICCIONES")).toBe(true);
    expect(deriveShowcaseConsent("SIN_PERSONAS")).toBe(true);
  });

  it("«no suban ninguna foto» es el único no de las cuatro", () => {
    expect(deriveShowcaseConsent("NADA")).toBe(false);
  });

  it("sin responder no hay permiso", () => {
    expect(deriveShowcaseConsent(null)).toBe(false);
    expect(deriveShowcaseConsent(undefined)).toBe(false);
    expect(deriveShowcaseConsent("")).toBe(false);
  });

  it("«Otros» no otorga: un permiso que hay que interpretar no es un permiso", () => {
    expect(deriveShowcaseConsent(formatChoiceValue("OTROS", "hablémoslo antes"))).toBe(false);
  });

  it("un valor que no está en el catálogo no otorga", () => {
    expect(deriveShowcaseConsent("UNA_QUE_YA_NO_ESTA")).toBe(false);
  });

  it("lee la opción y no el texto libre que venga detrás", () => {
    expect(deriveShowcaseConsent("CON_RESTRICCIONES: nada de menores")).toBe(true);
    expect(deriveShowcaseConsent("NADA: es una causa sensible")).toBe(false);
  });
});

describe("parseConsents con el permiso de difusión deducido", () => {
  const obligatorios: Record<string, string> = {};
  for (const kind of REQUIRED_CONSENTS) obligatorios[`consent_${kind}`] = "on";

  const difusion = (r: ReturnType<typeof parseConsents>) => {
    if (!r.ok) throw new Error(r.error);
    return r.data.find((c) => c.kind === DERIVED_SHOWCASE_CONSENT)!;
  };

  it("sin deducción, el tilde manda como siempre", () => {
    expect(difusion(parseConsents(obligatorios, "v1")).granted).toBe(false);
    expect(
      difusion(parseConsents({ ...obligatorios, consent_USO_INSTITUCIONAL: "on" }, "v1")).granted,
    ).toBe(true);
  });

  it("con deducción, el tilde que igual llegue se ignora: nadie lo vio", () => {
    const r = parseConsents({ ...obligatorios, consent_USO_INSTITUCIONAL: "on" }, "v1", false);
    expect(difusion(r).granted).toBe(false);
  });

  it("deducido en sí, queda otorgado aunque no haya llegado ningún tilde", () => {
    expect(difusion(parseConsents(obligatorios, "v1", true)).granted).toBe(true);
  });

  it("el registro legal no cambia: misma versión y mismo hash que el texto de siempre", () => {
    const { version, texts } = consentTexts("v1");
    const fila = difusion(parseConsents(obligatorios, "v1", true));
    expect(fila.textVersion).toBe(version);
    expect(fila.textHash).toBe(hashConsentText(texts.USO_INSTITUCIONAL));
  });

  it("la deducción no toca a los otros permisos", () => {
    const r = parseConsents({ ...obligatorios, consent_MENORES_PRESENTES: "on" }, "v1", false);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.find((c) => c.kind === "MENORES_PRESENTES")?.granted).toBe(true);
    for (const kind of REQUIRED_CONSENTS) {
      expect(r.data.find((c) => c.kind === kind)?.granted).toBe(true);
    }
  });

  it("los obligatorios siguen siendo obligatorios aunque la difusión se deduzca", () => {
    const r = parseConsents({ consent_TERMINOS: "on" }, "v1", true);
    expect(r.ok).toBe(false);
  });

  it("se sigue guardando una fila por cada permiso, también por el deducido", () => {
    const r = parseConsents(obligatorios, "v1", true);
    if (!r.ok) throw new Error(r.error);
    expect(r.data).toHaveLength(CONSENT_KINDS.length);
  });
});
