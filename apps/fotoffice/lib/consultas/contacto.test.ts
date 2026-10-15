import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@repo/db";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const { contactoParaConsulta, partirNombre } = await import("./contacto");

type Tx = Prisma.TransactionClient;
const enTx = <T>(fn: (tx: Tx) => Promise<T>) =>
  (B.prisma.$transaction as (f: (tx: unknown) => Promise<T>) => Promise<T>)((tx) => fn(tx as Tx));

const ANA = { userId: 7, label: "Ana" };

function cliente(id: string, extra: Record<string, unknown>) {
  return B.agregar("client", { id, workspaceId: "ws-1", clientNumber: Number(id.replace(/\D/g, "")) || 99, ...extra });
}

beforeEach(() => B.vaciar());

describe("partirNombre", () => {
  it("separa la primera palabra del resto", () => {
    expect(partirNombre("  Ana   María Pérez ")).toEqual({ firstName: "Ana", lastName: "María Pérez" });
    expect(partirNombre("Ana")).toEqual({ firstName: "Ana", lastName: null });
  });
});

describe("contactoParaConsulta", () => {
  it("encuentra por correo sin distinguir mayúsculas", async () => {
    cliente("c1", { email: "Ana@Mail.com", createdAt: new Date("2026-01-01") });
    const r = await enTx((tx) => contactoParaConsulta(tx, "ws-1", { nombre: "Ana", email: " ana@MAIL.com " }));
    expect(r).toEqual({ clientId: "c1", creado: false, posibleDuplicado: false });
    expect(B.datos.client).toHaveLength(1);
    expect(B.datos.fotofficeContactoPerfil).toHaveLength(0);
  });

  it("encuentra por teléfono normalizado", async () => {
    cliente("c1", { phone: "3411234567" });
    const r = await enTx((tx) => contactoParaConsulta(tx, "ws-1", { nombre: "Ana", telefono: "341 123-4567" }));
    expect(r).toEqual({ clientId: "c1", creado: false, posibleDuplicado: false });
  });

  it("el correo gana sobre el teléfono (otro con ese teléfono no cuenta como duplicado)", async () => {
    cliente("c1", { email: "ana@mail.com", createdAt: new Date("2026-01-01") });
    cliente("c2", { phone: "3411234567", createdAt: new Date("2026-05-01") });
    const r = await enTx((tx) =>
      contactoParaConsulta(tx, "ws-1", { nombre: "Ana", email: "ana@mail.com", telefono: "3411234567" }),
    );
    expect(r).toEqual({ clientId: "c1", creado: false, posibleDuplicado: false });
  });

  it("posible duplicado se mide con el criterio que eligió: correo único, aunque otro coincida por teléfono", async () => {
    cliente("c1", { email: "ana@mail.com", phone: "3410000000", createdAt: new Date("2026-01-01") });
    cliente("c2", { phone: "3411234567", createdAt: new Date("2026-05-01") });
    cliente("c3", { phone: "3411234567", createdAt: new Date("2026-06-01") });
    const porCorreo = await enTx((tx) =>
      contactoParaConsulta(tx, "ws-1", { nombre: "Ana", email: "ana@mail.com", telefono: "3411234567" }),
    );
    expect(porCorreo).toEqual({ clientId: "c1", creado: false, posibleDuplicado: false });
    // Sin coincidencia por correo, decide el teléfono: dos clientes con ese teléfono.
    const porTelefono = await enTx((tx) =>
      contactoParaConsulta(tx, "ws-1", { nombre: "Ana", email: "nadie@mail.com", telefono: "3411234567" }),
    );
    expect(porTelefono).toEqual({ clientId: "c3", creado: false, posibleDuplicado: true });
  });

  it("modo correo (formulario web): el teléfono no empareja; crea uno nuevo y le guarda el teléfono", async () => {
    cliente("c1", { email: "ana@mail.com", phone: "3411234567" });
    const r = await enTx((tx) =>
      contactoParaConsulta(
        tx, "ws-1", { nombre: "Intrusa", email: "otra@mail.com", telefono: "341 123-4567" }, undefined, { coincidir: "correo" },
      ),
    );
    expect(r.creado).toBe(true);
    expect(r.clientId).not.toBe("c1");
    expect(B.datos.client.find((c) => c.id === r.clientId)).toMatchObject({ email: "otra@mail.com", phone: "3411234567" });
    expect(B.datos.fotofficeContactoPerfil).toEqual([expect.objectContaining({ clientId: r.clientId, category: "CONTACTO" })]);
  });

  it("modo correo: el correo sigue emparejando y el cliente existente no cambia", async () => {
    cliente("c1", { email: "ana@mail.com", phone: "3410000000" });
    const r = await enTx((tx) =>
      contactoParaConsulta(tx, "ws-1", { nombre: "Ana", email: "ANA@mail.com", telefono: "3419999999" }, undefined, {
        coincidir: "correo",
      }),
    );
    expect(r).toEqual({ clientId: "c1", creado: false, posibleDuplicado: false });
    expect(B.datos.client[0]!.phone).toBe("3410000000");
  });

  it("modo manual (por defecto) sigue emparejando por teléfono", async () => {
    cliente("c1", { email: "ana@mail.com", phone: "3411234567" });
    const r = await enTx((tx) =>
      contactoParaConsulta(tx, "ws-1", { nombre: "Ana", email: "otra@mail.com", telefono: "341 123-4567" }, undefined, {
        coincidir: "correo-o-telefono",
      }),
    );
    expect(r).toEqual({ clientId: "c1", creado: false, posibleDuplicado: false });
  });

  it("con varios por correo elige el más reciente y avisa posible duplicado", async () => {
    cliente("c1", { email: "ana@mail.com", createdAt: new Date("2026-01-01") });
    cliente("c2", { email: "ANA@mail.com", createdAt: new Date("2026-06-01") });
    cliente("c3", { email: "ana@mail.com", createdAt: new Date("2026-03-01") });
    const r = await enTx((tx) => contactoParaConsulta(tx, "ws-1", { nombre: "Ana", email: "ana@mail.com" }));
    expect(r).toEqual({ clientId: "c2", creado: false, posibleDuplicado: true });
  });

  it("si no encuentra, crea el cliente con número, historial y perfil CONTACTO", async () => {
    cliente("c4", { email: "otra@mail.com" });
    const r = await enTx((tx) =>
      contactoParaConsulta(tx, "ws-1", { nombre: "Ana María Pérez", email: "Ana@Mail.com", telefono: "(341) 555-0000" }, ANA),
    );
    expect(r.creado).toBe(true);
    expect(r.posibleDuplicado).toBe(false);
    const nuevo = B.datos.client.find((c) => c.id === r.clientId)!;
    expect(nuevo).toMatchObject({
      workspaceId: "ws-1", firstName: "Ana", lastName: "María Pérez", email: "ana@mail.com", phone: "3415550000",
      clientNumber: 5, createdByUserId: 7,
    });
    expect(B.datos.fotofficeContactoPerfil).toEqual([
      expect.objectContaining({ workspaceId: "ws-1", clientId: r.clientId, category: "CONTACTO" }),
    ]);
    expect(B.datos.clientAudit).toEqual([
      expect.objectContaining({ workspaceId: "ws-1", clientId: r.clientId, action: "CREATED", actorLabel: "Ana" }),
    ]);
  });

  it("crea también sin correo ni teléfono", async () => {
    const r = await enTx((tx) => contactoParaConsulta(tx, "ws-1", { nombre: "Juan" }));
    expect(r.creado).toBe(true);
    expect(B.datos.client[0]).toMatchObject({ firstName: "Juan", email: null, phone: null });
  });

  it("no mira clientes de otro workspace", async () => {
    B.agregar("client", { id: "x1", workspaceId: "ws-2", clientNumber: 1, email: "ana@mail.com", phone: "3411234567" });
    const r = await enTx((tx) =>
      contactoParaConsulta(tx, "ws-1", { nombre: "Ana", email: "ana@mail.com", telefono: "3411234567" }),
    );
    expect(r.creado).toBe(true);
    expect(r.clientId).not.toBe("x1");
    expect(B.datos.client.find((c) => c.id === r.clientId)?.workspaceId).toBe("ws-1");
  });

  it("corre en la transacción de quien llama: si el alta falla, no queda el contacto", async () => {
    await expect(
      enTx(async (tx) => {
        await contactoParaConsulta(tx, "ws-1", { nombre: "Ana", email: "ana@mail.com" });
        throw new Error("falló el alta");
      }),
    ).rejects.toThrow("falló el alta");
    expect(B.datos.client).toHaveLength(0);
    expect(B.datos.fotofficeContactoPerfil).toHaveLength(0);
    expect(B.datos.clientAudit).toHaveLength(0);
  });

  it("exige nombre", async () => {
    await expect(enTx((tx) => contactoParaConsulta(tx, "ws-1", { nombre: "   ", email: "a@b.com" }))).rejects.toThrow(
      "Falta el nombre",
    );
    await expect(enTx((tx) => contactoParaConsulta(tx, "ws-1", { nombre: "a".repeat(201) }))).rejects.toThrow("largo");
  });
});

describe("contactoParaConsulta: bloqueo antes de buscar", () => {
  /** Lo que pasa, en orden: cada bloqueo (con su clave) y cada búsqueda de clientes. */
  function registrar(): string[] {
    const pasos: string[] = [];
    B.ganchos.alEjecutarSql = (texto, valores) => {
      if (texto.includes("pg_advisory_xact_lock")) pasos.push(`lock:${String(valores[0])}`);
    };
    const original = B.tablas.client.findMany;
    B.tablas.client.findMany = async (a) => {
      pasos.push("buscar");
      return original(a);
    };
    return pasos;
  }

  it("con correo y teléfono: bloquea por correo (en minúsculas) y por teléfono, antes de buscar", async () => {
    const pasos = registrar();
    await enTx((tx) => contactoParaConsulta(tx, "ws-1", { nombre: "Ana", email: " Ana@Mail.COM ", telefono: "341 123-4567" }));
    expect(pasos[0]).toBe("lock:fotoffice-contacto:ws-1:ana@mail.com");
    expect(pasos[1]).toBe("lock:fotoffice-contacto-tel:ws-1:3411234567");
    expect(pasos.indexOf("buscar")).toBe(2);
  });

  it("formulario web (sólo correo): bloquea por correo, no por teléfono; sin datos, no bloquea", async () => {
    const pasos = registrar();
    await enTx((tx) => contactoParaConsulta(tx, "ws-1", { nombre: "Ana", email: "ana@mail.com", telefono: "3411234567" }, undefined, { coincidir: "correo" }));
    expect(pasos.filter((p) => p.startsWith("lock:"))).toEqual(["lock:fotoffice-contacto:ws-1:ana@mail.com"]);
    pasos.length = 0;
    await enTx((tx) => contactoParaConsulta(tx, "ws-1", { nombre: "Sin datos" }));
    expect(pasos.filter((p) => p.startsWith("lock:"))).toEqual([]);
  });
});
