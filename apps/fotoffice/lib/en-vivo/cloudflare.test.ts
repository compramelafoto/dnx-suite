import { describe, expect, it, vi } from "vitest";
import {
  borrarOutput,
  crearLiveInput,
  crearOutput,
  cuerpoNuevoLiveInput,
  leerLiveInputRemoto,
  listarVideosDelCanal,
  regenerarClaves,
  type CloudflareDeps,
} from "./cloudflare";

/** Cloudflare simulado: nunca se llama a la API real. */
const TOKEN = "cf-token-super-secreto";
const config = { accountId: "acc1", apiToken: TOKEN, signingKeyId: "k", signingKeyPem: "pem" };

function respuesta(status: number, cuerpo: unknown) {
  return new Response(cuerpo === undefined ? "" : JSON.stringify(cuerpo), { status });
}

function deps(...respuestas: Response[]): CloudflareDeps & { fetchImpl: ReturnType<typeof vi.fn> } {
  const fetchImpl = vi.fn();
  for (const r of respuestas) fetchImpl.mockResolvedValueOnce(r);
  return { config, fetchImpl };
}

const INPUT = {
  uid: "input456",
  rtmps: { url: "rtmps://live.cloudflare.com:443/live/", streamKey: "obs-clave-secreta" },
  srt: { url: "srt://live.cloudflare.com:778", streamId: "x", passphrase: "y" },
  status: "connected",
};

describe("canal (live input)", () => {
  it("se crea grabando siempre y con URL firmada", async () => {
    const d = deps(respuesta(200, { success: true, result: INPUT }));
    const input = await crearLiveInput("FOTOFFICE · SOYBELUZ", d);
    expect(input).toEqual({
      uid: "input456",
      rtmpsUrl: "rtmps://live.cloudflare.com:443/live/",
      rtmpsStreamKey: "obs-clave-secreta",
      srtUrl: "srt://live.cloudflare.com:778",
      status: "connected",
    });
    const [url, init] = d.fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acc1/stream/live_inputs");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(cuerpoNuevoLiveInput("FOTOFFICE · SOYBELUZ"));
    expect(JSON.parse(init.body).recording).toMatchObject({ mode: "automatic", requireSignedURLs: true });
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("leer un canal que ya no existe devuelve null", async () => {
    expect(await leerLiveInputRemoto("x", deps(respuesta(404, { success: false })))).toBeNull();
  });

  it("regenerar pega en rotate_keys", async () => {
    const d = deps(respuesta(200, { result: { ...INPUT, rtmps: { ...INPUT.rtmps, streamKey: "nueva" } } }));
    expect((await regenerarClaves("input456", d)).rtmpsStreamKey).toBe("nueva");
    expect(d.fetchImpl.mock.calls[0]![0]).toMatch(/\/stream\/live_inputs\/input456\/rotate_keys$/);
  });

  it("un rechazo explica el motivo sin repetir el token", async () => {
    const d = deps(respuesta(403, { errors: [{ code: 10000, message: "Authentication error" }] }));
    const error = await crearLiveInput("x", d).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("10000 Authentication error");
    expect((error as Error).message).not.toContain(TOKEN);
  });
});

describe("destinos (outputs)", () => {
  it("crear manda servidor y clave a Cloudflare y devuelve sólo el uid", async () => {
    const d = deps(respuesta(200, { result: { uid: "out1", url: "rtmp://a.rtmp.youtube.com/live2", streamKey: "clave-yt" } }));
    const uid = await crearOutput("input456", { url: "rtmp://a.rtmp.youtube.com/live2", streamKey: "clave-yt" }, d);
    expect(uid).toBe("out1");
    const [url, init] = d.fetchImpl.mock.calls[0]!;
    expect(url).toMatch(/\/stream\/live_inputs\/input456\/outputs$/);
    expect(JSON.parse(init.body)).toEqual({ url: "rtmp://a.rtmp.youtube.com/live2", streamKey: "clave-yt", enabled: true });
  });

  it("si Cloudflare rechaza el destino, el error no lleva la clave del destino", async () => {
    const d = deps(respuesta(400, { errors: [{ code: 10001, message: "invalid url" }] }));
    const error = await crearOutput("input456", { url: "rtmp://x/live", streamKey: "clave-ig-muy-secreta" }, d).catch((e: Error) => e);
    expect((error as Error).message).not.toContain("clave-ig-muy-secreta");
  });

  it("borrar acepta respuesta vacía y también un destino que ya no existe", async () => {
    await expect(borrarOutput("input456", "out1", deps(respuesta(200, undefined)))).resolves.toBeUndefined();
    await expect(borrarOutput("input456", "out1", deps(respuesta(404, { success: false })))).resolves.toBeUndefined();
  });
});

describe("grabaciones del canal", () => {
  it("traduce los estados y sólo da duración y miniatura a las listas", async () => {
    const d = deps(
      respuesta(200, {
        result: [
          { uid: "v0", status: { state: "live-inprogress" }, created: "2026-11-12T22:00:00Z", duration: -1 },
          { uid: "v1", status: { state: "ready" }, created: "2026-11-09T21:00:00Z", duration: 3600.6, thumbnail: "https://t/v1.jpg" },
          { uid: "v2", status: { state: "inprogress" }, duration: 10 },
          { uid: "v3", status: { state: "error" } },
          { nada: true },
        ],
      }),
    );
    expect(await listarVideosDelCanal("input456", d)).toEqual([
      { uid: "v0", estado: "EN_VIVO", durationSeconds: null, thumbnailUrl: null, creado: new Date("2026-11-12T22:00:00Z") },
      { uid: "v1", estado: "LISTA", durationSeconds: 3601, thumbnailUrl: "https://t/v1.jpg", creado: new Date("2026-11-09T21:00:00Z") },
      { uid: "v2", estado: "PROCESANDO", durationSeconds: null, thumbnailUrl: null, creado: null },
      { uid: "v3", estado: "ERROR", durationSeconds: null, thumbnailUrl: null, creado: null },
    ]);
  });
});
