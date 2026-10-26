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

  it("sigue hasta 3 saltos; si después todavía hay otra regla, no redirige", () => {
    expect(resolverRedireccion(tabla(["/a", "/b"], ["/b", "/c"], ["/c", "/d"]), "/a")).toEqual({ hacia: "/d", codigo: 301 });
    expect(resolverRedireccion(tabla(["/a", "/b"], ["/b", "/c"], ["/c", "/d"], ["/d", "/e"]), "/a")).toBeNull();
    // Un bucle más largo que los saltos permitidos: A → B → C → D → A.
    expect(resolverRedireccion(tabla(["/a", "/b"], ["/b", "/c"], ["/c", "/d"], ["/d", "/a"]), "/a")).toBeNull();
  });

  it("el comodín no deja armar una redirección a otro sitio", () => {
    const t = tabla(["/x/*", "/*"]);
    expect(resolverRedireccion(t, "/x/%5Cevil.com")).toEqual({ hacia: "/%5Cevil.com", codigo: 301 });
    expect(resolverRedireccion(t, "/x/\\evil.com")?.hacia.startsWith("/%5C")).toBe(true);
    expect(resolverRedireccion(t, "/x/a b")).toEqual({ hacia: "/a%20b", codigo: 301 });
    // Un destino guardado así (por ejemplo, a mano en la base) tampoco se sigue.
    expect(resolverRedireccion(tabla(["/a", "//evil.com"]), "/a")).toBeNull();
    expect(resolverRedireccion(tabla(["/a", "/\\evil.com"]), "/a")).toBeNull();
  });

  it("la consulta pasa al destino, salvo la que usa la regla", () => {
    const t = tabla(["/sobre", "/quien-soy"], ["/post.php?id=1", "/blog/x"], ["/proof/*", "https://otro.com/proof/*", 302], ["/a", "/b?ref=1"]);
    expect(resolverRedireccion(t, "/sobre?utm_source=ig")).toEqual({ hacia: "/quien-soy?utm_source=ig", codigo: 301 });
    expect(resolverRedireccion(t, "/post.php?id=1&fbclid=z")).toEqual({ hacia: "/blog/x", codigo: 301 });
    expect(resolverRedireccion(t, "/proof/Ab?pw=2")).toEqual({ hacia: "https://otro.com/proof/Ab?pw=2", codigo: 302 });
    expect(resolverRedireccion(t, "/a?x=1")).toEqual({ hacia: "/b?ref=1&x=1", codigo: 301 });
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
    expect(validarRegla({ desde: "/x/*", hacia: "https://*.evil.com/" }).ok).toBe(false);
    expect(validarRegla({ desde: "/x/*", hacia: "https://*" }).ok).toBe(false);
    expect(validarRegla({ desde: "/x/*", hacia: "/\\evil.com" }).ok).toBe(false);
    expect(validarRegla({ desde: "/x/*", hacia: "//evil.com/*" }).ok).toBe(false);
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
