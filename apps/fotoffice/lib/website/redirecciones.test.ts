import { beforeEach, describe, expect, it, vi } from "vitest";

const { redireccion } = vi.hoisted(() => ({
  redireccion: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("@repo/db", () => ({ prisma: { fotofficeSitioRedireccion: redireccion } }));

const { buscarRedireccion, olvidarRedirecciones, normalizarRuta } = await import("./redirecciones");
const { compilarRedirecciones, resolverRedireccion, validarRegla, destinoBajoPrefijo } = await import("./redirecciones-reglas");

const tabla = (...reglas: Array<[string, string, number?]>) =>
  compilarRedirecciones(reglas.map(([desde, hacia, codigo = 301]) => ({ desde, hacia, codigo })));

beforeEach(() => {
  redireccion.findMany.mockReset();
  olvidarRedirecciones();
});

describe("normalizarRuta", () => {
  it("minúsculas, sin barra final y decodificada", () => {
    expect(normalizarRuta("/Portfolio/")).toBe("/portfolio");
    expect(normalizarRuta("/post/89987-X/")).toBe("/post/89987-x");
    expect(normalizarRuta("/qui%C3%A9n-soy")).toBe("/quién-soy");
    expect(normalizarRuta("/")).toBe("/");
    expect(normalizarRuta("")).toBe("/");
    expect(normalizarRuta("sobre")).toBe("/sobre");
    expect(normalizarRuta("//sobre//")).toBe("/sobre");
  });

  it("descarta la consulta salvo el ?id= de post.php y album.php", () => {
    expect(normalizarRuta("/sobre?utm_source=x#arriba")).toBe("/sobre");
    expect(normalizarRuta("/post.php?utm=1&id=89987")).toBe("/post.php?id=89987");
    expect(normalizarRuta("/Album.php?id=375817")).toBe("/album.php?id=375817");
    expect(normalizarRuta("/post.php?id=abc")).toBe("/post.php");
  });

  it("acepta una dirección completa", () => {
    expect(normalizarRuta("https://www.dnxfotografia.com.ar/Post.php?id=12")).toBe("/post.php?id=12");
    expect(normalizarRuta("https://www.dnxfotografia.com.ar")).toBe("/");
  });
});

describe("resolverRedireccion", () => {
  it("ruta exacta, con mayúsculas o barra final", () => {
    const t = tabla(["/portfolio", "/trabajos"], ["/post/89987-*", "/blog/nos-mudamos-a-funes"]);
    expect(resolverRedireccion(t, "/Portfolio/")).toEqual({ hacia: "/trabajos", codigo: 301 });
    expect(resolverRedireccion(t, "/post/89987-x/")).toEqual({ hacia: "/blog/nos-mudamos-a-funes", codigo: 301 });
    expect(resolverRedireccion(t, "/post/899870-x")).toBeNull();
    expect(resolverRedireccion(t, "/otra")).toBeNull();
  });

  it("una cadena A → B → C lleva directo a C", () => {
    const t = tabla(["/a", "/b"], ["/b", "/c"]);
    expect(resolverRedireccion(t, "/a")).toEqual({ hacia: "/c", codigo: 301 });
  });

  it("un bucle A → B → A no redirige", () => {
    expect(resolverRedireccion(tabla(["/a", "/b"], ["/b", "/a"]), "/a")).toBeNull();
    expect(resolverRedireccion(tabla(["/a", "/A/"]), "/a")).toBeNull();
  });

  it("corta a los 3 saltos", () => {
    const t = tabla(["/a", "/b"], ["/b", "/c"], ["/c", "/d"], ["/d", "/e"]);
    expect(resolverRedireccion(t, "/a")).toEqual({ hacia: "/d", codigo: 301 });
  });

  it("un salto temporal hace temporal toda la cadena", () => {
    expect(resolverRedireccion(tabla(["/a", "/b", 302], ["/b", "/c"]), "/a")).toEqual({ hacia: "/c", codigo: 302 });
  });

  it("comodín final: reemplaza el * conservando mayúsculas", () => {
    const t = tabla(["/proof/*", "https://dnxfotografia.alboompro.com/proof/*", 302]);
    expect(resolverRedireccion(t, "/proof/AbC12/fotos")).toEqual({ hacia: "https://dnxfotografia.alboompro.com/proof/AbC12/fotos", codigo: 302 });
    expect(resolverRedireccion(t, "/proof")).toBeNull();
  });

  it("la exacta gana al comodín y el comodín más largo al más corto", () => {
    const t = tabla(["/portfolio/*", "/trabajos"], ["/portfolio/books/*", "/trabajos/books"], ["/portfolio/books/1-x", "/trabajos/books/x"]);
    expect(resolverRedireccion(t, "/portfolio/books/1-x")?.hacia).toBe("/trabajos/books/x");
    expect(resolverRedireccion(t, "/portfolio/books/2-y")?.hacia).toBe("/trabajos/books");
    expect(resolverRedireccion(t, "/portfolio/bodas/3")?.hacia).toBe("/trabajos");
  });

  it("post.php conserva el número", () => {
    const t = tabla(["/post.php?id=89987", "/blog/nos-mudamos"]);
    expect(resolverRedireccion(t, "/post.php?id=89987&fbclid=x")?.hacia).toBe("/blog/nos-mudamos");
    expect(resolverRedireccion(t, "/post.php?id=1")).toBeNull();
  });
});

describe("destinoBajoPrefijo", () => {
  it("agrega /w/<slug> a las rutas y deja las direcciones completas", () => {
    expect(destinoBajoPrefijo("/quien-soy", "/w/dnx")).toBe("/w/dnx/quien-soy");
    expect(destinoBajoPrefijo("/", "/w/dnx")).toBe("/w/dnx");
    expect(destinoBajoPrefijo("https://x.com/a", "/w/dnx")).toBe("https://x.com/a");
  });
});

describe("validarRegla", () => {
  it("normaliza la dirección vieja y completa la barra de la nueva", () => {
    expect(validarRegla({ desde: "/Sobre/", hacia: "quien-soy", codigo: "301" })).toEqual({ ok: true, regla: { desde: "/sobre", hacia: "/quien-soy", codigo: 301 } });
    expect(validarRegla({ desde: "/proof/*", hacia: "https://otro.com/proof/*", codigo: "302" })).toEqual({
      ok: true,
      regla: { desde: "/proof/*", hacia: "https://otro.com/proof/*", codigo: 302 },
    });
  });

  it("rechaza la portada, esquemas raros y el * fuera de lugar", () => {
    expect(validarRegla({ desde: "/", hacia: "/x" }).ok).toBe(false);
    expect(validarRegla({ desde: "/*", hacia: "/x" }).ok).toBe(false);
    expect(validarRegla({ desde: "/a", hacia: "javascript:alert(1)" }).ok).toBe(false);
    expect(validarRegla({ desde: "/a*b", hacia: "/x" }).ok).toBe(false);
    expect(validarRegla({ desde: "/a", hacia: "/b/*" }).ok).toBe(false);
    expect(validarRegla({ desde: "/a", hacia: "/A/" }).ok).toBe(false);
  });
});

describe("buscarRedireccion", () => {
  it("lee las reglas una vez y las recuerda", async () => {
    redireccion.findMany.mockResolvedValue([{ desde: "/sobre", hacia: "/quien-soy", codigo: 301 }]);
    expect(await buscarRedireccion("ws-1", "/Sobre")).toEqual({ hacia: "/quien-soy", codigo: 301 });
    expect(await buscarRedireccion("ws-1", "/nada")).toBeNull();
    expect(redireccion.findMany).toHaveBeenCalledTimes(1);
    expect(redireccion.findMany.mock.calls[0][0].where).toEqual({ workspaceId: "ws-1" });
  });

  it("sin la tabla (P2021) no redirige ni rompe", async () => {
    redireccion.findMany.mockRejectedValue(Object.assign(new Error("no existe"), { code: "P2021" }));
    expect(await buscarRedireccion("ws-1", "/sobre")).toBeNull();
  });

  it("si la base falla tampoco rompe", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    redireccion.findMany.mockRejectedValue(new Error("caída"));
    expect(await buscarRedireccion("ws-1", "/sobre")).toBeNull();
  });
});
