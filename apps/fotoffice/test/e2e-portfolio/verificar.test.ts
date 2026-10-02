/**
 * Las comprobaciones de punta a punta del portfolio, contra Postgres de verdad.
 *
 * No hay simulaciones acá: llama a las MISMAS funciones que usan las páginas, contra la base
 * descartable que cargó `seed-e2e.local.ts`. Lo que no cubre es el dibujo en pantalla.
 *
 * Correr con:
 *   pnpm exec vitest run --config vitest.e2e-portfolio.config.ts
 *
 * Las comprobaciones se pisan entre sí a propósito (bajan un portfolio, lo restauran, apagan el
 * módulo): van en orden y no en paralelo.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/db";
import { loadPublicDirectory, loadPublicPortfolio } from "@/lib/portfolio/public-queries";
import { loadPortfolioForMember } from "@/lib/portfolio/repository";
import { loadPortfoliosForAdmin, summarizePortfolios } from "@/lib/portfolio/admin-queries";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";

let ws = "";

async function miembroPorNumero(numero: string): Promise<string> {
  const m = await prisma.member.findFirstOrThrow({
    where: { workspaceId: ws, memberNumber: numero },
    select: { id: true },
  });
  return m.id;
}

async function visibilidadDe(numero: string) {
  return (await loadPortfolioForMember({ workspaceId: ws, memberId: await miembroPorNumero(numero) }))
    .visibility;
}

beforeAll(async () => {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("fotoffice_portfolio_e2e")) {
    throw new Error(`Sólo contra la base de prueba. DATABASE_URL = ${url}`);
  }
  const branding = await prisma.fotofficeWorkspaceBranding.findUniqueOrThrow({
    where: { publicSlug: "prueba" },
    select: { workspaceId: true },
  });
  ws = branding.workspaceId;
});

describe("1. el directorio lista sólo a quien corresponde", () => {
  it("se ven Juan y Diana, y nadie más", async () => {
    const nombres = (await loadPublicDirectory(ws)).map((e) => e.displayName).sort();
    expect(nombres).toEqual(["Diana Córdoba", "Juan Pérez"]);
  });

  it("ordena alfabéticamente por apellido, con las reglas del español", async () => {
    const nombres = (await loadPublicDirectory(ws)).map((e) => e.displayName);
    expect(nombres).toEqual(["Diana Córdoba", "Juan Pérez"]);
  });
});

describe("2. cada exclusión informa su motivo real", () => {
  it("sin consentimiento: NO_CONSENT", async () => {
    expect(await visibilidadDe("101")).toEqual({ visible: false, reason: "NO_CONSENT" });
  });

  it("con 4 cuotas vencidas: OVERDUE_DUES", async () => {
    expect(await visibilidadDe("102")).toEqual({ visible: false, reason: "OVERDUE_DUES" });
  });

  it("suspendida: MEMBER_NOT_ACTIVE", async () => {
    expect(await visibilidadDe("104")).toEqual({ visible: false, reason: "MEMBER_NOT_ACTIVE" });
  });

  it("sin ninguna foto: NO_PHOTOS", async () => {
    expect(await visibilidadDe("105")).toEqual({ visible: false, reason: "NO_PHOTOS" });
  });
});

describe("3. el perdón de deuda de la institución", () => {
  it("Diana debe 4 cuotas y se publica igual", async () => {
    expect(await visibilidadDe("103")).toEqual({ visible: true });
  });

  it("y está en el directorio", async () => {
    const nombres = (await loadPublicDirectory(ws)).map((e) => e.displayName);
    expect(nombres).toContain("Diana Córdoba");
  });
});

describe("4. la ficha pública", () => {
  it("la de Juan abre, con sus tres fotos en su orden", async () => {
    const ficha = await loadPublicPortfolio({ workspaceId: ws, publicSlug: "juan-perez" });
    expect(ficha).not.toBeNull();
    expect(ficha?.photos.map((f) => f.year)).toEqual([2024, 2023, 2022]);
  });

  it("tiene foto destacada, presentación y enlaces", async () => {
    const ficha = await loadPublicPortfolio({ workspaceId: ws, publicSlug: "juan-perez" });
    expect(ficha?.coverUrl).toBeTruthy();
    expect(ficha?.bio).toBeTruthy();
    expect(ficha?.links.instagram).toBeTruthy();
  });

  it("aguanta fotos de proporciones distintas: panorámica, vertical y cuadrada", async () => {
    const ficha = await loadPublicPortfolio({ workspaceId: ws, publicSlug: "juan-perez" });
    const formas = ficha?.photos.map((f) => `${f.width}x${f.height}`);
    expect(formas).toEqual(["2400x1200", "1200x1800", "1600x1600"]);
  });

  it("no expone documento, email, teléfono ni número de socio", async () => {
    const ficha = await loadPublicPortfolio({ workspaceId: ws, publicSlug: "juan-perez" });
    expect(JSON.stringify(ficha)).not.toMatch(/documentNumber|"email"|"phone"|memberNumber/);
  });
});

describe("5. no hay puerta lateral a lo despublicado", () => {
  it.each([
    ["Ana, sin consentimiento", "ana-alvarez"],
    ["Carlos, con deuda", "carlos-benitez"],
    ["Elena, suspendida", "elena-duarte"],
  ])("%s no abre escribiendo su dirección exacta", async (_quien, slug) => {
    expect(await loadPublicPortfolio({ workspaceId: ws, publicSlug: slug })).toBeNull();
  });

  it("una dirección inventada devuelve lo mismo que una oculta", async () => {
    expect(await loadPublicPortfolio({ workspaceId: ws, publicSlug: "no-existe" })).toBeNull();
  });
});

describe("6. la institución baja un portfolio", () => {
  beforeAll(async () => {
    await prisma.fotofficeMemberPortfolio.update({
      where: { memberId: await miembroPorNumero("100") },
      data: { hiddenByAdminAt: new Date(), hiddenReason: "Prueba de bajada" },
    });
  });

  it("desaparece del directorio", async () => {
    const nombres = (await loadPublicDirectory(ws)).map((e) => e.displayName);
    expect(nombres).not.toContain("Juan Pérez");
  });

  it("su ficha deja de abrir", async () => {
    expect(await loadPublicPortfolio({ workspaceId: ws, publicSlug: "juan-perez" })).toBeNull();
  });

  it("y él lee el motivo correcto en su portal", async () => {
    expect(await visibilidadDe("100")).toEqual({ visible: false, reason: "HIDDEN_BY_ADMIN" });
  });

  it("sus fotos siguen guardadas", async () => {
    const suyo = await loadPortfolioForMember({
      workspaceId: ws,
      memberId: await miembroPorNumero("100"),
    });
    expect(suyo.photos).toHaveLength(3);
  });
});

describe("7. y lo vuelve a publicar", () => {
  beforeAll(async () => {
    await prisma.fotofficeMemberPortfolio.update({
      where: { memberId: await miembroPorNumero("100") },
      data: { hiddenByAdminAt: null, hiddenByAdminUserId: null, hiddenReason: null },
    });
  });

  it("vuelve al directorio con sus fotos y su orden", async () => {
    const nombres = (await loadPublicDirectory(ws)).map((e) => e.displayName);
    expect(nombres).toContain("Juan Pérez");
    const ficha = await loadPublicPortfolio({ workspaceId: ws, publicSlug: "juan-perez" });
    expect(ficha?.photos.map((f) => f.year)).toEqual([2024, 2023, 2022]);
  });
});

describe("8. la baja del socio lo saca sola", () => {
  it("dado de baja, no se lista; reactivado, vuelve intacto", async () => {
    const id = await miembroPorNumero("100");

    await prisma.member.update({ where: { id }, data: { status: "INACTIVE" } });
    expect((await loadPublicDirectory(ws)).map((e) => e.displayName)).not.toContain("Juan Pérez");

    await prisma.member.update({ where: { id }, data: { status: "ACTIVE" } });
    expect((await loadPublicDirectory(ws)).map((e) => e.displayName)).toContain("Juan Pérez");
  });
});

describe("9. el módulo apagado cierra todo", () => {
  async function prender(enabled: boolean) {
    await prisma.workspaceFeatureModule.update({
      where: { workspaceId_moduleKey: { workspaceId: ws, moduleKey: PORTFOLIO_MODULE_KEY } },
      data: { enabled },
    });
  }

  it("apagado: el directorio queda vacío y ninguna ficha abre", async () => {
    await prender(false);
    expect(await loadPublicDirectory(ws)).toEqual([]);
    expect(await loadPublicPortfolio({ workspaceId: ws, publicSlug: "juan-perez" })).toBeNull();
  });

  it("prendido: vuelve todo", async () => {
    await prender(true);
    expect(await loadPublicDirectory(ws)).toHaveLength(2);
  });
});

describe("10. el panel de la institución", () => {
  it("lista a las 6 personas del padrón, no sólo a las publicadas", async () => {
    expect(await loadPortfoliosForAdmin(ws)).toHaveLength(6);
  });

  it("los tres números cuadran", async () => {
    const resumen = summarizePortfolios(await loadPortfoliosForAdmin(ws));
    expect(resumen).toEqual({ publicados: 2, armadosSinPublicar: 3, sinPortfolio: 1 });
  });

  it("la fila de Carlos dice que lo tapa la deuda, con el número de cuotas", async () => {
    const filas = await loadPortfoliosForAdmin(ws);
    const carlos = filas.find((f) => f.memberNumber === "102");
    expect(carlos?.visibility).toEqual({ visible: false, reason: "OVERDUE_DUES" });
    expect(carlos?.overdueCount).toBe(4);
  });

  it("la fila de Fabián figura sin portfolio todavía", async () => {
    const filas = await loadPortfoliosForAdmin(ws);
    const fabian = filas.find((f) => f.memberNumber === "105");
    expect(fabian?.portfolioId).toBeNull();
    expect(fabian?.photoCount).toBe(0);
  });
});

describe("11. aislamiento entre instituciones", () => {
  it("otra institución no ve ni lista nada de esta", async () => {
    const otra = await prisma.workspace.create({ data: { name: "Otra institución" } });
    try {
      expect(await loadPublicDirectory(otra.id)).toEqual([]);
      expect(
        await loadPublicPortfolio({ workspaceId: otra.id, publicSlug: "juan-perez" }),
      ).toBeNull();
    } finally {
      await prisma.workspace.delete({ where: { id: otra.id } });
    }
  });
});
