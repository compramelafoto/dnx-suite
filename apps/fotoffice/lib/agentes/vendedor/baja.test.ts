import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signUnsubscribeToken } from "@/lib/mailing/unsubscribe-token";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const { darDeBajaVendedor, leerBajaVendedor } = await import("./baja");
const { AMBITO_BAJA_VENDEDOR } = await import("./correo");
const { direccionBloqueada } = await import("./bloqueos");

const SECRETO = "secreto-de-prueba";
const contacto = (email: string, extra: Record<string, unknown> = {}) =>
  B.agregar("dnxContacto", { tipo: "FOTOGRAFO", nombre: email, creadoPor: "BUSCADOR", email, claveEmail: email.toLowerCase(), ...extra }) as { id: string };

beforeEach(() => {
  B.vaciar();
  vi.stubEnv("FOTOFFICE_MAILING_SECRET", SECRETO);
});
afterEach(() => vi.unstubAllEnvs());

describe("baja del Vendedor", () => {
  it("la baja pasa a NO_CONTACTAR todos los contactos con ese email y cierra sus hilos", async () => {
    const a = contacto("ana@estudio.com", { estado: "CONTACTADO" });
    const b = contacto("Ana@Estudio.com");
    const otro = contacto("otro@estudio.com");
    B.agregar("dnxVendedorHilo", { contactoId: a.id, grupo: "FOTOGRAFO:GENERAL", token: "t1", estado: "ENVIADO" });
    B.agregar("dnxVendedorHilo", { contactoId: otro.id, grupo: "FOTOGRAFO:GENERAL", token: "t2", estado: "ENVIADO" });

    const token = signUnsubscribeToken({ workspaceId: AMBITO_BAJA_VENDEDOR, email: "ANA@estudio.com" }, SECRETO);
    expect(leerBajaVendedor(token)).toEqual({ email: "ana@estudio.com" });
    expect(await darDeBajaVendedor(token)).toBe("OK");

    const estados = Object.fromEntries(B.datos.dnxContacto.map((c) => [c.id, c.estado]));
    expect(estados).toEqual({ [a.id]: "NO_CONTACTAR", [b.id]: "NO_CONTACTAR", [otro.id]: "NUEVO" });
    const hilos = Object.fromEntries(B.datos.dnxVendedorHilo.map((h) => [h.contactoId, [h.estado, h.cierre]]));
    expect(hilos).toEqual({ [a.id]: ["BAJA", "BAJA"], [otro.id]: ["ENVIADO", null] });
    expect(B.datos.dnxContactoEvento.filter((e) => e.tipo === "ESTADO").every((e) => e.autor === "VENDEDOR")).toBe(true);

    // Dos veces (el POST de un clic y después la página) no rompe nada.
    expect(await darDeBajaVendedor(token)).toBe("OK");
  });

  it("la baja de una casilla sin contacto queda anotada y bloquea el envío siguiente", async () => {
    const token = signUnsubscribeToken({ workspaceId: AMBITO_BAJA_VENDEDOR, email: "Info@Club.com" }, SECRETO);
    expect(await darDeBajaVendedor(token)).toBe("OK");
    expect(await darDeBajaVendedor(token)).toBe("OK");
    expect(B.datos.dnxVendedorBaja.map((b) => b.email)).toEqual(["info@club.com"]);
    expect(await direccionBloqueada("info@club.com")).toBe(true);
    expect(await direccionBloqueada("otra@club.com")).toBe(false);
  });

  it("un token de baja de una institución no sirve", async () => {
    const a = contacto("ana@estudio.com");
    const token = signUnsubscribeToken({ workspaceId: "ws_sfpr", email: "ana@estudio.com" }, SECRETO);
    expect(leerBajaVendedor(token)).toBeNull();
    expect(await darDeBajaVendedor(token)).toBe("INVALIDO");
    expect(await darDeBajaVendedor(null)).toBe("INVALIDO");
    expect(await darDeBajaVendedor("basura")).toBe("INVALIDO");
    expect(B.datos.dnxContacto.find((c) => c.id === a.id)!.estado).toBe("NUEVO");
  });
});
