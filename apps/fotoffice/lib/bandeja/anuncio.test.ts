import { describe, expect, it } from "vitest";
import { anuncioDeMedia, anuncioDeReferral, etiquetaDeAnuncio, temaDeAnuncio } from "./anuncio";
import { historialParaElBot } from "./bot/historial";
import { leerWebhook } from "./webhook";

/** `referral` como lo manda Meta en el primer mensaje de un anuncio "clic a WhatsApp". */
const REFERRAL = {
  source_url: "https://fb.me/abc",
  source_id: "120250851161490497",
  source_type: "ad",
  headline: "Chatea con nosotros",
  body: "¿TENÉS VHS GUARDADOS?",
  media_type: "video",
  ctwa_clid: "ARAkLkA8rmlFeiCktEJQ",
};

const webhookConReferral = (mensaje: Record<string, unknown>) => ({
  object: "whatsapp_business_account",
  entry: [{
    id: "288314434371834",
    changes: [{
      field: "messages",
      value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: "5493413419869", phone_number_id: "299578913244973" },
        contacts: [{ profile: { name: "Marta" }, wa_id: "5493415550000" }],
        messages: [{ from: "5493415550000", id: "wamid.AD1", timestamp: "1791558000", ...mensaje }],
      },
    }],
  }],
});

describe("anuncioDeReferral", () => {
  it("toma id, tipo, url, título, texto y el código del clic", () => {
    expect(anuncioDeReferral(REFERRAL)).toEqual({
      id: "120250851161490497", tipo: "ad", url: "https://fb.me/abc", titulo: "Chatea con nosotros", texto: "¿TENÉS VHS GUARDADOS?",
      ctwaClid: "ARAkLkA8rmlFeiCktEJQ",
    });
  });

  it("sin referral o sin nada útil → null", () => {
    expect(anuncioDeReferral(undefined)).toBeNull();
    expect(anuncioDeReferral("x")).toBeNull();
    expect(anuncioDeReferral({ media_type: "video" })).toBeNull();
  });

  it("recorta textos largos", () => {
    expect(anuncioDeReferral({ body: "a".repeat(2000) })?.texto).toHaveLength(500);
  });
});

describe("leerWebhook con anuncio", () => {
  it("un texto que llega de un anuncio sigue siendo TEXTO y lleva el anuncio en media", () => {
    const [e] = leerWebhook(webhookConReferral({ type: "text", text: { body: "¡Hola! Quiero más información." }, referral: REFERRAL }));
    expect(e).toMatchObject({
      tipo: "ENTRANTE", mensajeTipo: "TEXTO", texto: "¡Hola! Quiero más información.", nombre: "Marta",
      media: { anuncio: { id: "120250851161490497", texto: "¿TENÉS VHS GUARDADOS?" } },
    });
  });

  it("una foto que llega de un anuncio conserva los datos del archivo", () => {
    const [e] = leerWebhook(webhookConReferral({ type: "image", image: { id: "999", mime_type: "image/jpeg" }, referral: REFERRAL }));
    expect(e).toMatchObject({ mensajeTipo: "IMAGEN", media: { id: "999", mimeType: "image/jpeg", anuncio: { titulo: "Chatea con nosotros" } } });
  });

  it("sin referral, media sigue en null para los textos", () => {
    const [e] = leerWebhook(webhookConReferral({ type: "text", text: { body: "hola" } }));
    expect(e).toMatchObject({ media: null });
  });
});

describe("el bot ve de qué anuncio vino", () => {
  it("anuncioDeMedia lee lo guardado y etiquetaDeAnuncio arma el aviso", () => {
    const a = anuncioDeMedia({ anuncio: { titulo: "Chatea con nosotros", texto: "¿TENÉS VHS\nGUARDADOS?" } });
    expect(a).toEqual({ titulo: "Chatea con nosotros", texto: "¿TENÉS VHS\nGUARDADOS?" });
    expect(etiquetaDeAnuncio(a!)).toBe(
      "[el cliente llegó tocando un anuncio del estudio en Facebook/Instagram: «Chatea con nosotros — ¿TENÉS VHS GUARDADOS?»]",
    );
    expect(anuncioDeMedia({ id: "1" })).toBeNull();
    expect(anuncioDeMedia(null)).toBeNull();
  });

  it("historialParaElBot antepone el anuncio al mensaje del cliente", () => {
    const r = historialParaElBot([
      { direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "¡Hola! Quiero más información.", media: { anuncio: { texto: "¿TENÉS VHS GUARDADOS?" } } },
    ]);
    expect(r?.userText).toBe(
      "[el cliente llegó tocando un anuncio del estudio en Facebook/Instagram: «¿TENÉS VHS GUARDADOS?»] ¡Hola! Quiero más información.",
    );
  });
});

describe("anuncios de XV: siempre cobertura de la fiesta", () => {
  /** El anuncio real del 15/11/2026: apunta a madres de quinceañeras aunque hable de edición. */
  const XV_EDICION = { headline: "Más info", body: "¿Edición y retoques en fotos de quinceañeras?", source_type: "ad", source_url: "https://fb.me/xv" };

  it("detecta el tema XV por quince, quinceañera, XV o 15 años", () => {
    expect(temaDeAnuncio({ texto: "¿Edición y retoques en fotos de quinceañeras?" })).toBe("XV");
    expect(temaDeAnuncio({ titulo: "Tus XV como los soñaste" })).toBe("XV");
    expect(temaDeAnuncio({ texto: "Fotos para la fiesta de 15 años" })).toBe("XV");
    expect(temaDeAnuncio({ texto: "Cómo dirigir a una quince" })).toBe("XV");
    expect(temaDeAnuncio({ texto: "¿TENÉS VHS GUARDADOS?" })).toBeNull();
    expect(temaDeAnuncio({ texto: "Revelado en 15 minutos" })).toBeNull();
  });

  it("el bot recibe el anuncio de edición de XV marcado como cobertura de la fiesta, no como retoque", () => {
    const [e] = leerWebhook(webhookConReferral({ type: "text", text: { body: "¡Hola! Quiero más información" }, referral: XV_EDICION }));
    if (e?.tipo !== "ENTRANTE") throw new Error("se esperaba un mensaje entrante");
    const r = historialParaElBot([
      { direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: e.texto, media: e.media },
    ]);
    expect(r?.userText).toBe(
      "[el cliente llegó tocando un anuncio del estudio en Facebook/Instagram: «Más info — ¿Edición y retoques en fotos de quinceañeras?» · TEMA: cobertura fotográfica de una fiesta de XV (busca fotógrafo para la fiesta; no es retoque de fotos sueltas)] ¡Hola! Quiero más información",
    );
  });
});
