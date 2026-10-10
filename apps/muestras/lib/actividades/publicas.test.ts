import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Prueba de filtración (etapa 6): con la sorpresa puesta, ninguna imagen ni id de una obra reservada
 * llega a lo que arma el servidor (el árbol con las props de los componentes cliente, que es lo que
 * se serializa en el HTML y en el payload RSC) ni a los metadatos.
 */
const db = vi.hoisted(() => ({
  culturalActivity: { findFirst: vi.fn(), findMany: vi.fn() },
  culturalActivityGuestbookEntry: { findMany: vi.fn() },
  photographerProfile: { findUnique: vi.fn() },
}));
vi.mock("@repo/db", () => ({ prisma: db }));

const { default: Ficha, generateMetadata, revalidate } = await import("@/app/m/[slug]/page");
const { default: PaginaDeObra, generateMetadata: metadatosDeObra } = await import("@/app/m/[slug]/o/[workId]/page");
const { default: PerfilPublico, generateMetadata: metadatosDePerfil } = await import("@/app/fotografos/[slug]/page");
const { visibilityFromPreset, visibleWorks } = await import("@repo/muestras");

// El tipo del elemento (componente o módulo) no es contenido: se reemplaza por su nombre.
const arbol = (el: unknown) =>
  JSON.stringify(el, (k, v) => (typeof v === "function" ? undefined : k === "type" && typeof v !== "string" ? (v?.name ?? "componente") : k.startsWith("_") ? undefined : v));
/** Busca, dentro del árbol, un elemento por el nombre de su componente. */
function buscar(el: unknown, nombre: string): Record<string, unknown> | null {
  if (!el || typeof el !== "object") return null;
  if (Array.isArray(el)) {
    for (const x of el) {
      const r = buscar(x, nombre);
      if (r) return r;
    }
    return null;
  }
  const o = el as { type?: { name?: string }; props?: Record<string, unknown> };
  if (o.type && typeof o.type === "function" && o.type.name === nombre) return o.props ?? {};
  return o.props ? buscar(o.props.children, nombre) : null;
}

const DIA = 86_400_000;
const perfil = {
  id: "p1", slug: "ana", displayName: "Ana", bio: "Fotógrafa de Rosario.", city: "Rosario", province: "Santa Fe", avatarUrl: null,
  website: null, instagram: null,
  portfolio: [{ id: "f1", imageUrl: "https://pub-test.r2.dev/muestras/9/portfolio-1.webp", title: "Río", year: 2020, technique: null, caption: null, sortOrder: 0 }],
  _count: { portfolio: 1 },
};
const obra = (n: number) => ({
  id: `obra-${n}`, activityId: "a1", imageUrl: `https://pub-test.r2.dev/muestras/a1/oculta-${n}.webp`, title: `Título ${n}`, authorName: "Ana",
  authorUserId: 9, authorProfileId: "p1", authorProfile: perfil, year: 2024, technique: "Giclée", isHighlight: n === 1, sortOrder: n, createdAt: new Date(),
});
const muestra = (visibility: unknown, n = 3, extra: Record<string, unknown> = {}) => ({
  id: "a1", slug: "m", type: "MUESTRA", title: "Silos", description: "Una muestra.", organizersText: "Club", curatorialText: null, curatorCredits: null,
  coverImageUrl: "https://pub-test.r2.dev/muestras/a1/portada.webp", startsAt: new Date(Date.now() - DIA), endsAt: new Date(Date.now() + 20 * DIA),
  openingAt: null, openingEndsAt: null, scheduleText: "De 10 a 18", priceText: null, externalUrl: null, isVirtualOnly: false,
  venueName: "Sala", address: "Calle 1", city: "Rosario", province: "Santa Fe", latitude: null, longitude: null,
  galleryMode: "HIGHLIGHTS_UNTIL_CLOSED", visibility, reviewStatus: "APPROVED", isCancelled: false, guestbookMode: "OFF", rsvpStatus: "OFF",
  works: Array.from({ length: n }, (_, i) => obra(i + 1)),
  ...extra,
});
const porVisitante = { v: 1, online: { exhibited: "RANDOM", randomCount: 2, rotation: "PER_VISIT", seed: "s", artists: true } };
const sorpresa = visibilityFromPreset("SURPRISE", "s");
const p = (o: Record<string, string>) => ({ params: Promise.resolve(o) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalActivityGuestbookEntry.findMany.mockResolvedValue([]);
  db.photographerProfile.findUnique.mockResolvedValue(perfil);
});

describe("la publicación online respeta la sorpresa", () => {
  it("se regenera seguido: 'cambian cada día' no queda pegado al sorteo de ayer", () => {
    expect(revalidate).toBeLessThanOrEqual(3600);
  });

  for (const [nombre, ajuste] of [["Sorpresa total", sorpresa], ["para cada visitante", porVisitante]] as const) {
    it(`${nombre}: la ficha no lleva ninguna obra expuesta y sí el portfolio`, async () => {
      db.culturalActivity.findFirst.mockResolvedValue(muestra(ajuste));
      const el = await Ficha(p({ slug: "m" }));
      const html = arbol(el);
      for (let n = 1; n <= 3; n++) {
        expect(html).not.toContain(`oculta-${n}.webp`);
        expect(html).not.toContain(`obra-${n}`);
      }
      expect(html).toContain("portfolio-1.webp");
      expect(buscar(el, "Galeria")).toBeNull();
      expect(arbol(await generateMetadata(p({ slug: "m" })))).not.toContain("oculta-");
    });

    it(`${nombre}: la página de una obra es el aviso sin imagen y noindex`, async () => {
      db.culturalActivity.findFirst.mockResolvedValue(muestra(ajuste));
      const html = arbol(await PaginaDeObra(p({ slug: "m", workId: "obra-2" })));
      expect(html).toContain("Esta obra se ve en la sala.");
      expect(html).not.toContain("oculta-");
      expect(html).not.toContain("obra-1");
      expect(html).not.toContain("obra-3");
      const meta = await metadatosDeObra(p({ slug: "m", workId: "obra-2" }));
      expect(meta.robots).toEqual({ index: false });
      expect(arbol(meta)).not.toContain("oculta-");
    });

    it(`${nombre}: el perfil no muestra obras de la sala y sí su portfolio`, async () => {
      const m = muestra(ajuste);
      db.culturalActivity.findMany.mockResolvedValue([m]);
      const html = arbol(await PerfilPublico(p({ slug: "ana" })));
      expect(html).not.toContain("oculta-");
      expect(html).not.toContain("obra-");
      expect(html).toContain("Portfolio");
      expect(html).toContain("portfolio-1.webp");
      expect(arbol(await metadatosDePerfil(p({ slug: "ana" })))).not.toContain("oculta-");
    });
  }

  it("para cada visitante: la galería se pide al anticipo, con slug y cantidad y sin obras", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra(porVisitante));
    const props = buscar(await Ficha(p({ slug: "m" })), "GaleriaRotativa");
    expect(props).toEqual({ slug: "m", cantidad: 2 });
  });

  it("Adelanto con semilla fija: aparecen exactamente las 3 de visibleWorks, ni una más", async () => {
    const ajuste = visibilityFromPreset("PREVIEW", "semilla-fija");
    const m = muestra(ajuste, 8);
    db.culturalActivity.findFirst.mockResolvedValue(m);
    const visibles = new Set(visibleWorks(m, m.works, new Date()).works.map((w) => w.id));
    expect(visibles.size).toBe(3);
    const el = await Ficha(p({ slug: "m" }));
    const html = arbol(el);
    for (const w of m.works) expect(html.includes(`oculta-${w.sortOrder}.webp`)).toBe(visibles.has(w.id));
    const galeria = buscar(el, "Galeria") as { obras: { id: string }[]; parcial: boolean };
    expect(galeria.obras.map((o) => o.id).sort()).toEqual([...visibles].sort());
    expect(galeria.parcial).toBe(true);
    // La página de una oculta: sin imagen; la de una visible, con imagen.
    const oculta = m.works.find((w) => !visibles.has(w.id))!;
    expect(arbol(await PaginaDeObra(p({ slug: "m", workId: oculta.id })))).not.toContain(`oculta-${oculta.sortOrder}.webp`);
    const visible = m.works.find((w) => visibles.has(w.id))!;
    expect(arbol(await PaginaDeObra(p({ slug: "m", workId: visible.id })))).toContain(`oculta-${visible.sortOrder}.webp`);
    // El perfil: las mismas 3.
    db.culturalActivity.findMany.mockResolvedValue([m]);
    const perfilHtml = arbol(await PerfilPublico(p({ slug: "ana" })));
    for (const w of m.works) expect(perfilHtml.includes(`oculta-${w.sortOrder}.webp`)).toBe(visibles.has(w.id));
  });

  it("muestra sin ajuste: como antes (sólo las destacadas mientras está abierta)", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra(null));
    const galeria = buscar(await Ficha(p({ slug: "m" })), "Galeria") as { obras: { id: string }[] };
    expect(galeria.obras.map((o) => o.id)).toEqual(["obra-1"]);
  });

  it("mantener la reserva al cerrar: el aviso no promete el archivo", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ ...sorpresa, revealAfterClose: false }));
    const html = arbol(await PaginaDeObra(p({ slug: "m", workId: "obra-2" })));
    expect(html).toContain("Esta obra se ve en la sala.");
    expect(html).not.toContain("archivo de la muestra");
  });
});
