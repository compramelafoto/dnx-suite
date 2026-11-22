import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchChainInfo, fetchRound, roundAfter, roundTime } from "./drand";

// quicknet: cadena unchained, período de 3 segundos.
const info = {
  chainHash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
  periodSeconds: 3,
  genesisTimeSeconds: 1_692_803_367,
};

describe("qué tanda le toca a un sorteo", () => {
  it("la tanda 1 es la del génesis", () => {
    expect(roundTime(info, 1).getTime()).toBe(info.genesisTimeSeconds * 1000);
  });

  it("elige la primera tanda POSTERIOR al acto", () => {
    const acto = new Date(info.genesisTimeSeconds * 1000 + 10 * 3000);
    const r = roundAfter(info, acto);
    expect(roundTime(info, r).getTime()).toBeGreaterThan(acto.getTime());
  });

  it("cuando el acto cae justo en una tanda, toma la siguiente y no esa", () => {
    const acto = new Date(info.genesisTimeSeconds * 1000 + 10 * 3000);
    expect(roundAfter(info, acto)).toBe(12);
  });

  it("cuando el acto cae en el medio, toma la que viene", () => {
    const acto = new Date(info.genesisTimeSeconds * 1000 + 10 * 3000 + 1500);
    expect(roundAfter(info, acto)).toBe(12);
  });

  it("un acto anterior al génesis no tiene tanda: es un error, no un número raro", () => {
    expect(() => roundAfter(info, new Date(0))).toThrow(/génesis/i);
  });
});

describe("leer la cadena", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lee período y génesis del servicio, no del código", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ hash: info.chainHash, period: 3, genesis_time: info.genesisTimeSeconds }),
      ),
    );
    await expect(fetchChainInfo(info.chainHash)).resolves.toEqual(info);
  });

  it("si el servicio devuelve otra cadena de la pedida, falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ hash: "0".repeat(64), period: 3, genesis_time: 1 })),
    );
    await expect(fetchChainInfo(info.chainHash)).rejects.toThrow(/dos espejos|cadena/i);
  });

  it("lee el valor de una tanda y lo devuelve con su firma", async () => {
    const respuesta = { round: 42, randomness: "a".repeat(64), signature: "b".repeat(96) };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(respuesta)));
    await expect(fetchRound(info.chainHash, 42)).resolves.toEqual(respuesta);
  });

  it("exige que dos espejos digan lo mismo", async () => {
    const uno = { round: 42, randomness: "a".repeat(64), signature: "b".repeat(96) };
    const otro = { round: 42, randomness: "c".repeat(64), signature: "b".repeat(96) };
    let llamada = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(llamada++ === 0 ? uno : otro)),
    );
    await expect(fetchRound(info.chainHash, 42)).rejects.toThrow(/no coinciden/i);
  });

  it("si la tanda todavía no salió, lo dice con esas palabras (425, que es lo que contesta drand)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("too early", { status: 425 })));
    await expect(fetchRound(info.chainHash, 999_999_999)).rejects.toThrow(/todavía no/i);
  });

  it("un 404 también se lee como tanda que todavía no salió", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    await expect(fetchRound(info.chainHash, 999_999_999)).rejects.toThrow(/todavía no/i);
  });

  it("dos espejos que ordenan los campos distinto igual coinciden: se compara lo parseado", async () => {
    // Comprobado contra el servicio: el espejo de Cloudflare devuelve round, signature,
    // randomness; los de drand.sh devuelven round, randomness, signature. Es el mismo valor.
    const comoDrand = { round: 42, randomness: "a".repeat(64), signature: "b".repeat(96) };
    const comoCloudflare = { round: 42, signature: "b".repeat(96), randomness: "a".repeat(64) };
    let llamada = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(llamada++ === 0 ? comoCloudflare : comoDrand)),
    );
    await expect(fetchRound(info.chainHash, 42)).resolves.toEqual(comoDrand);
  });

  it("si el primer espejo se cae, usa el siguiente", async () => {
    const ok = { round: 42, randomness: "a".repeat(64), signature: "b".repeat(96) };
    let llamada = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        llamada += 1;
        if (llamada === 1) throw new Error("ECONNRESET");
        return Response.json(ok);
      }),
    );
    await expect(fetchRound(info.chainHash, 42)).resolves.toEqual(ok);
  });

  it("con un solo espejo en pie no alcanza: no se resuelve sin confirmación", async () => {
    const ok = { round: 42, randomness: "a".repeat(64), signature: "b".repeat(96) };
    let llamada = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        llamada += 1;
        if (llamada === 1) return Response.json(ok);
        throw new Error("ECONNRESET");
      }),
    );
    await expect(fetchRound(info.chainHash, 42)).rejects.toThrow(/dos espejos/i);
  });
});
