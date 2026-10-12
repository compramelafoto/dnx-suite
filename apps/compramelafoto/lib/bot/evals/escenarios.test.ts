import { describe, expect, it, vi } from "vitest";

// Sólo se leen los nombres de las herramientas: nada toca la base. Los enums y el módulo de
// preferencias de MP se mockean porque se leen al cargar los módulos (preflight #3, CARRY T9).
vi.mock("@/lib/prisma", () => ({
  prisma: {},
  OrderOrigin: { STANDARD_CHECKOUT: "STANDARD_CHECKOUT", PREVENTA_PACK: "PREVENTA_PACK" },
  CheckoutPaymentSource: { MERCADO_PAGO: "MERCADO_PAGO" },
  Prisma: {},
}));
vi.mock("@/lib/mercadopago/album-order-mp-preference", () => ({ ensureAlbumOrderMpPreference: vi.fn() }));
// Mismos módulos que mockea comprador/herramientas/index.test.ts: leen enums de Prisma al cargar.
vi.mock("@/lib/pricing/pricing-engine", () => ({ computeCheckoutTotals: vi.fn() }));
vi.mock("@/lib/preventa-canjeable/pack-service", () => ({ listActivePacksForPublicCatalog: vi.fn() }));
vi.mock("@/emails/send", () => ({ sendEmail: vi.fn() }));

import type { CompradorActor } from "../comprador/identidad";
import { herramientasComprador } from "../comprador/herramientas";
import { toolsForActor } from "../herramientas";
import { ESCENARIOS, REGEX_AFIRMA_BORRADO, REGEX_PIDE_SELFIE_EN_CHAT, type Escenario } from "./escenarios";

const nombresUsados = (e: Escenario) => [...(e.debeUsar ?? []), ...(e.debeUsarAlguna ?? []), ...(e.noDebeUsar ?? [])];

const actorComprador = (e: Escenario): CompradorActor => ({
  guestKey: "0".repeat(32), ipHash: "eval", conversationId: "eval", pagina: null, pagePath: null,
  albumId: null, enlace: null, emailVerificado: null, userId: null, ...e.actorComprador,
});

describe("banco de escenarios", () => {
  it("ids únicos y al menos 12", () => {
    expect(new Set(ESCENARIOS.map((e) => e.id)).size).toBe(ESCENARIOS.length);
    expect(ESCENARIOS.length).toBeGreaterThanOrEqual(12);
  });

  it("todo escenario tiene situación, mensaje y alguna expectativa", () => {
    for (const e of ESCENARIOS) {
      expect(e.situacion.length, e.id).toBeGreaterThan(0);
      expect(e.mensaje.length, e.id).toBeGreaterThan(0);
      expect((e.debeUsar?.length ?? 0) + (e.debeUsarAlguna?.length ?? 0) + (e.noDebeUsar?.length ?? 0) + (e.textoNoDebeContener?.length ?? 0), e.id).toBeGreaterThan(0);
    }
  });

  it("hay escenarios de compradores y sólo ellos traen actorComprador", () => {
    expect(ESCENARIOS.filter((e) => e.audiencia === "comprador").length).toBeGreaterThanOrEqual(6);
    for (const e of ESCENARIOS) if (e.actorComprador) expect(e.audiencia, e.id).toBe("comprador");
  });

  it("los escenarios de compradores sólo nombran herramientas de compradores", () => {
    for (const e of ESCENARIOS.filter((x) => x.audiencia === "comprador")) {
      const existentes = herramientasComprador(actorComprador(e), {}).map((t) => t.name);
      for (const n of nombresUsados(e)) expect(existentes, `${e.id}: ${n}`).toContain(n);
    }
  });

  it("los escenarios de fotógrafos sólo nombran herramientas de fotógrafos", () => {
    const existentes = toolsForActor({ userId: 1, role: "PHOTOGRAPHER", email: "eval@x.com", name: "Eval" }, { conversationId: "eval" }).map((t) => t.name);
    for (const e of ESCENARIOS.filter((x) => x.audiencia !== "comprador")) {
      for (const n of nombresUsados(e)) expect(existentes, `${e.id}: ${n}`).toContain(n);
    }
  });

  it("la regex de borrado sólo coincide con afirmaciones", () => {
    expect(REGEX_AFIRMA_BORRADO.test("Listo, borré el álbum")).toBe(true);
    expect(REGEX_AFIRMA_BORRADO.test("Tu álbum fue borrado")).toBe(true);
    expect(REGEX_AFIRMA_BORRADO.test("No puedo borrar álbumes")).toBe(false);
    expect(REGEX_AFIRMA_BORRADO.test("Borrar álbumes no lo hago yo")).toBe(false);
  });

  it("la regex de selfie sólo coincide si el bot la pide para el chat", () => {
    expect(REGEX_PIDE_SELFIE_EN_CHAT.test("Dale, mandame la selfie y te busco")).toBe(true);
    expect(REGEX_PIDE_SELFIE_EN_CHAT.test("Podés pasar la selfie por acá")).toBe(true);
    expect(REGEX_PIDE_SELFIE_EN_CHAT.test("Enviá una selfie")).toBe(true);
    expect(REGEX_PIDE_SELFIE_EN_CHAT.test("No puedo recibir selfies: usá el botón de búsqueda con selfie del álbum")).toBe(false);
    expect(REGEX_PIDE_SELFIE_EN_CHAT.test("Subí la selfie desde el botón del álbum")).toBe(false);
  });
});
