import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { leerAviso, TOLERANCIA_SEGUNDOS, verificarFirmaStream, verificarSecretoNotificacion } from "./webhook";

const SECRETO = "85011ed3a913c6ad5f9cf6c5573cc0a7";
const AHORA = 1_800_000_000;

function firmar(cuerpo: string, time: number, secreto = SECRETO) {
  const sig = createHmac("sha256", secreto).update(`${time}.${cuerpo}`).digest("hex");
  return `time=${time},sig1=${sig}`;
}

const VIDEO_LISTO = JSON.stringify({
  uid: "vid123",
  liveInput: "input456",
  readyToStream: true,
  status: { state: "ready", pctComplete: "100.000000" },
  duration: 3601.4,
  thumbnail: "https://videodelivery.net/vid123/thumbnails/thumbnail.jpg",
  created: "2026-11-10T21:00:05Z",
});

describe("firma del webhook de Stream (Webhook-Signature)", () => {
  it("acepta un aviso bien firmado", () => {
    expect(verificarFirmaStream({ secreto: SECRETO, encabezado: firmar(VIDEO_LISTO, AHORA), cuerpo: VIDEO_LISTO, ahoraSegundos: AHORA })).toEqual({ ok: true });
  });

  it("rechaza si el cuerpo se alteró en un solo byte", () => {
    const alterado = VIDEO_LISTO.replace("ready", "readY");
    expect(verificarFirmaStream({ secreto: SECRETO, encabezado: firmar(VIDEO_LISTO, AHORA), cuerpo: alterado, ahoraSegundos: AHORA }).ok).toBe(false);
  });

  it("rechaza con otro secreto", () => {
    expect(
      verificarFirmaStream({ secreto: SECRETO, encabezado: firmar(VIDEO_LISTO, AHORA, "otro"), cuerpo: VIDEO_LISTO, ahoraSegundos: AHORA }).ok,
    ).toBe(false);
  });

  it("rechaza un aviso viejo (repetición)", () => {
    const viejo = AHORA - TOLERANCIA_SEGUNDOS - 1;
    expect(verificarFirmaStream({ secreto: SECRETO, encabezado: firmar(VIDEO_LISTO, viejo), cuerpo: VIDEO_LISTO, ahoraSegundos: AHORA })).toEqual({
      ok: false,
      motivo: "aviso vencido",
    });
  });

  it("rechaza sin encabezado o mal formado", () => {
    expect(verificarFirmaStream({ secreto: SECRETO, encabezado: null, cuerpo: VIDEO_LISTO, ahoraSegundos: AHORA }).ok).toBe(false);
    expect(verificarFirmaStream({ secreto: SECRETO, encabezado: "sig1=abc", cuerpo: VIDEO_LISTO, ahoraSegundos: AHORA }).ok).toBe(false);
    expect(verificarFirmaStream({ secreto: SECRETO, encabezado: "time=abc,sig1=abc", cuerpo: VIDEO_LISTO, ahoraSegundos: AHORA }).ok).toBe(false);
  });
});

describe("secreto de las Notificaciones (cf-webhook-auth)", () => {
  it("acepta el secreto exacto y rechaza el resto", () => {
    expect(verificarSecretoNotificacion({ secreto: SECRETO, encabezado: SECRETO }).ok).toBe(true);
    expect(verificarSecretoNotificacion({ secreto: SECRETO, encabezado: `${SECRETO}x` }).ok).toBe(false);
    expect(verificarSecretoNotificacion({ secreto: SECRETO, encabezado: null }).ok).toBe(false);
  });
});

describe("lectura de avisos", () => {
  const ahora = new Date("2026-11-10T21:30:00Z");

  it("live_input.connected → hay señal", () => {
    const aviso = leerAviso(
      {
        name: "x",
        data: { notification_name: "Stream Live Input", input_id: "input456", event_type: "live_input.connected", updated_at: "2026-11-10T21:00:00Z" },
        ts: 1,
      },
      ahora,
    );
    expect(aviso).toEqual({ tipo: "SENAL", conectada: true, liveInputUid: "input456", at: new Date("2026-11-10T21:00:00Z") });
  });

  it("live_input.disconnected → se cortó", () => {
    const aviso = leerAviso({ data: { input_id: "input456", event_type: "live_input.disconnected" } }, ahora);
    expect(aviso).toMatchObject({ tipo: "SENAL", conectada: false, liveInputUid: "input456", at: ahora });
  });

  it("live_input.errored trae el código y el mensaje", () => {
    const aviso = leerAviso(
      {
        data: {
          input_id: "input456",
          event_type: "live_input.errored",
          live_input_errored: { error: { code: "ERR_GOP_OUT_OF_RANGE", message: "keyframe interval too long" } },
        },
      },
      ahora,
    );
    expect(aviso).toMatchObject({ tipo: "ERROR_SENAL", detalle: "ERR_GOP_OUT_OF_RANGE: keyframe interval too long" });
  });

  it("video de un vivo listo → grabación lista con duración y miniatura", () => {
    expect(leerAviso(JSON.parse(VIDEO_LISTO), ahora)).toEqual({
      tipo: "GRABACION",
      videoUid: "vid123",
      liveInputUid: "input456",
      estado: "LISTA",
      durationSeconds: 3601,
      thumbnailUrl: "https://videodelivery.net/vid123/thumbnails/thumbnail.jpg",
      creado: new Date("2026-11-10T21:00:05Z"),
    });
  });

  it("video con error", () => {
    expect(leerAviso({ uid: "v", liveInput: "i", status: { state: "error" } }, ahora)).toMatchObject({ tipo: "GRABACION", estado: "ERROR", durationSeconds: null });
  });

  it("un video de un curso (sin liveInput) no es nuestro", () => {
    expect(leerAviso({ uid: "v", status: { state: "ready" } }, ahora)).toBeNull();
  });

  it("un tipo de aviso desconocido o un cuerpo raro se ignoran", () => {
    expect(leerAviso({ data: { input_id: "i", event_type: "otra.cosa" } }, ahora)).toBeNull();
    expect(leerAviso(null, ahora)).toBeNull();
    expect(leerAviso("hola", ahora)).toBeNull();
  });
});
