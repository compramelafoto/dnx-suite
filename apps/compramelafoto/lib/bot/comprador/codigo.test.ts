import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  code: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  order: { count: vi.fn() },
  sendEmail: vi.fn(),
  marcarVerificada: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { botEmailCode: m.code, order: m.order } }));
vi.mock("@/emails/send", () => ({ sendEmail: m.sendEmail }));
vi.mock("./store", () => ({ marcarVerificada: m.marcarVerificada }));
import {
  CODIGO_MAX_INTENTOS,
  CODIGO_TTL_MS,
  generarCodigo,
  hashCodigo,
  pedirCodigo,
  PREFIJO_SENUELO,
  RESPUESTA_CODIGO,
  VERIFICACION_DURA_MS,
  verificarCodigo,
} from "./codigo";

beforeEach(() => {
  m.code.count.mockReset().mockResolvedValue(0);
  m.code.create.mockReset().mockResolvedValue({ id: "k1" });
  m.code.findFirst.mockReset();
  m.code.updateMany.mockReset().mockResolvedValue({ count: 1 });
  m.order.count.mockReset().mockResolvedValue(1);
  m.sendEmail.mockReset().mockResolvedValue({ success: true });
  m.marcarVerificada.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const pedido = { conversationId: "c1", ipHash: "ip1", email: " Juana@Gmail.com " };

describe("generarCodigo y hashCodigo", () => {
  it("genera 6 dígitos", () => {
    for (let i = 0; i < 50; i++) expect(generarCodigo()).toMatch(/^\d{6}$/);
  });
  it("el hash depende de la conversación y no contiene el código", () => {
    const h = hashCodigo("c1", "123456");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("123456");
    expect(hashCodigo("c2", "123456")).not.toBe(h);
  });
});

describe("pedirCodigo", () => {
  it("mail que nunca compró → mensaje genérico, fila señuelo (cuenta para los topes) y sin mail", async () => {
    m.order.count.mockResolvedValue(0);
    const antes = Date.now();
    const r = await pedirCodigo(pedido);
    expect(r).toEqual({ mensaje: RESPUESTA_CODIGO, enviado: false });
    expect(m.sendEmail).not.toHaveBeenCalled();
    expect(m.order.count).toHaveBeenCalledWith({ where: { buyerEmail: { equals: "juana@gmail.com", mode: "insensitive" }, isTest: false } });
    const data = m.code.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ email: "juana@gmail.com", conversationId: "c1", ipHash: "ip1" });
    expect(data.codeHash.startsWith(PREFIJO_SENUELO)).toBe(true);
    expect(data.expiresAt.getTime() - antes).toBeGreaterThanOrEqual(CODIGO_TTL_MS - 1000);
    // Ningún código de 6 dígitos produce ese valor: es al azar y no es hex.
    expect(data.codeHash).not.toMatch(/^[0-9a-f]{64}$/);
    // Dos señuelos nunca repiten valor.
    await pedirCodigo(pedido);
    expect(m.code.create.mock.calls[1]![0].data.codeHash).not.toBe(data.codeHash);
  });

  it("mail con compras → mismo mensaje exacto, fila con hash y mail con el código", async () => {
    const antes = Date.now();
    const r = await pedirCodigo(pedido);
    expect(r).toEqual({ mensaje: RESPUESTA_CODIGO, enviado: true });
    const data = m.code.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ email: "juana@gmail.com", conversationId: "c1", ipHash: "ip1" });
    expect(data.expiresAt.getTime() - antes).toBeGreaterThanOrEqual(CODIGO_TTL_MS - 1000);
    expect(data.expiresAt.getTime() - antes).toBeLessThanOrEqual(CODIGO_TTL_MS + 1000);
    const envio = m.sendEmail.mock.calls[0]![0];
    expect(envio).toMatchObject({ to: "juana@gmail.com", subject: "Tu código de CompraMeLaFoto", templateKey: "BOT_CODIGO" });
    const codigo = /<strong>(\d{6})<\/strong>/.exec(envio.html)![1]!;
    expect(data.codeHash).not.toBe(codigo);
    expect(data.codeHash).toBe(hashCodigo("c1", codigo));
    expect(envio.html).toContain("Vence en 10 minutos.");
    expect(envio.html).toContain("No se lo compartas a nadie");
    expect(envio.html).toContain("Si no lo pediste, ignorá este mail.");
  });

  it("mail inválido → genérico sin consultar nada", async () => {
    expect(await pedirCodigo({ ...pedido, email: "no-es-mail" })).toEqual({ mensaje: RESPUESTA_CODIGO, enviado: false });
    expect(m.order.count).not.toHaveBeenCalled();
    expect(m.sendEmail).not.toHaveBeenCalled();
  });

  it("3 códigos en la hora para el mail → genérico sin enviar", async () => {
    m.code.count.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => ("email" in where ? 3 : 0));
    expect(await pedirCodigo(pedido)).toEqual({ mensaje: RESPUESTA_CODIGO, enviado: false });
    expect(m.code.create).not.toHaveBeenCalled();
    expect(m.sendEmail).not.toHaveBeenCalled();
    const q = m.code.count.mock.calls.find((c) => "email" in c[0].where)![0];
    expect(q.where.email).toBe("juana@gmail.com");
    expect(Date.now() - q.where.createdAt.gte.getTime()).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
  });

  it("3 códigos en la hora para la IP → genérico sin enviar", async () => {
    m.code.count.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => (where.ipHash === "ip1" ? 3 : 0));
    expect(await pedirCodigo(pedido)).toEqual({ mensaje: RESPUESTA_CODIGO, enviado: false });
    expect(m.sendEmail).not.toHaveBeenCalled();
  });

  it("sendEmail lanza o falla → igual devuelve el genérico", async () => {
    m.sendEmail.mockRejectedValueOnce(new Error("resend caído"));
    expect((await pedirCodigo(pedido)).mensaje).toBe(RESPUESTA_CODIGO);
    m.sendEmail.mockResolvedValueOnce({ success: false, error: "x" });
    expect((await pedirCodigo(pedido)).mensaje).toBe(RESPUESTA_CODIGO);
    expect(console.error).toHaveBeenCalledTimes(2);
    const salida = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(salida).not.toContain("juana@gmail.com");
  });
});

describe("verificarCodigo", () => {
  const fila = (extra: Record<string, unknown> = {}) => ({
    id: "k1", email: "juana@gmail.com", conversationId: "c1", codeHash: hashCodigo("c1", "123456"),
    attempts: 0, expiresAt: new Date(Date.now() + 60_000), ...extra,
  });
  const verif = { conversationId: "c1", guestKey: "g1", codigo: "123456" };

  it("busca el último código sin usar del navegador (guestKey), no sólo de la conversación", async () => {
    m.code.findFirst.mockResolvedValue(null);
    const r = await verificarCodigo(verif);
    expect(r).toEqual({ ok: false, motivo: "sin_codigo", mensaje: "Primero pedime un código con tu mail." });
    const q = m.code.findFirst.mock.calls[0]![0];
    expect(q.where).toMatchObject({ usedAt: null, conversation: { is: { guestKey: "g1", audience: "BUYER" } } });
    expect(q.orderBy).toEqual({ createdAt: "desc" });
  });

  it("correcto → marca verificada 24 h y devuelve el mail", async () => {
    m.code.findFirst.mockResolvedValue(fila());
    const antes = Date.now();
    expect(await verificarCodigo(verif)).toEqual({ ok: true, email: "juana@gmail.com" });
    expect(m.code.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "k1", usedAt: null, attempts: { lt: CODIGO_MAX_INTENTOS } }, data: { attempts: { increment: 1 } },
    });
    expect(m.code.updateMany).toHaveBeenNthCalledWith(2, { where: { id: "k1", usedAt: null }, data: { usedAt: expect.any(Date) } });
    const [conv, email, hasta] = m.marcarVerificada.mock.calls[0]!;
    expect(conv).toBe("c1");
    expect(email).toBe("juana@gmail.com");
    expect((hasta as Date).getTime() - antes).toBeGreaterThanOrEqual(VERIFICACION_DURA_MS - 1000);
    expect((hasta as Date).getTime() - antes).toBeLessThanOrEqual(VERIFICACION_DURA_MS + 1000);
  });

  it("código pedido en una conversación anterior → se hashea con la de la fila y verifica la actual", async () => {
    m.code.findFirst.mockResolvedValue(fila({ conversationId: "c-vieja", codeHash: hashCodigo("c-vieja", "123456") }));
    expect(await verificarCodigo({ ...verif, conversationId: "c-nueva" })).toEqual({ ok: true, email: "juana@gmail.com" });
    expect(m.marcarVerificada.mock.calls[0]![0]).toBe("c-nueva");
  });

  it('" 12 34 56 " se acepta como 123456', async () => {
    m.code.findFirst.mockResolvedValue(fila());
    expect(await verificarCodigo({ ...verif, codigo: " 12 34 56 " })).toEqual({ ok: true, email: "juana@gmail.com" });
  });

  it("menos de 6 dígitos → incorrecto sin consultar ni sumar intento", async () => {
    const r = await verificarCodigo({ ...verif, codigo: "12345" });
    expect(r).toMatchObject({ ok: false, motivo: "incorrecto" });
    expect(m.code.findFirst).not.toHaveBeenCalled();
  });

  it("incorrecto reserva (suma) un intento antes de comparar", async () => {
    m.code.findFirst.mockResolvedValue(fila());
    expect(await verificarCodigo({ ...verif, codigo: "654321" })).toEqual({
      ok: false, motivo: "incorrecto", mensaje: "Ese código no coincide. Revisalo y probá de nuevo.",
    });
    expect(m.code.updateMany).toHaveBeenCalledTimes(1);
    expect(m.code.updateMany).toHaveBeenCalledWith({
      where: { id: "k1", usedAt: null, attempts: { lt: CODIGO_MAX_INTENTOS } },
      data: { attempts: { increment: 1 } },
    });
    expect(m.marcarVerificada).not.toHaveBeenCalled();
  });

  it("el 5.º incorrecto responde intentos", async () => {
    m.code.findFirst.mockResolvedValue(fila({ attempts: CODIGO_MAX_INTENTOS - 1 }));
    expect(await verificarCodigo({ ...verif, codigo: "654321" })).toEqual({
      ok: false, motivo: "intentos", mensaje: "Hubo demasiados intentos con ese código. Pedime uno nuevo.",
    });
  });

  it("si la reserva del intento no entra (tope ya alcanzado en paralelo) → intentos, aunque el código sea correcto", async () => {
    m.code.findFirst.mockResolvedValue(fila({ attempts: 0 }));
    m.code.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await verificarCodigo(verif)).toMatchObject({ ok: false, motivo: "intentos" });
    expect(m.code.updateMany).toHaveBeenCalledTimes(1);
    expect(m.marcarVerificada).not.toHaveBeenCalled();
  });

  it("ráfaga de 8 verificaciones en paralelo: sólo 5 llegan a comparar y el correcto llega tarde", async () => {
    // Simula la fila en la base: todas leen attempts 0, pero el updateMany con `attempts < 5` es atómico.
    let attempts = 0;
    m.code.findFirst.mockResolvedValue(fila({ attempts: 0 }));
    m.code.updateMany.mockImplementation(async ({ where, data }: { where: { attempts?: { lt: number } }; data: Record<string, unknown> }) => {
      if (data.attempts) {
        if (attempts >= where.attempts!.lt) return { count: 0 };
        attempts += 1;
        return { count: 1 };
      }
      return { count: 1 };
    });
    const malos = Array.from({ length: 7 }, (_, i) => verificarCodigo({ ...verif, codigo: `00000${i}` }));
    const r = await Promise.all([...malos, verificarCodigo(verif)]);
    expect(attempts).toBe(CODIGO_MAX_INTENTOS);
    expect(r.filter((x) => !x.ok && x.motivo === "intentos")).toHaveLength(3);
    expect(r[7]).toMatchObject({ ok: false, motivo: "intentos" });
    expect(m.marcarVerificada).not.toHaveBeenCalled();
  });

  it("con 5 intentos ya hechos no deja probar ni el correcto", async () => {
    m.code.findFirst.mockResolvedValue(fila({ attempts: CODIGO_MAX_INTENTOS }));
    expect(await verificarCodigo(verif)).toMatchObject({ ok: false, motivo: "intentos" });
    expect(m.code.updateMany).not.toHaveBeenCalled();
    expect(m.marcarVerificada).not.toHaveBeenCalled();
  });

  it("vencido", async () => {
    m.code.findFirst.mockResolvedValue(fila({ expiresAt: new Date(Date.now() - 1) }));
    expect(await verificarCodigo(verif)).toEqual({ ok: false, motivo: "vencido", mensaje: "Ese código venció. Pedime uno nuevo." });
    expect(m.marcarVerificada).not.toHaveBeenCalled();
  });

  it("doble verificación concurrente (updateMany de uso count 0) → no marca dos veces y responde usado", async () => {
    m.code.findFirst.mockResolvedValue(fila());
    let usos = 0;
    m.code.updateMany.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      data.usedAt ? { count: usos++ === 0 ? 1 : 0 } : { count: 1 });
    const [a, b] = await Promise.all([verificarCodigo(verif), verificarCodigo(verif)]);
    expect(m.marcarVerificada).toHaveBeenCalledTimes(1);
    expect([a, b]).toContainEqual({ ok: true, email: "juana@gmail.com" });
    expect([a, b]).toContainEqual({ ok: false, motivo: "usado", mensaje: "Ese código ya se usó. Si hace falta, pedime uno nuevo." });
  });

  it("señuelo: ni siquiera un hash forjado que coincida verifica", async () => {
    m.code.findFirst.mockResolvedValue(fila({ codeHash: `${PREFIJO_SENUELO}${hashCodigo("c1", "123456")}` }));
    expect(await verificarCodigo(verif)).toMatchObject({ ok: false, motivo: "incorrecto" });
    expect(m.marcarVerificada).not.toHaveBeenCalled();
  });
});

describe("pedir y verificar no revelan si el mail compró", () => {
  /** Simula la tabla de códigos en memoria: lo que crea `pedirCodigo` es lo que lee `verificarCodigo`. */
  async function recorrido(compras: number): Promise<unknown[]> {
    const filas: Array<Record<string, unknown>> = [];
    m.order.count.mockResolvedValue(compras);
    m.code.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      filas.push({ id: `k${filas.length}`, attempts: 0, usedAt: null, ...data });
      return filas.at(-1);
    });
    m.code.findFirst.mockImplementation(async () => filas.filter((f) => f.usedAt === null).at(-1) ?? null);
    m.code.updateMany.mockImplementation(async ({ where, data }: { where: { id: string; attempts?: { lt: number } }; data: Record<string, unknown> }) => {
      const f = filas.find((x) => x.id === where.id)!;
      if (data.attempts) {
        if ((f.attempts as number) >= where.attempts!.lt) return { count: 0 };
        f.attempts = (f.attempts as number) + 1;
        return { count: 1 };
      }
      f.usedAt = data.usedAt;
      return { count: 1 };
    });
    const salida: unknown[] = [await verificarCodigo({ conversationId: "c1", guestKey: "g1", codigo: "000000" })];
    salida.push(await pedirCodigo({ conversationId: "c1", ipHash: "ip1", email: "x@y.com" }).then((r) => r.mensaje));
    // Siete intentos con códigos que no son el real (el real, si existe, se excluye: nadie fuera del mail lo conoce).
    const real = compras > 0 ? /<strong>(\d{6})<\/strong>/.exec(m.sendEmail.mock.calls.at(-1)![0].html)![1] : null;
    const probados = ["000000", "111111", "222222", "333333", "444444", "555555", "666666", "777777"].filter((c) => c !== real).slice(0, 7);
    for (const codigo of probados) salida.push(await verificarCodigo({ conversationId: "c1", guestKey: "g1", codigo }));
    return salida;
  }

  it("con compras y sin compras, las respuestas son idénticas paso a paso", async () => {
    const conCompras = await recorrido(2);
    expect(m.sendEmail).toHaveBeenCalledTimes(1);
    m.sendEmail.mockClear();
    const sinCompras = await recorrido(0);
    expect(m.sendEmail).not.toHaveBeenCalled();
    expect(sinCompras).toEqual(conCompras);
    expect(m.marcarVerificada).not.toHaveBeenCalled();
  });

  it("los señuelos cuentan para el tope por IP: el 4.º mail sin compras de la hora no crea fila", async () => {
    m.order.count.mockResolvedValue(0);
    let filasDeLaIp = 0;
    m.code.count.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => ("ipHash" in where ? filasDeLaIp : 0));
    m.code.create.mockImplementation(async () => { filasDeLaIp += 1; return {}; });
    for (const email of ["a@x.com", "b@x.com", "c@x.com", "d@x.com"]) await pedirCodigo({ conversationId: "c1", ipHash: "ip1", email });
    expect(m.code.create).toHaveBeenCalledTimes(3);
    expect(m.order.count).toHaveBeenCalledTimes(3);
  });
});
