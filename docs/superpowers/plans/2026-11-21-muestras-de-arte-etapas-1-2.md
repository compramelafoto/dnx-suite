# Muestras de Arte — Etapas 1 y 2: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `apps/muestras` atienda muestrasfotograficas.com y muestrasdearte.com con marca propia cada uno, y que cada muestra tenga una disciplina principal que decide su dominio de casa.

**Architecture:** Todas las páginas pasan a `app/[marca]/…` (`marca` = `fotografia` | `arte`). Una reescritura `afterFiles` de `next.config.ts` elige la carpeta según el host. Así cada página sigue siendo estática con `revalidate = 300`: no lee `headers()`, recibe la marca por parámetro. Las rutas `app/api/**` no se mueven. Un módulo `lib/marca.ts` concentra nombres, textos, dominios y la regla «disciplina principal → dominio de casa».

**Tech Stack:** Next 16.2.1 (App Router, webpack), Prisma (`@repo/db`, Neon `divine-hall` rama `development`), Vitest, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-11-21-muestras-de-arte-design.md` (secciones 6.1, 6.2, 6.12 y 7.1 etapas 1-2).

## Global Constraints

- **Código desde `origin/main`** (el `main` local está viejo). Trabajar en un worktree nuevo desde `origin/main`, rama `feat/muestras-arte-etapa-1` y después `feat/muestras-arte-etapa-2`. Un PR por etapa, fusión con `gh pr merge --squash` después de `gh pr checks --watch` (el repo no permite auto-merge).
- **En fotografía no cambia ninguna palabra** ni ninguna URL pública. Todas las pruebas actuales (`pnpm --filter muestras test`, `pnpm --filter @repo/muestras test`) siguen pasando sin tocarlas, salvo las que se adaptan a una firma nueva.
- Marca por defecto: `FOTOGRAFIA`. Cualquier host que no sea de arte (localhost, `*.vercel.app`, preview) es fotografía, salvo `muestrasdearte.localhost` en local.
- Hosts de arte: `muestrasdearte.com`, `www.muestrasdearte.com`, `muestrasdearte.localhost` (con o sin puerto).
- Dominios públicos: `https://muestrasfotograficas.com` y `https://muestrasdearte.com`.
- Disciplina por defecto de todo lo existente: `"FOTOGRAFIA"`.
- **Migración:** `packages/db/prisma/migrations/20270223120000_muestras_disciplinas/migration.sql`. Se aplica **a mano, con permiso de Daniel**, en `divine-hall`/`development`, y se registra con su checksum **antes** de desplegar cualquier app con el schema nuevo (una columna que falta rompe todo el modelo en FOTOFFICE y FotoRank, que comparten la base).
- Sin CSP nueva, sin dependencias nuevas.
- Cookie de sesión: en Vercel **no** hay `COOKIE_DOMAIN`, así que la cookie ya queda atada al host de cada dominio; `lib/sesion.ts` no se toca. Si alguien carga `COOKIE_DOMAIN` en Vercel, se rompe el ingreso en uno de los dos dominios: no cargarlo.
- Diferencia con la spec 6.1: la marca no se lee con `headers()`, sale del segmento `[marca]` (para no perder la caché de `revalidate = 300`).
- Textos de pantalla, commits y PR en español.
- **No tocar `apps/clickaton`.**

## Review Focus

1. **Host con mayúsculas, puerto o `www`** (`WWW.MuestrasDeArte.com:443`): tiene que resolverse como arte. Lo prueba `marcaPorHost` (Task 1).
2. **QR viejo de una muestra que pasó a pintura**: `muestrasfotograficas.com/m/<slug>` tiene que redirigir con 308 a muestrasdearte.com, no dar 404. Lo prueba Task 8.
3. **Ruta interna pedida desde afuera** (`/arte/m/x` o `/fotografia/m/x` en cualquier dominio): tiene que dar 404, para que no haya contenido duplicado. Se verifica con curl en Task 2.
4. **Enlace activo del encabezado y del panel**: `usePathname()` puede devolver la ruta con `/fotografia` o `/arte` adelante; el resaltado tiene que seguir funcionando. Lo prueba `sinPrefijoDeMarca` (Task 2).
5. **Ingreso con Google iniciado en arte**: tiene que volver a arte con la sesión puesta ahí, no a muestrasfotograficas.com. Lo prueba Task 4.

---

## ETAPA 1 — Marca por dominio (PR 1)

Al terminar la etapa 1, muestrasfotograficas.com queda idéntico. muestrasdearte.com sigue con la redirección 307 de Vercel, así que todavía no se ve nada nuevo.

### Task 1: Módulo de marca

**Files:**
- Create: `apps/muestras/lib/marca.ts`
- Test: `apps/muestras/lib/marca.test.ts`

**Interfaces:**
- Produces:
  - `type MarcaId = "FOTOGRAFIA" | "ARTE"`, `type SegmentoMarca = "fotografia" | "arte"`
  - `type Marca = { id: MarcaId; segmento: SegmentoMarca; dominio: string; origen: string; nombre: string; descripcion: string; palabraAutor: { singular: string; plural: string; titulo: string }; rutaAutores: "/fotografos" | "/artistas"; logo: string; imagenRedes: string; descriptorTarjeta: string }`
  - `MARCAS: Record<MarcaId, Marca>`
  - `marcaPorHost(host: string | null | undefined): Marca`
  - `marcaPorSegmento(segmento: string): Marca | null`
  - `marcaDeDisciplina(primaryDiscipline: string | null | undefined): Marca` (`"FOTOGRAFIA"` o vacío → FOTOGRAFIA; cualquier otra → ARTE)
  - `origenPublico(marca: Marca, env?: Record<string, string | undefined>): string` (ver Step 3)
  - `esHostDeArte(host: string): boolean`

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
describe("marcaPorHost", () => {
  it.each(["muestrasdearte.com", "www.muestrasdearte.com", "WWW.MuestrasDeArte.com:443", "muestrasdearte.localhost:3014"])("%s → ARTE", (h) => expect(marcaPorHost(h).id).toBe("ARTE"));
  it.each(["muestrasfotograficas.com", "localhost:3014", "muestras-x.vercel.app", "", null, "muestrasdearte.com.evil.io"])("%s → FOTOGRAFIA", (h) => expect(marcaPorHost(h as string).id).toBe("FOTOGRAFIA"));
});
it("marcaDeDisciplina", () => {
  expect(marcaDeDisciplina("FOTOGRAFIA").id).toBe("FOTOGRAFIA");
  expect(marcaDeDisciplina(null).id).toBe("FOTOGRAFIA");
  expect(marcaDeDisciplina("PINTURA").id).toBe("ARTE");
});
it("marcaPorSegmento", () => {
  expect(marcaPorSegmento("arte")?.id).toBe("ARTE");
  expect(marcaPorSegmento("fotografia")?.id).toBe("FOTOGRAFIA");
  expect(marcaPorSegmento("otra")).toBeNull();
});
describe("origenPublico", () => {
  it("producción usa el dominio de la marca", () => {
    const env = { VERCEL_ENV: "production", APP_URL: "https://muestrasfotograficas.com" };
    expect(origenPublico(MARCAS.ARTE, env)).toBe("https://muestrasdearte.com");
    expect(origenPublico(MARCAS.FOTOGRAFIA, env)).toBe("https://muestrasfotograficas.com");
  });
  it("local respeta APP_URL y arte cambia el host a muestrasdearte.localhost", () => {
    const env = { NODE_ENV: "development", APP_URL: "http://localhost:3014" };
    expect(origenPublico(MARCAS.FOTOGRAFIA, env)).toBe("http://localhost:3014");
    expect(origenPublico(MARCAS.ARTE, env)).toBe("http://muestrasdearte.localhost:3014");
  });
});
it("fotografía conserva los textos de hoy", () => {
  expect(MARCAS.FOTOGRAFIA.nombre).toBe("Muestras Fotográficas");
  expect(MARCAS.FOTOGRAFIA.descripcion).toBe("Muestras de fotografía para ver en persona, en todo el país: dónde quedan, fechas, horarios y cómo llegar.");
  expect(MARCAS.FOTOGRAFIA.rutaAutores).toBe("/fotografos");
  expect(MARCAS.FOTOGRAFIA.descriptorTarjeta).toBe("MUESTRAS FOTO");
  expect(MARCAS.ARTE.descriptorTarjeta).toBe("MUESTRAS ARTE");
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter muestras exec vitest run lib/marca.test.ts`
Expected: FAIL («Cannot find module './marca'»).

- [ ] **Step 3: Implementar `lib/marca.ts`**

- `marcaPorHost`: pasar a minúsculas, sacar el puerto, comparar **exacto** contra los tres hosts de arte de Global Constraints.
- `origenPublico`: en producción (`VERCEL_ENV === "production"` o `NODE_ENV === "production"`) devuelve `https://<dominio>`. Si no, toma `APP_URL || NEXT_PUBLIC_APP_URL || "http://localhost:3014"`. Para ARTE, si ese host es `localhost`, lo cambia por `muestrasdearte.localhost` y conserva el puerto.
- Textos de ARTE: nombre «Muestras de Arte»; descripción «Muestras de arte para ver en persona: pintura, escultura, grabado, fotografía y más. Dónde quedan, fechas, horarios y cómo llegar.»; autor «artista» / «artistas» / «Artistas que expusieron»; logo `/brand/arte-logo-1254.webp` (hasta que esté el logo, el mismo archivo que fotografía); `imagenRedes` igual.
- Textos de FOTOGRAFIA: copiados **exactos** de `app/layout.tsx` y `components/encabezado`. Autor «fotógrafo» / «fotógrafos» / «Fotógrafos que expusieron».

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter muestras exec vitest run lib/marca.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "Muestras: módulo de marca por dominio"`

### Task 2: Mover las páginas a `app/[marca]` y reescribir por host

**Files:**
- Move (con `git mv`, sin cambiar contenido salvo lo indicado): todo `apps/muestras/app/**` **menos** `app/api/**`, a `apps/muestras/app/[marca]/**`. Incluye `layout.tsx`, `globals.css`, `_fonts/`, `page.tsx`, `m/`, `panel/`, `compras/`, `q/`, `verificar/`, `fotografos/`, `convocatorias/`, `expositores/`, `login/`, `privacidad/`, `terminos/`.
- Move: `app/icon.png` → `public/icon.png`; `app/apple-icon.png` → `public/apple-icon.png`.
- Modify: `apps/muestras/next.config.ts` (rewrites)
- Modify: `apps/muestras/app/[marca]/layout.tsx` (params, `generateStaticParams`, `dynamicParams = false`, íconos en `metadata`)
- Create: `apps/muestras/lib/ruta-marca.ts` + `lib/ruta-marca.test.ts`
- Modify: `components/encabezado/barra.tsx`, `components/panel/barra-lateral.tsx`

**Interfaces:**
- Consumes: `marcaPorSegmento`, `MARCAS` (Task 1)
- Produces:
  - `sinPrefijoDeMarca(pathname: string): string`
  - Las páginas reciben `params: Promise<{ marca: SegmentoMarca; … }>`. `marcaDeParams(params): Promise<Marca>` vive en `lib/ruta-marca.ts` y llama a `notFound()` si el segmento no existe.

- [ ] **Step 1: Prueba que falla para `sinPrefijoDeMarca`**

```ts
it.each([["/fotografia/panel/muestras", "/panel/muestras"], ["/arte", "/"], ["/arte/m/x", "/m/x"], ["/panel", "/panel"], ["/artesanos", "/artesanos"]])("%s → %s", (a, b) => expect(sinPrefijoDeMarca(a)).toBe(b));
```

Run: `pnpm --filter muestras exec vitest run lib/ruta-marca.test.ts` → FAIL.

- [ ] **Step 2: Implementar `lib/ruta-marca.ts`**

Saca sólo un primer segmento **exacto** `fotografia` o `arte`. `marcaDeParams` resuelve el `params.marca`.

- [ ] **Step 3: `git mv` de las páginas y rutas, y de los íconos a `public/`**

- Ajustar los imports relativos que se rompan: `./globals.css` y `./_fonts/…` viajan juntos, así que no deberían.
- En `barra.tsx` y `barra-lateral.tsx`, comparar con `sinPrefijoDeMarca(usePathname())`.
- En `layout.tsx`:
  - `export function generateStaticParams() { return [{ marca: "fotografia" }, { marca: "arte" }] }`
  - `export const dynamicParams = false`
  - `metadata` → `generateMetadata({ params })` con los textos de la marca y `metadataBase: new URL(origenPublico(marca))`
  - `icons: { icon: "/icon.png", apple: "/apple-icon.png" }`

- [ ] **Step 4: Rewrites en `next.config.ts`**

```ts
async rewrites() {
  const resto = "/:path((?!api/|_next/).*)";
  const arte = [{ type: "host" as const, value: "(www\\.)?muestrasdearte\\.(com|localhost)" }];
  return {
    beforeFiles: [],
    afterFiles: [
      { source: "/", has: arte, destination: "/arte" },
      { source: resto, has: arte, destination: "/arte/:path" },
      { source: "/", destination: "/fotografia" },
      { source: resto, destination: "/fotografia/:path" },
    ],
    fallback: [],
  };
}
```

Las `redirects()` que ya existen quedan igual: corren antes que las reescrituras.

- [ ] **Step 5: Verificar en local**

Run: `pnpm --filter muestras build && pnpm --filter muestras start -p 3014` (en segundo plano). Después:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3014/                                # 200
curl -s http://localhost:3014/ | grep -c "Muestras Fotográficas"                               # ≥1
curl -s -H "Host: muestrasdearte.localhost:3014" http://localhost:3014/ | grep -c "Muestras de Arte"  # ≥1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3014/fotografia/m/x                  # 404
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3014/arte                            # 404
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3014/icon.png                        # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3014/brand/muestras-logo-1254.webp   # 200
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3014/api/geocode?q=Rosario"          # no 404
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3014/mis-muestras                    # 308
```

Revisar también en el navegador interno: entrar a una muestra, ir al panel y volver. El enlace activo del encabezado tiene que quedar resaltado y la consola sin errores de hidratación.

- [ ] **Step 6: Pruebas y tipos**

Run: `pnpm --filter muestras test && pnpm --filter muestras check-types` → todo PASS.

- [ ] **Step 7: Commit** — `git commit -m "Muestras: páginas bajo [marca] y reescritura por dominio"`

### Task 3: Textos de marca en encabezado, pie y portada

**Files:**
- Modify: `components/encabezado/encabezado.tsx`, `components/pie/pie.tsx`, `components/portada/banner.tsx`, `app/[marca]/page.tsx`, `app/[marca]/fotografos/page.tsx` (título desde `marca.palabraAutor.titulo`)
- Test: `lib/marca.test.ts` (sin pruebas nuevas: los textos ya están probados en Task 1)

**Interfaces:**
- Consumes: `Marca` (Task 1), `marcaDeParams` (Task 2)
- Produces: `Encabezado({ marca })`, `Pie({ marca })`, `Banner({ fotos, marca })`

- [ ] **Step 1: Pasar `marca` como prop desde el layout y las páginas**

Reemplazar los textos fijos por los de la marca: el nombre en el encabezado; el enlace «Fotógrafos» por `marca.palabraAutor.plural` capitalizado con `href={marca.rutaAutores}`; «Muestras Fotográficas es parte de DNX Suite.» por `${marca.nombre} es parte de DNX Suite.`

- [ ] **Step 2: Banner de la portada**

- En ARTE no se muestra el banner de fotos de Rosario. Se muestra una grilla con las portadas de hasta 8 muestras publicadas de arte, cada una con su crédito y enlace (spec 6.12 y 7.3). En la etapa 1 todavía no hay disciplinas, así que la grilla se arma con `[]` y queda escondida si está vacía.
- La línea «Fotografía: {autor}» queda igual en FOTOGRAFIA.

- [ ] **Step 3: Verificar**

- Con curl a los dos hosts (como en Task 2, Step 5): fotografía devuelve el mismo HTML de textos que en producción. Comparar `curl -s https://muestrasfotograficas.com/ | grep -o "Muestras Fotográficas es parte de DNX Suite."`.
- Arte muestra «Muestras de Arte» y «Artistas».

- [ ] **Step 4: Commit** — `git commit -m "Muestras: encabezado, pie y portada según la marca"`

### Task 4: Ingreso con Google y con clave en el dominio de origen

**Files:**
- Create: `apps/muestras/lib/base-oauth.ts` + `lib/base-oauth.test.ts`
- Modify: `app/api/auth/google/route.ts`, `app/api/auth/google/callback/route.ts`, `app/api/auth/clave/route.ts` (si arma URLs absolutas)

**Interfaces:**
- Consumes: `marcaPorHost`, `origenPublico` (Task 1)
- Produces: `baseDeIngreso(req: Request, env?): string`

- [ ] **Step 1: Prueba que falla**

```ts
it("en producción vuelve al dominio del pedido", () => {
  const env = { VERCEL_ENV: "production", APP_URL: "https://muestrasfotograficas.com" };
  expect(baseDeIngreso(new Request("https://muestrasdearte.com/api/auth/google"), env)).toBe("https://muestrasdearte.com");
  expect(baseDeIngreso(new Request("https://muestrasfotograficas.com/api/auth/google"), env)).toBe("https://muestrasfotograficas.com");
});
it("un host ajeno nunca se usa como base", () => {
  const env = { VERCEL_ENV: "production" };
  expect(baseDeIngreso(new Request("https://evil.io/api/auth/google"), env)).toBe("https://muestrasfotograficas.com");
});
it("en local usa APP_URL", () => {
  expect(baseDeIngreso(new Request("http://localhost:3014/api/auth/google"), { APP_URL: "http://localhost:3014" })).toBe("http://localhost:3014");
});
```

- [ ] **Step 2: Implementar** `baseDeIngreso = origenPublico(marcaPorHost(new URL(req.url).host), env)`.

En las dos rutas de Google, reemplazar `resolveAppBaseUrl({…envKeys…})` por `baseDeIngreso(req)`. `resolveGoogleRedirectUri(base)` queda igual. En `volverAlLogin`, usar la misma base.

- [ ] **Step 3: Correr pruebas** → PASS.

- [ ] **Step 4: Commit** — `git commit -m "Muestras: el ingreso vuelve al dominio desde el que se entró"`

### Task 5: PR de la etapa 1 y verificación en producción

- [ ] **Step 1:** `pnpm --filter muestras lint && pnpm --filter muestras test && pnpm --filter muestras check-types`, todo en verde.
- [ ] **Step 2:** Push, abrir el PR «Muestras de Arte, etapa 1: marca por dominio», esperar `gh pr checks --watch`. Fusiona Daniel (el clasificador no deja a Claude).
- [ ] **Step 3:** Después del despliegue, chequear muestrasfotograficas.com con un parámetro que evite la caché (`?v=<timestamp>`): portada, una muestra, `/fotografos`, `/panel` (logueado) e ingreso con Google, y comparar textos con lo de antes. muestrasdearte.com todavía tiene que redirigir con 307.

---

## ETAPA 2 — Disciplinas y muestrasdearte.com en línea (PR 2)

### Task 6: Lista de disciplinas en el paquete

**Files:**
- Create: `packages/muestras/src/disciplines.ts` + `src/disciplines.test.ts`
- Modify: `packages/muestras/src/index.ts` (`export * from "./disciplines"`)

**Interfaces:**
- Produces:
  - `DISCIPLINES` (array `as const` con los 16 códigos de la tabla de la spec 6.2, en ese orden)
  - `type Discipline`
  - `DISCIPLINE_LABELS: Record<Discipline, string>` (etiquetas exactas de la spec)
  - `isDiscipline(v: unknown): v is Discipline`
  - `PHOTOGRAPHY: "FOTOGRAFIA"`
  - `parseOtherDisciplines(values: unknown[], primary: Discipline): Discipline[]` (únicas, válidas, sin la principal, máximo 5)

- [ ] **Step 1: Pruebas que fallan**

```ts
expect(DISCIPLINES).toHaveLength(16);
expect(DISCIPLINES[0]).toBe("FOTOGRAFIA");
expect(DISCIPLINE_LABELS.GRABADO).toBe("Grabado y obra gráfica");
expect(isDiscipline("PINTURA")).toBe(true);
expect(isDiscipline("pintura")).toBe(false);
expect(parseOtherDisciplines(["PINTURA", "PINTURA", "FOTOGRAFIA", "X", "DIBUJO"], "FOTOGRAFIA")).toEqual(["PINTURA", "DIBUJO"]);
```

- [ ] **Step 2:** `pnpm --filter @repo/muestras test` → FAIL. Implementar. → PASS.
- [ ] **Step 3: Commit** — `git commit -m "Muestras: lista de disciplinas"`

### Task 7: Migración de disciplinas

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20270223120000_muestras_disciplinas/migration.sql`

**Interfaces:**
- Produces, en el schema:
  - `CulturalActivity.primaryDiscipline String @default("FOTOGRAFIA")`
  - `CulturalActivity.otherDisciplines String[] @default([])`
  - `@@index([primaryDiscipline])`
  - `PhotographerProfile.disciplines String[] @default(["FOTOGRAFIA"])`
  - `discipline String?` en `CulturalActivityWork`, `CulturalExhibitorWork`, `CulturalCallWork` y `PhotographerPortfolioPhoto`

- [ ] **Step 1:** Editar el schema y escribir el SQL a mano:
  - Sólo `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` con los defaults de arriba (`TEXT[] NOT NULL DEFAULT ARRAY['FOTOGRAFIA']::TEXT[]` para el perfil).
  - `CREATE INDEX IF NOT EXISTS "CulturalActivity_primaryDiscipline_idx" …`.
- [ ] **Step 2:** `pnpm --filter @repo/db exec prisma validate` y `pnpm --filter @repo/db exec prisma generate` → sin errores.
- [ ] **Step 3: Pedir permiso a Daniel.** Con su sí, aplicar el SQL en `divine-hall`/`development` y registrarlo en `_prisma_migrations` con su checksum (mismo procedimiento que `20261102120000_muestras_etapa_8_venta`). Verificar:
  - `SELECT count(*) FROM "CulturalActivity" WHERE "primaryDiscipline" = 'FOTOGRAFIA'` es igual al total.
  - FOTOFFICE y FotoRank en producción siguen respondiendo.
- [ ] **Step 4: Commit** — `git commit -m "Muestras: columnas de disciplina"`

### Task 8: Cada muestra en su dominio de casa

**Files:**
- Modify: `lib/actividades/consultas.ts` (`listarPublicas`, `buscarPorSlug`, `CAMPOS_PUBLICOS` suma `primaryDiscipline` y `otherDisciplines`)
- Create: `lib/marca-de-muestra.ts` + `lib/marca-de-muestra.test.ts`
- Modify: `app/[marca]/page.tsx`, `app/[marca]/m/[slug]/**/page.tsx` (ficha, obra, sala, libro, inauguración, adquirir)

**Interfaces:**
- Consumes: `marcaDeDisciplina`, `origenPublico` (Task 1)
- Produces:
  - `listarPublicas(marca: MarcaId)`: con FOTOGRAFIA agrega `where.primaryDiscipline = "FOTOGRAFIA"`; con ARTE, sin filtro.
  - `decidirCasa(marcaPedida: MarcaId, primaryDiscipline: string): { tipo: "mostrar"; canonical: string } | { tipo: "redirigir"; destino: string }`
  - `canonicalDe(primaryDiscipline: string, ruta: string): string`

- [ ] **Step 1: Pruebas que fallan**

```ts
it("pintura pedida en fotografía redirige al dominio de arte", () =>
  expect(decidirCasa("FOTOGRAFIA", "PINTURA")).toEqual({ tipo: "redirigir", destino: "https://muestrasdearte.com" }));
it("fotografía pedida en arte se muestra con canonical a fotografía", () =>
  expect(decidirCasa("ARTE", "FOTOGRAFIA")).toEqual({ tipo: "mostrar", canonical: "https://muestrasfotograficas.com" }));
it("pintura en arte se muestra con canonical propio", () =>
  expect(decidirCasa("ARTE", "PINTURA")).toEqual({ tipo: "mostrar", canonical: "https://muestrasdearte.com" }));
it("listarPublicas filtra sólo en fotografía", async () => {
  await listarPublicas("FOTOGRAFIA");
  expect(db.culturalActivity.findMany.mock.calls[0]![0].where).toMatchObject({ reviewStatus: "APPROVED", primaryDiscipline: "FOTOGRAFIA" });
  await listarPublicas("ARTE");
  expect(db.culturalActivity.findMany.mock.calls[1]![0].where).toEqual({ reviewStatus: "APPROVED" });
});
```

(`origenPublico` se llama con un env de producción inyectado en las pruebas.)

- [ ] **Step 2: Implementar y conectar**
  - En cada página bajo `app/[marca]/m/[slug]/`, después de `buscarPorSlug`: si `decidirCasa` dice redirigir, llamar `permanentRedirect(destino + ruta)` (308) con la misma ruta y `search`.
  - En `generateMetadata`: `alternates: { canonical: canonicalDe(a.primaryDiscipline, ruta) }`.
  - Portada: `listarPublicas(marca.id)`.
- [ ] **Step 3:** Pruebas → PASS.
- [ ] **Step 4: Commit** — `git commit -m "Muestras: cada muestra vive en su dominio de casa"`

### Task 9: Disciplina en el formulario de la muestra

**Files:**
- Modify: `lib/actividades/mapear.ts` (`FichaForm`, `fichaDesdeFormData`, `datosParaGuardar`), `lib/actividades/mapear.test.ts`
- Modify: `components/formulario/formulario-actividad.tsx`, las páginas que lo usan (`app/[marca]/panel/proponer/page.tsx`, `app/[marca]/panel/muestras/[id]/page.tsx`)
- Modify: `lib/actividades/acciones.ts` (confirmación al cambiar de fotografía a otra con la muestra publicada)

**Interfaces:**
- Consumes: `DISCIPLINES`, `isDiscipline`, `parseOtherDisciplines`, `PHOTOGRAPHY` (Task 6), `Marca` (Task 1)
- Produces:
  - `FichaForm.primaryDiscipline: Discipline`, `FichaForm.otherDisciplines: Discipline[]`
  - `fichaDesdeFormData(fd, opciones & { marca: MarcaId })`
  - Error de validación `"Elegí la disciplina principal."`
  - Campo de formulario `confirmarCambioDeCasa=on`

- [ ] **Step 1: Pruebas que fallan** (`mapear.test.ts`)

```ts
it("en fotografía, sin campo, la disciplina es FOTOGRAFIA", () =>
  expect(fichaDesdeFormData(fdBase(), { marca: "FOTOGRAFIA" }).primaryDiscipline).toBe("FOTOGRAFIA"));
it("en arte la disciplina es obligatoria", () =>
  expect(validarFicha(fichaDesdeFormData(fdBase(), { marca: "ARTE" }))).toContain("Elegí la disciplina principal."));
it("guarda la principal y las secundarias limpias", () =>
  expect(datosParaGuardar(fichaDesdeFormData(fdBase({ primaryDiscipline: "PINTURA", otherDisciplines: ["DIBUJO", "PINTURA"] }), { marca: "ARTE" })))
    .toMatchObject({ primaryDiscipline: "PINTURA", otherDisciplines: ["DIBUJO"] }));
```

Y en `acciones.test.ts`: guardar una muestra APPROVED que pasa de FOTOGRAFIA a PINTURA sin `confirmarCambioDeCasa` devuelve `{ ok: false, error: "Esta muestra va a pasar a verse en muestrasdearte.com. Confirmá el cambio." }`, y no llama a `update`.

`validarFicha` es la función de validación que ya usa `acciones.ts`; si tiene otro nombre, usar ese.

- [ ] **Step 2: Implementar**

Formulario:
- En ARTE: un `select name="primaryDiscipline"` obligatorio, sin opción preseleccionada, y casillas `otherDisciplines`.
- En FOTOGRAFIA: un `input type="hidden" value="FOTOGRAFIA"`, y las mismas opciones dentro de un `<details>` «Más opciones» cerrado. Ahí, si se elige otra, aparece el aviso «Esta muestra va a vivir en muestrasdearte.com» y, si está publicada, la casilla de confirmación.
- El tipo `SALIDA` no se lista en ARTE.

- [ ] **Step 3: Panel.** En «Mis muestras» (`app/[marca]/panel/muestras/page.tsx`), cada fila lleva la etiqueta de su dominio de casa («Fotografía» / «Arte»). En el panel de la muestra, el acceso a «Concurso» (importar desde FotoRank/Clickatón, `app/[marca]/panel/muestras/[id]/concurso`) sólo aparece si la principal es FOTOGRAFIA; la página responde `notFound()` si no lo es (spec 6.12).
- [ ] **Step 4:** Pruebas → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Muestras: disciplina principal y secundarias en el formulario"`

### Task 10: Enlaces impresos y correos con el dominio de casa

**Files:**
- Modify: `lib/fichas/cargar.ts` (`baseUrlPublica`), `lib/fichas/pdf.ts` (texto «muestrasfotograficas.com» del pie), `lib/piezas/textos.ts`, `lib/ventas/certificado.ts` («Verificá en …/verificar»), `lib/correos/enviar.ts`, `lib/correos/convocatorias.ts`, `lib/correos/equipo.ts`, `lib/correos/inauguracion.ts`, `lib/concursos/consultas.ts`, `lib/expositores/consultas.ts`, `lib/inauguracion/publicas.ts`, `lib/ventas/pedido-comprador.ts`, `app/api/piezas/[id]/[pieza]/route.ts`, `app/api/redes/[id]/route.ts`, `app/[marca]/m/[slug]/inauguracion/**`, `app/[marca]/panel/difusion/**`, `app/api/geocode/route.ts` y `lib/portada/geocodificar.ts` (User-Agent genérico `MuestrasDNX/1.0`)
- Modify: `packages/muestras/src/sales.ts` (descriptor por marca) y donde se arman las `back_urls`/`notification_url` de Mercado Pago en `lib/ventas/` (que usen `baseUrlPublica(undefined, a.primaryDiscipline)`)
- Test: `lib/fichas/cargar.test.ts`, `lib/ventas/certificado.test.ts`, `lib/correos/*.test.ts` (los que arman enlaces)

**Interfaces:**
- Consumes: `marcaDeDisciplina`, `origenPublico` (Task 1)
- Produces:
  - `baseUrlPublica(env?, primaryDiscipline?: string | null): string`: conserva las reglas de hoy para fotografía; arte usa `origenPublico(MARCAS.ARTE, env)`.
  - `saleStatementDescriptor(brand: "FOTOGRAFIA" | "ARTE"): string`. `SALE_STATEMENT_DESCRIPTOR` queda como alias de FOTOGRAFIA.

- [ ] **Step 1: Pruebas que fallan**
  - `baseUrlPublica({ VERCEL_ENV: "production", APP_URL: "https://muestrasfotograficas.com" }, "PINTURA")` es `"https://muestrasdearte.com"`.
  - Con `"FOTOGRAFIA"` o `undefined`, el resultado de hoy.
  - El certificado de una muestra de PINTURA dice «Verificá en muestrasdearte.com/verificar».
  - La invitación de inauguración de una muestra de PINTURA enlaza a `https://muestrasdearte.com/m/<slug>/inauguracion`.
  - El remitente de los correos de una muestra de arte se llama «Muestras de Arte».
- [ ] **Step 2: Implementar**
  - Cada consulta que alimenta estas funciones suma `primaryDiscipline` a su `select`.
  - En los correos, `APP_URL` queda sólo para lo que no es de una muestra (revisión del super admin).
- [ ] **Step 3:** `pnpm --filter muestras test && pnpm --filter @repo/muestras test` → PASS.
- [ ] **Step 4: Commit** — `git commit -m "Muestras: QR, piezas, certificados y correos con el dominio de la muestra"`

### Task 11: Perfil de artista y `/artistas`

**Files:**
- Move: `app/[marca]/fotografos/**` → queda. Create: `app/[marca]/artistas/page.tsx` y `app/[marca]/artistas/[slug]/page.tsx`, que reutilizan los mismos componentes (extraer el cuerpo a `components/perfil/pagina-autores.tsx` y `components/perfil/pagina-perfil.tsx`).
- Modify: `components/perfil/formulario-perfil.tsx` (casillas de disciplinas; el prefijo de la URL sale de la marca, no de «muestrasfotograficas.com/fotografos/»), `lib/perfiles/mapear.ts`, `lib/perfiles/acciones.ts`
- Create: `lib/perfiles/casa.ts` + test

**Interfaces:**
- Consumes: `DISCIPLINES`, `parseOtherDisciplines` (Task 6), `marcaDeDisciplina`, `origenPublico` (Task 1)
- Produces:
  - `casaDePerfil(disciplines: string[]): MarcaId` (sólo `["FOTOGRAFIA"]` o vacío → FOTOGRAFIA; si no, ARTE)
  - `rutaDePerfil(marca: Marca, slug: string): string`

- [ ] **Step 1: Pruebas que fallan**

```ts
expect(casaDePerfil(["FOTOGRAFIA"])).toBe("FOTOGRAFIA");
expect(casaDePerfil([])).toBe("FOTOGRAFIA");
expect(casaDePerfil(["FOTOGRAFIA", "PINTURA"])).toBe("ARTE");
expect(perfilDesdeFormData(fd({ disciplines: ["PINTURA", "X"] })).disciplines).toEqual(["PINTURA"]);
expect(perfilDesdeFormData(fd({})).disciplines).toEqual(["FOTOGRAFIA"]);
```

- [ ] **Step 2: Implementar las reglas de la spec 6.1**
  - `/artistas/<slug>` en fotografía redirige (308) a `/fotografos/<slug>`, y `/fotografos/<slug>` en arte redirige a `/artistas/<slug>`.
  - Si la casa del perfil es la otra marca, se redirige a ese dominio.
  - Canonical, el de la casa.
  - `/fotografos` lista sólo perfiles de casa FOTOGRAFIA. `/artistas` lista todos.
- [ ] **Step 3:** Pruebas → PASS.
- [ ] **Step 4: Commit** — `git commit -m "Muestras: perfil de artista con disciplinas y /artistas"`

### Task 12: Portada de arte con filtro por disciplina

**Files:**
- Modify: `app/[marca]/page.tsx`, `components/listado/filtros.tsx`, `components/listado/tarjeta-actividad.tsx` (etiqueta de disciplina sólo en ARTE), `components/portada/banner.tsx`
- Modify: `packages/muestras/src/gallery.ts` o donde viva `applyFilter`: suma `discipline?: Discipline`, que coincide con la principal o con alguna secundaria.

**Interfaces:**
- Consumes: `listarPublicas(marca)` (Task 8), `DISCIPLINE_LABELS` (Task 6)
- Produces: parámetro de búsqueda `?disciplina=PINTURA`; `applyFilter(items, { …, discipline })`

- [ ] **Step 1: Prueba que falla** (paquete): `applyFilter` con `discipline: "DIBUJO"` devuelve la muestra de principal PINTURA con secundaria DIBUJO y excluye la de principal ESCULTURA sin secundarias.
- [ ] **Step 2: Implementar**
  - En ARTE: chips de disciplinas presentes en la lista, con «Todas» al principio.
  - El banner de arte es la grilla de Task 3, alimentada con hasta 8 muestras de arte abiertas o próximas que tengan portada.
  - En FOTOGRAFIA no se muestran chips.
- [ ] **Step 3:** Pruebas → PASS. Verificar con curl con host de arte que aparezca `?disciplina=`.
- [ ] **Step 4: Commit** — `git commit -m "Muestras: portada de arte con filtro por disciplina"`

### Task 13: robots.txt y sitemap.xml por dominio

**Files:**
- Create: `app/api/sitio/robots/route.ts`, `app/api/sitio/sitemap/route.ts`, `lib/sitio/sitemap.ts` + test
- Modify: `next.config.ts`: dos rewrites en `beforeFiles`: `/robots.txt` → `/api/sitio/robots` y `/sitemap.xml` → `/api/sitio/sitemap`.

**Interfaces:**
- Consumes: `marcaPorHost`, `origenPublico`, `casaDePerfil`, `marcaDeDisciplina`
- Produces: `urlsDelSitemap(marca: MarcaId, muestras: { slug: string; primaryDiscipline: string; updatedAt: Date }[], perfiles: { slug: string; disciplines: string[]; updatedAt: Date }[]): { loc: string; lastmod: string }[]`

- [ ] **Step 1: Prueba que falla**
  - Con una muestra de FOTOGRAFIA y una de PINTURA, el sitemap de FOTOGRAFIA incluye sólo `https://muestrasfotograficas.com/m/<foto>`, y el de ARTE sólo `https://muestrasdearte.com/m/<pintura>`.
  - Con perfiles, lo mismo con `/fotografos/` y `/artistas/`.
- [ ] **Step 2: Implementar.** `robots.txt`: `Allow: /`, `Disallow: /panel`, `Sitemap: <origen>/sitemap.xml`. Las dos rutas con `revalidate = 3600`.
- [ ] **Step 3:** Pruebas → PASS.
- [ ] **Step 4: Commit** — `git commit -m "Muestras: robots y sitemap por dominio"`

### Task 14: Puesta en línea de muestrasdearte.com

- [ ] **Step 1:** `lint`, `test` y `check-types` en verde. PR «Muestras de Arte, etapa 2: disciplinas y muestrasdearte.com». `gh pr checks --watch`; fusiona Daniel. La migración (Task 7) tiene que estar aplicada **antes** de fusionar.
- [ ] **Step 2: Google OAuth.** Agregar `https://muestrasdearte.com/api/auth/google/callback` a las URIs autorizadas del cliente «DNX Suite — Web Apps» (cuenta compramelafoto@gmail.com, `authuser=1`), en el Chrome donde Daniel tenga esa sesión.
- [ ] **Step 3: R2.** Sumar `https://muestrasdearte.com` al CORS (PUT) del bucket privado `muestras-privado` y, si el público lo tiene, de `fotoffice-media`.
- [ ] **Step 4: Vercel.** Sacar la redirección temporal de los dominios con `PATCH /v9/projects/prj_yZNfeUfKtGhuGA4RXnfwQL10dDxq/domains/muestrasdearte.com` y `{"redirect": null}`. A `www.muestrasdearte.com`, redirigirlo con 308 a `muestrasdearte.com`.
- [ ] **Step 5: Verificar en producción** (con `?v=<timestamp>` por el CDN):
  - muestrasdearte.com muestra «Muestras de Arte» con 200.
  - www → 308 al apex.
  - Una muestra de fotografía se ve en los dos dominios y en arte tiene canonical a fotografía.
  - Ingreso con Google en arte vuelve a arte logueado.
  - Proponer una muestra de prueba de PINTURA en arte, sin enviarla a revisión, y borrarla después: no aparece en muestrasfotograficas.com.
  - muestrasfotograficas.com sin cambios visibles.
- [ ] **Step 6:** Actualizar la memoria `project_muestras_de_arte.md` con los PR, la migración y su checksum.

## Fuera de este plan

Etapas 3 a 6 de la spec: obras (vistas, YouTube, medidas, audioguía), convocatorias, montaje, informe de estado, agenda y venta. Cada una tiene su plan cuando termine la anterior. El filtro de `GET /api/public/actividades` va en el PR #481 cuando se fusione (spec 6.2).
