import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  APAGADO_INICIAL, PUERTO_AYUDANTE, SEGUNDOS_AVISO, casillaMarcada, consultarAyudante, evaluarFin, pedirAlAyudante,
  segundosRestantes, transicionApagado, validarCodigo, type EntradaFin, type EstadoApagado, type EventoApagado,
} from "./apagado";

const fin = (e: Partial<EntradaFin>): EntradaFin => ({ fase: "terminada", cierreFallido: null, pendientes: 0, descartadas: 0, ...e });
const correr = (eventos: EventoApagado[], desde: EstadoApagado = APAGADO_INICIAL) => eventos.reduce(transicionApagado, desde);

describe("validarCodigo", () => {
  it("acepta 6 números, con espacios o guion en el medio", () => {
    expect(validarCodigo("123456")).toEqual({ ok: true, codigo: "123456" });
    expect(validarCodigo(" 123 456 ")).toEqual({ ok: true, codigo: "123456" });
    expect(validarCodigo("123-456")).toEqual({ ok: true, codigo: "123456" });
    expect(validarCodigo("012345")).toEqual({ ok: true, codigo: "012345" });
  });
  it("rechaza vacío, letras y largo distinto, diciendo por qué", () => {
    expect(validarCodigo("")).toMatchObject({ ok: false });
    expect(validarCodigo("12a456")).toMatchObject({ ok: false, error: "El código tiene sólo números." });
    expect(validarCodigo("12345")).toMatchObject({ ok: false, error: expect.stringContaining("escribiste 5") });
    expect(validarCodigo("1234567")).toMatchObject({ ok: false });
  });
});

describe("evaluarFin", () => {
  it("sólo está listo con la grabación cerrada y la cola vacía sin pérdidas", () => {
    expect(evaluarFin(fin({}))).toEqual({ tipo: "listo" });
  });
  it("espera mientras graba, sube o queda algo pendiente", () => {
    for (const fase of ["preparando", "iniciando", "grabando", "terminando"] as const) expect(evaluarFin(fin({ fase }))).toEqual({ tipo: "esperar" });
    expect(evaluarFin(fin({ pendientes: 3 }))).toEqual({ tipo: "esperar" });
  });
  it("no apaga si quedaron pedacitos sin subir o el cierre falló", () => {
    expect(evaluarFin(fin({ descartadas: 1 }))).toMatchObject({ tipo: "no-apagar", motivo: expect.stringContaining("un pedacito no se pudo subir") });
    expect(evaluarFin(fin({ descartadas: 4 }))).toMatchObject({ tipo: "no-apagar", motivo: expect.stringContaining("4 pedacitos") });
    expect(evaluarFin(fin({ fase: "terminando", cierreFallido: "sin red" }))).toMatchObject({ tipo: "no-apagar", motivo: expect.stringContaining("sin red") });
  });
});

describe("máquina del apagado", () => {
  const listo = { tipo: "evaluar", fin: { tipo: "listo" }, ahora: 1000 } as const;

  it("marcar la casilla no apaga: espera a que termine todo", () => {
    const e = correr([{ tipo: "marcar" }]);
    expect(e).toEqual({ tipo: "esperando" });
    expect(casillaMarcada(e)).toBe(true);
    expect(correr([{ tipo: "marcar" }, { tipo: "evaluar", fin: { tipo: "esperar" }, ahora: 1000 }, { tipo: "tic", ahora: 10_000_000 }])).toEqual({ tipo: "esperando" });
  });
  it("sin la casilla marcada, terminar no hace nada", () => {
    expect(correr([listo, { tipo: "tic", ahora: 10_000_000 }])).toEqual(APAGADO_INICIAL);
  });
  it("al terminar todo cuenta 60 s y recién al llegar a 0 pasa a apagando", () => {
    const e = correr([{ tipo: "marcar" }, listo]);
    expect(e).toEqual({ tipo: "cuenta", hasta: 1000 + SEGUNDOS_AVISO * 1000 });
    expect(segundosRestantes(e, 1000)).toBe(60);
    expect(segundosRestantes(e, 31_500)).toBe(30);
    expect(transicionApagado(e, { tipo: "tic", ahora: 60_999 })).toBe(e);
    const apagando = transicionApagado(e, { tipo: "tic", ahora: 61_000 });
    expect(apagando).toEqual({ tipo: "apagando", pedido: false });
    expect(transicionApagado(apagando, { tipo: "pedido-enviado" })).toEqual({ tipo: "apagando", pedido: true });
  });
  it("una segunda evaluación no reinicia la cuenta", () => {
    const e = correr([{ tipo: "marcar" }, listo]);
    expect(transicionApagado(e, { ...listo, ahora: 50_000 })).toBe(e);
  });
  it("cancelar desmarca la casilla, y se puede volver a marcar", () => {
    for (const previos of [[], [listo], [listo, { tipo: "tic", ahora: 99_999 }]] as EventoApagado[][]) {
      const e = correr([{ tipo: "marcar" }, ...previos, { tipo: "cancelar" }]);
      expect(e).toEqual({ tipo: "cancelado" });
      expect(casillaMarcada(e)).toBe(false);
    }
    expect(correr([{ tipo: "marcar" }, { tipo: "cancelar" }, { tipo: "marcar" }])).toEqual({ tipo: "esperando" });
  });
  it("si algo falló, pasa a error con el motivo y no apaga", () => {
    const e = correr([{ tipo: "marcar" }, { tipo: "evaluar", fin: { tipo: "no-apagar", motivo: "faltan 2" }, ahora: 0 }, { tipo: "tic", ahora: 10_000_000 }]);
    expect(e).toEqual({ tipo: "error", motivo: "faltan 2" });
    expect(casillaMarcada(e)).toBe(false);
  });
  it("si el ayudante no responde al apagar, queda en error", () => {
    const e = correr([{ tipo: "marcar" }, listo, { tipo: "tic", ahora: 61_000 }, { tipo: "pedido-fallo", motivo: "sin ayudante" }]);
    expect(e).toEqual({ tipo: "error", motivo: "sin ayudante" });
  });
  it("desmarcar vuelve a inactivo antes de apagar", () => {
    expect(correr([{ tipo: "marcar" }, { tipo: "desmarcar" }])).toEqual(APAGADO_INICIAL);
    expect(correr([{ tipo: "marcar" }, listo, { tipo: "desmarcar" }])).toEqual(APAGADO_INICIAL);
  });
});

describe("charla con el ayudante", () => {
  const respuesta = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status });

  it("manda el código a 127.0.0.1 y entiende las respuestas", async () => {
    const f = vi.fn(async () => respuesta(200, { ok: true, version: "1.0.0" }));
    expect(await consultarAyudante("123456", { fetch: f })).toBe("listo");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`http://127.0.0.1:${PUERTO_AYUDANTE}/estado`);
    expect(init.headers).toEqual({ "X-Codigo": "123456" });
    expect(await consultarAyudante("1", { fetch: async () => respuesta(401, { ok: false }) })).toBe("codigo-incorrecto");
    expect(await consultarAyudante("1", { fetch: async () => respuesta(429, { ok: false }) })).toBe("bloqueado");
  });
  it("sin ayudante (o si se cuelga) dice no-detectado sin tirar", async () => {
    expect(await consultarAyudante("123456", { fetch: async () => { throw new TypeError("Failed to fetch"); } })).toBe("no-detectado");
    const colgado = (_u: string, init?: RequestInit) => new Promise<Response>((_, no) => init?.signal?.addEventListener("abort", () => no(new Error("abort"))));
    expect(await consultarAyudante("123456", { fetch: colgado, timeoutMs: 10 })).toBe("no-detectado");
  });
  it("pedir apagar usa POST y avisa si falla", async () => {
    const f = vi.fn(async () => respuesta(200, { ok: true }));
    expect(await pedirAlAyudante("apagar", "123456", { fetch: f })).toEqual({ ok: true });
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe("POST");
    expect(await pedirAlAyudante("apagar", "123456", { fetch: async () => { throw new Error("x"); } })).toMatchObject({ ok: false });
  });
});

describe("ayudante-apagado.ps1 (leído como texto)", () => {
  const ruta = path.resolve(__dirname, "../../../public/digitalizacion/ayudante-apagado.ps1");
  const crudo = readFileSync(ruta);
  const texto = crudo.toString("utf8");

  it("tiene BOM UTF-8: sin él, Windows PowerShell 5.1 rompe los acentos", () => {
    expect([...crudo.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
  it("escucha sólo en 127.0.0.1 y en el puerto acordado", () => {
    expect(texto).toContain(`$Puerto = ${PUERTO_AYUDANTE}`);
    expect(texto).toMatch(/TcpListener\(\[System\.Net\.IPAddress\]::Loopback, \$Puerto\)/);
    expect(texto).not.toMatch(/IPAddress\]::(Any|IPv6Any)/);
    expect(texto).not.toMatch(/Prefixes\.Add|http:\/\/[+*]:/);
  });
  it("sólo acepta los orígenes de FOTOFFICE", () => {
    const lista = texto.match(/\$OrigenesPermitidos = @\(([^)]*)\)/)?.[1];
    expect(lista?.split(",").map((s) => s.trim().replace(/'/g, ""))).toEqual(["https://fotoffice.com", "https://www.fotoffice.com", "http://localhost:3010"]);
    expect(texto).toContain("$OrigenesPermitidos -notcontains $origen");
  });
  it("exige el código, responde la preflight de red privada y limita pedidos", () => {
    expect(texto).toContain("$codigoPedido -cne $codigo");
    expect(texto).toContain("$base['Access-Control-Allow-Private-Network'] = 'true'");
    expect(texto).toContain("$base['Access-Control-Allow-Headers'] = 'X-Codigo'");
    expect(texto).toMatch(/\$MaxPedidosPorMinuto = \d+/);
  });
  it("apaga con margen de 30 s y cancela con shutdown /a", () => {
    expect(texto).toContain("@('/s', '/t', '30', '/c', 'FOTOFFICE: grabación subida')");
    expect(texto).toContain("@('/a')");
  });
});
