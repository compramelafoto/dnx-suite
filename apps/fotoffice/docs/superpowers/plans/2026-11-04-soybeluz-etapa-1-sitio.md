# SOYBELUZ — Etapa 1: la web básica — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar publicada la web de SOYBELUZ dentro de FOTOFFICE, con la marca de Belén, las diez secciones de su menú, la propuesta gratuita y el catálogo de cursos visibles, y Belén y Daniel como administradores.

**Architecture:** SOYBELUZ es una institución más de FOTOFFICE (`Workspace` `ws_soybeluz`, slug `soybeluz`), como Gus Barbers. La web se arma con el constructor de sitios que ya existe: páginas y bloques guardados en `FotofficeWorkspaceWebsite.sectionsJson`, menú en `navJson` y diseño en `designPresetsJson`. Un script idempotente da de alta la institución y carga el borrador del sitio. El único cambio de código compartido es sumar DejaVu Sans, la letra del manual de marca, al catálogo de tipografías. En esta etapa no se crean tablas: suscripción con acceso automático, calendario de encuentros, descargables y kit son la Etapa 2 (ver el análisis).

**Tech Stack:** Next.js 16.2 (`apps/fotoffice`, leer `node_modules/next/dist/docs/` antes de tocar APIs de Next), React 19.2, Prisma (`@repo/db`), Vitest, `next/font/local`.

**Spec:** [docs/proyecto-soybeluz.md](../../proyecto-soybeluz.md) (brief de Belén), [docs/analisis-comunidad-belen.md](../../analisis-comunidad-belen.md) (decisiones técnicas) y el manual de marca `Soy_Beluz_Manual_de_Marca (1).pdf` (V1.1, noviembre 2026; copia en `~/Desktop/RAFAELA EN FOCO/videos clf en rafaela/`).

## Antes de la Tarea 1 (lo pidió Belén)

Belén quiere ver primero un **esquema visual** de las secciones y después el desarrollo. Antes de ejecutar las tareas, se le muestra una maqueta navegable (celular y computadora) de Inicio, Clases creativas gratuitas, Espacio creativo, Cursos y Suscripción, armada con los bloques de la Tarea 3 y la paleta del manual. Su aprobación (o los cambios que pida) entran en el contenido de la Tarea 3.

## Global Constraints

Del manual de marca (V1.1):
- **Paleta:** Cacao `#60433A` (principal), Rosa viejo `#C99A9D` (secundario), Arena `#E5D4C2` (apoyo), Terracota `#B87A60` (acento), Marfil `#FAF6EF` (fondo). **No se usan colores fuera de esta paleta.**
- "Cacao y marfil sostienen la lectura. El rosa acompaña sin dominar." Los textos van en cacao sobre fondos claros. **Nunca rosa claro sobre arena ni sobre fotos complejas.**
- **Tipografía de apoyo:** DejaVu Sans, Bold para títulos y Regular para textos. **Cuerpo de texto web: 16 px o más.** Sin párrafos largos en mayúsculas ni en letras finas.
- **Logo:** se usa siempre el arte provisto. No se vuelve a escribir ni a dibujar "soy Beluz", no se deforma, no se le agregan efectos y no se recolorea. Versión principal: cacao + rosa sobre marfil. Versión negativa: marfil sobre cacao. Mínimos: logo 200 px, isotipo 32 px. El **isotipo** va de favicon. Área libre: 1/4 del ancho del isotipo en los cuatro lados.
- **Voz:** "personas, comunidad, participantes, quienes quieren aprender, aprendemos, creamos". Invitaciones: «Vení a crear con Beluz», «Un espacio para aprender y compartir», «Cada persona encuentra su manera de crear». **No usar "crear juntas" ni otras formas que excluyan.** Por eso el vocabulario de la institución es "participante", nunca "socio" ni "alumna".
- **Frases de actividad** (como título, nunca como logo nuevo): «Creá con Beluz», «El Club de Beluz», «La Caja de Beluz», «Una Tarde con Beluz».
- **Accesibilidad:** cada actividad indica edad sugerida, nivel, modalidad, materiales, duración y apoyos. Contraste suficiente.
- Dominio y redes: `soybeluz.com`, `@soybeluz`.

Del brief y del pedido de Daniel:
- Administradores: `belenfister@gmail.com` (User 57, dueña) y `dnxfotografia@gmail.com` (User 4, admin). Las dos cuentas ya existen en la base de FOTOFFICE (verificado el 4/11/2026); el slug `soybeluz` está libre.
- Menú (brief, sección 9): Inicio · Clases creativas gratuitas · Espacio creativo · Cursos · Materiales · Encuentros en vivo · Comunidad · Sobre SOYBELUZ · Mi cuenta · Suscripción.
- **SFPR y las demás instituciones no pueden cambiar:** nada de esta etapa modifica su sitio, su menú ni sus letras.

## Review Focus

1. **Letra en dominio propio:** en `soybeluz.com`, `proxy.ts` reescribe todo lo que no sea `/_next/static` o `/_next/image` hacia `/w/soybeluz/…`. Un woff2 servido desde `public/` se rompería ahí; por eso la letra va con `next/font/local`, que sirve sus archivos bajo `/_next/static/media`. Se prueba en la Tarea 1 y se verifica en la Tarea 5.
2. **Sitios existentes sin cambios:** los sitios que no eligen DejaVu Sans no tienen que descargarla ni cambiar su CSS. Test en la Tarea 1.
3. **Contraste del manual:** ningún bloque del contenido puede quedar con texto rosa viejo o arena sobre fondo arena o marfil. Test en la Tarea 3.
4. **Volver a correr el script no pisa el trabajo de Belén:** si el sitio ya tiene páginas, el script no las reemplaza. Test en la Tarea 4.
5. **Celular:** la mayoría va a entrar desde Instagram con el celular. El menú de diez ítems tiene que funcionar en 375 px. Se verifica en la Tarea 5.

---

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `apps/fotoffice/app/_fonts/dejavu-sans-400.woff2`, `dejavu-sans-700.woff2` (crear) | Archivos de la letra (Fontsource, juego latino) |
| `apps/fotoffice/app/_fonts/dejavu-sans.ts` (crear) | `localFont` de DejaVu Sans, con la variable CSS `--font-dejavu-sans` |
| `apps/fotoffice/lib/website/typography.ts` (modificar) | Suma la opción `dejavu-sans` al catálogo |
| `apps/fotoffice/components/website/render/site-frame.tsx` (modificar) | Aplica la variable de la letra local cuando el diseño la usa |
| `apps/fotoffice/scripts/soybeluz/sitio.ts` (crear) | El contenido de la web como datos: páginas, bloques, menú y diseño |
| `apps/fotoffice/scripts/soybeluz/sitio.test.ts` (crear) | Valida el contenido contra los esquemas y el manual |
| `apps/fotoffice/scripts/soybeluz/alta.ts` (crear) | `planDeAlta()`, función pura que decide qué crear o saltear |
| `apps/fotoffice/scripts/soybeluz/alta.test.ts` (crear) | Idempotencia y no pisar |
| `apps/fotoffice/scripts/alta-soybeluz.ts` (crear) | Ejecuta el alta contra la base (`--mirar` / `--aplicar`) |
| `apps/fotoffice/package.json` (modificar) | Script `soybeluz:alta` |

---

### Task 1: DejaVu Sans en el catálogo de letras del sitio

**Files:**
- Create: `apps/fotoffice/app/_fonts/dejavu-sans-400.woff2`, `apps/fotoffice/app/_fonts/dejavu-sans-700.woff2`, `apps/fotoffice/app/_fonts/dejavu-sans.ts`
- Modify: `apps/fotoffice/lib/website/typography.ts:24-66` (tipo `FontOption` y `FONT_OPTIONS`), `apps/fotoffice/components/website/render/site-frame.tsx:30-36`
- Test: `apps/fotoffice/lib/website/typography.test.ts` (si no existe, crearlo junto al archivo)

**Interfaces:**
- Produces: `FontOption.local: "dejavu-sans" | null` (nuevo campo; las opciones existentes llevan `null`). Opción `{ id: "dejavu-sans", label: "DejaVu Sans", category: "sans", stack: "var(--font-dejavu-sans), 'DejaVu Sans', Verdana, sans-serif", google: null, local: "dejavu-sans", weights: [400, 700] }`. `localFontsUsed(levels: Record<TypographyLevelId, TypographyLevel>): ("dejavu-sans")[]`. `export const dejavuSans` en `app/_fonts/dejavu-sans.ts`.

- [ ] **Step 1: Bajar los archivos de la letra**

```bash
cd apps/fotoffice/app/_fonts
curl -sfLo dejavu-sans-400.woff2 https://cdn.jsdelivr.net/fontsource/fonts/dejavu-sans@latest/latin-400-normal.woff2
curl -sfLo dejavu-sans-700.woff2 https://cdn.jsdelivr.net/fontsource/fonts/dejavu-sans@latest/latin-700-normal.woff2
```
Expected: dos archivos de más de 100 KB (el 400 pesa unos 250 KB). La licencia de DejaVu permite incluirlos en el sitio. Van en `_fonts`, con guion bajo: una carpeta sin `_` ocuparía una dirección de institución y rompería `institution-shortcut.test.ts`.

- [ ] **Step 2: Escribir los tests que fallan**

```ts
describe("DejaVu Sans", () => {
  it("está en el catálogo como letra local, no de Google", () => {
    const f = getFont("dejavu-sans");
    expect(f.id).toBe("dejavu-sans");
    expect(f.google).toBeNull();
    expect(f.local).toBe("dejavu-sans");
    expect(f.weights).toEqual([400, 700]);
    expect(f.stack.startsWith("var(--font-dejavu-sans)")).toBe(true);
  });
  it("no pide nada a Google Fonts", () => {
    expect(googleFontsHref(nivelesTodosCon("dejavu-sans"))).toBeNull();
  });
  it("localFontsUsed la detecta solo cuando algún nivel la usa", () => {
    expect(localFontsUsed(nivelesTodosCon("dejavu-sans"))).toEqual(["dejavu-sans"]);
    expect(localFontsUsed(nivelesTodosCon("inter"))).toEqual([]);
  });
  it("todas las opciones existentes siguen sin letra local", () => {
    expect(FONT_OPTIONS.filter((f) => f.local !== null).map((f) => f.id)).toEqual(["dejavu-sans"]);
  });
});
```
`nivelesTodosCon(id)` es un ayudante del test que arma los seis niveles de `TYPOGRAPHY_LEVELS` con esa letra y peso 400.

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/website/typography.test.ts`
Expected: FAIL (`dejavu-sans` no existe y `localFontsUsed` no está definida).

- [ ] **Step 4: Implementar**

- `app/_fonts/dejavu-sans.ts`: `export const dejavuSans = localFont({ src: [{ path: "./dejavu-sans-400.woff2", weight: "400" }, { path: "./dejavu-sans-700.woff2", weight: "700" }], variable: "--font-dejavu-sans", display: "swap", preload: false })`. Va con `preload: false` para que los sitios que no la usan no la descarguen. Copiá la forma de cargar del resto de `app/_fonts` y de `app/layout.tsx`.
- `typography.ts`: el campo `local` en `FontOption`, `local: null` en todas las opciones existentes, la opción nueva en la categoría "sans" y `localFontsUsed`.
- `site-frame.tsx`: si `localFontsUsed(resolvedTypography(designPresets))` incluye `"dejavu-sans"`, sumá `dejavuSans.variable` al `className` del contenedor externo. Si hace falta, exportá `resolvedTypography` desde `design-presets.ts`.

- [ ] **Step 5: Correr los tests**

Run: `cd apps/fotoffice && pnpm vitest run lib/website`
Expected: PASS, incluidos los tests que ya existían del sitio.

- [ ] **Step 6: Typecheck y build**

Run: `cd apps/fotoffice && pnpm typecheck && pnpm build`
Expected: sin errores. El build importa porque `next/font/local` resuelve los archivos en esa etapa, y el CI de FOTOFFICE no corre `next build`. Si `typecheck` termina sin salida en segundos, se quedó sin memoria: repetilo con `NODE_OPTIONS=--max-old-space-size=8192`.

- [ ] **Step 7: Commit**

```bash
git add apps/fotoffice/app/_fonts/dejavu-sans* apps/fotoffice/lib/website/typography.ts apps/fotoffice/lib/website/typography.test.ts apps/fotoffice/components/website/render/site-frame.tsx apps/fotoffice/lib/website/design-presets.ts
git commit -m "Sumar DejaVu Sans al catálogo de letras del sitio"
```

### Task 2: Vista previa con la letra en el editor del sitio

**Files:**
- Modify: el selector de letras del editor (buscá con `git grep -n "FONT_OPTIONS" apps/fotoffice/components`) y su muestra de texto
- Test: el test del componente si existe; si no, verificación manual en el Step 3

**Interfaces:**
- Consumes: `FontOption.local` y `dejavuSans` de la Task 1.

- [ ] **Step 1: Que la muestra se vea con la letra real**

En el selector, cuando una opción tiene `local === "dejavu-sans"`, la muestra lleva `dejavuSans.variable` en su `className`, para que Belén vea la letra real y no el respaldo Verdana.

- [ ] **Step 2: Typecheck**

Run: `cd apps/fotoffice && pnpm typecheck`
Expected: sin errores.

- [ ] **Step 3: Verificar en el navegador**

Levantar FOTOFFICE local con la configuración de `.claude/launch.json` (si `preview_start` no puede leer el Escritorio, usar un worktree fuera de él). En `/website` de una institución de prueba, abrir Diseño → Tipografía. DejaVu Sans aparece en "Sans" y su muestra se ve con la letra real (las "g" y las "y" de DejaVu se distinguen de las de Verdana).

- [ ] **Step 4: Commit**

```bash
git commit -am "Mostrar DejaVu Sans con su letra real en el editor"
```

### Task 3: El contenido de la web como datos

**Files:**
- Create: `apps/fotoffice/scripts/soybeluz/sitio.ts`
- Test: `apps/fotoffice/scripts/soybeluz/sitio.test.ts`

**Interfaces:**
- Consumes: `bloque()` y `enOrden()` de `lib/website/templates/tipos.ts`; tipos `WebsiteBlock` y el esquema de páginas de `lib/website/blocks.ts`; `SiteMenu` y `SITE_MENU_VERSION` de `lib/website/site-menu.ts`; `WebsiteDesignPresets` y `DEFAULT_DESIGN_PRESETS` de `lib/website/design-presets.ts`.
- Produces: `export const SOYBELUZ_COLORES: WebsiteColors & { panelColor: string }`, `export const SOYBELUZ_PAGINAS: SiteTemplatePage[]`, `export const SOYBELUZ_MENU: SiteMenu`, `export const SOYBELUZ_DISENO: WebsiteDesignPresets`.

**Valores fijos:**
- `SOYBELUZ_COLORES`: `primaryColor #60433A`, `secondaryColor #C99A9D`, `backgroundColor #FAF6EF`, `textColor #60433A`, `accentColor #B87A60`, `panelColor #E5D4C2`.
- `SOYBELUZ_DISENO`: parte de `DEFAULT_DESIGN_PRESETS`. Pone `dejavu-sans` en los seis niveles de `typographyLevels`, con peso 700 en `title` y `heading` y 400 en el resto. El tamaño de `body` tiene que resolverse en 16 px o más.

**Páginas** (clave → bloques; los textos salen del brief, en la voz del manual):

| Clave | Bloques |
|---|---|
| `home` | HERO «Aprender, crear y compartir.» con subtítulo «Un espacio para aprender y compartir» y botones a Clases gratuitas y Espacio creativo · FEATURES «Dos maneras de participar» (gratuita / suscripción, brief §16) · TEXT «Cada persona encuentra su manera de crear» (enfoque, brief §1) · CTA «Vení a crear con Beluz» |
| `clases-gratuitas` | TEXT qué son las Clases Creativas (brief §2) · FEATURES cómo es la dinámica (los siete puntos del brief) · TEXT día y horario: **«a confirmar»**, editable por Belén · FAQ «Próximas propuestas» (Belén la va actualizando) · CTA a Instagram `@soybeluz` · WHATSAPP_BUTTON «Sumate al grupo gratuito» (enlace a cargar) |
| `espacio-creativo` | HERO «El Club de Beluz» · FEATURES lo que incluye la suscripción (brief §3) · TEXT «Dibujar con lo que tenemos en casa» (brief §5) · CTA a Suscripción |
| `materiales` | TEXT introducción (brief §5) · FAQ con las seis preguntas del brief §5 (respuestas a completar por Belén) |
| `encuentros` | TEXT cómo son los encuentros quincenales (brief §6) · TEXT «El calendario se publica para participantes con suscripción» · CTA a Suscripción |
| `comunidad` | TEXT la comunidad privada (brief §7, incluido «no es un espacio de competencia ni comparación») · CTA a Suscripción |
| `sobre` | TEXT «Sobre SOYBELUZ» y Belén (brief §8) · IMAGE foto de Belén (vacía hasta que la mande) |
| `suscripcion` | TEXT precio **«a definir»**, medios de pago, renovación y cancelación · FORM «Avisame cuando abra la suscripción» con nombre, correo y WhatsApp (lista de espera hasta la Etapa 2) |

El menú (`SOYBELUZ_MENU`) sigue el orden del brief. "Cursos" apunta a la página de módulo de cursos, que ya existe (`/w/soybeluz/cursos`). "Mi cuenta" apunta al ingreso del portal. Las demás entradas apuntan a las claves de la tabla.

Cada actividad que nombre una propuesta concreta (clases gratuitas, encuentros) incluye la línea de accesibilidad del manual: **edad sugerida, nivel, modalidad, materiales y duración**. Donde Belén no definió un dato, va «a confirmar».

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe("sitio de SOYBELUZ", () => {
  it("cada página pasa el esquema de bloques del constructor", () => {
    for (const p of SOYBELUZ_PAGINAS) expect(() => parsePagina(p)).not.toThrow();
  });
  it("tiene las diez entradas del menú del brief, en orden", () => {
    expect(SOYBELUZ_MENU.items.map((i) => i.label)).toEqual([
      "Inicio", "Clases creativas gratuitas", "Espacio creativo", "Cursos", "Materiales",
      "Encuentros en vivo", "Comunidad", "Sobre SOYBELUZ", "Mi cuenta", "Suscripción",
    ]);
  });
  it("cada entrada custom del menú apunta a una página que existe", () => {
    const claves = new Set(SOYBELUZ_PAGINAS.map((p) => p.clave));
    for (const i of entradasCustom(SOYBELUZ_MENU)) expect(claves.has(i.pageKey)).toBe(true);
  });
  it("usa solo colores de la paleta del manual", () => {
    const paleta = ["#60433A", "#C99A9D", "#E5D4C2", "#B87A60", "#FAF6EF"];
    for (const hex of coloresUsados(SOYBELUZ_PAGINAS, SOYBELUZ_COLORES)) expect(paleta).toContain(hex.toUpperCase());
  });
  it("no pone texto rosa viejo ni arena sobre fondo arena o marfil", () => {
    expect(paresDeContrasteProhibidos(SOYBELUZ_PAGINAS, SOYBELUZ_COLORES)).toEqual([]);
  });
  it("respeta la voz del manual", () => {
    const texto = textoVisible(SOYBELUZ_PAGINAS).toLowerCase();
    for (const prohibida of ["juntas", "socio", "socia", "alumnas"]) expect(texto).not.toContain(prohibida);
  });
  it("el cuerpo de texto se ve en 16 px o más con DejaVu Sans", () => {
    const t = resolvedTypography(SOYBELUZ_DISENO);
    expect(tamañoEnPx(t.body)).toBeGreaterThanOrEqual(16);
    expect(Object.values(t).every((n) => n.font === "dejavu-sans")).toBe(true);
  });
});
```
`parsePagina`, `entradasCustom`, `coloresUsados`, `paresDeContrasteProhibidos`, `textoVisible` y `tamañoEnPx` son ayudantes del test. Se escriben con los esquemas y tipos de `blocks.ts`, `site-menu.ts` y `typography.ts`, no a mano.

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd apps/fotoffice && pnpm vitest run scripts/soybeluz/sitio.test.ts`
Expected: FAIL (no existe `sitio.ts`). Si `vitest.config.ts` no incluye `scripts/**`, sumá el patrón en el mismo commit.

- [ ] **Step 3: Escribir `sitio.ts`** con los valores y la tabla de arriba.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd apps/fotoffice && pnpm vitest run scripts/soybeluz/sitio.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/scripts/soybeluz/sitio.ts apps/fotoffice/scripts/soybeluz/sitio.test.ts apps/fotoffice/vitest.config.ts
git commit -m "Contenido de la web de SOYBELUZ según el brief y el manual de marca"
```

### Task 4: Alta de la institución, idempotente y sin pisar

**Files:**
- Create: `apps/fotoffice/scripts/soybeluz/alta.ts`, `apps/fotoffice/scripts/soybeluz/alta.test.ts`, `apps/fotoffice/scripts/alta-soybeluz.ts`
- Modify: `apps/fotoffice/package.json` (script `"soybeluz:alta": "../../packages/db/node_modules/.bin/tsx --import ./scripts/sin-server-only.mjs scripts/alta-soybeluz.ts"`)

**Interfaces:**
- Consumes: todo lo que exporta la Task 3.
- Produces: `type EstadoActual = { workspace: boolean; branding: boolean; membresias: { email: string; role: string }[]; vocabulario: boolean; modulos: string[]; sitio: { tienePaginas: boolean } | null }` y `planDeAlta(estado: EstadoActual): Accion[]`. `Accion` es una unión discriminada (campo `tipo`) con `crearWorkspace`, `crearBranding`, `crearMembresia{email, role}`, `crearVocabulario`, `encenderModulo{key}`, `crearSitio` y `saltear{motivo}`. El script resuelve cada email a su `userId` al aplicar.

**Valores fijos:**
- `Workspace.id = "ws_soybeluz"`, `name = "Soy Beluz"`.
- Branding: `publicSlug "soybeluz"`, `commercialName "Soy Beluz"`, colores `SOYBELUZ_COLORES`, `instagram "soybeluz"`, `website "https://soybeluz.com"`, `organizationType` y `activityType` como el tipo "escuela/academia" de `lib/landing/tipos.ts`, `city "Rosario"`, `province "Santa Fe"`, `country "Argentina"`.
- Membresías: User 57 (`belenfister@gmail.com`) con `WORKSPACE_OWNER` y User 4 (`dnxfotografia@gmail.com`) con `WORKSPACE_ADMIN`. También van las filas legacy de `Membership`, como lo hace `createFotofficeWorkspaceForUser` en `lib/ensure-workspace.ts:200-255`. El script busca los usuarios **por email**, no por id.
- Vocabulario: `personSingular "participante"`, `personPlural "participantes"`.
- Módulos: `website`, `courses-sales`, `members`, `membership-dues`. Las claves salen de `lib/modules/registry.ts`; si alguna no existe, el script falla antes de escribir.
- Sitio: `FotofficeWorkspaceWebsite` con `sectionsJson` = `SOYBELUZ_PAGINAS`, `navJson` = `SOYBELUZ_MENU` y `designPresetsJson` = `SOYBELUZ_DISENO`, **sin publicar** (`publishedAt` null). Se publica desde el panel.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe("planDeAlta", () => {
  it("en una base sin nada, crea todo y deja el sitio sin publicar", () => {
    const acciones = planDeAlta(VACIO);
    expect(acciones.map((a) => a.tipo)).toEqual([
      "crearWorkspace", "crearBranding", "crearMembresia", "crearMembresia",
      "crearVocabulario", "encenderModulo", "encenderModulo", "encenderModulo", "encenderModulo", "crearSitio",
    ]);
    expect(acciones.filter((a) => a.tipo === "crearMembresia")).toEqual([
      { tipo: "crearMembresia", email: "belenfister@gmail.com", role: "WORKSPACE_OWNER" },
      { tipo: "crearMembresia", email: "dnxfotografia@gmail.com", role: "WORKSPACE_ADMIN" },
    ]);
  });
  it("correrlo dos veces no hace nada la segunda", () => {
    expect(planDeAlta(TODO_CREADO).every((a) => a.tipo === "saltear")).toBe(true);
  });
  it("si el sitio ya tiene páginas, no lo toca aunque falte otra cosa", () => {
    const acciones = planDeAlta({ ...TODO_CREADO, modulos: ["website"], sitio: { tienePaginas: true } });
    expect(acciones.some((a) => a.tipo === "crearSitio")).toBe(false);
    expect(acciones.filter((a) => a.tipo === "encenderModulo").length).toBe(3);
  });
  it("no baja de rol a quien ya es admin con otro rol", () => {
    const acciones = planDeAlta({ ...TODO_CREADO, membresias: [{ email: "dnxfotografia@gmail.com", role: "WORKSPACE_OWNER" }, { email: "belenfister@gmail.com", role: "WORKSPACE_OWNER" }] });
    expect(acciones.some((a) => a.tipo === "crearMembresia")).toBe(false);
  });
});
```
- [ ] **Step 2: Correr y verificar que falla**

Run: `cd apps/fotoffice && pnpm vitest run scripts/soybeluz/alta.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `planDeAlta` en `scripts/soybeluz/alta.ts`** como función pura, sin base.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd apps/fotoffice && pnpm vitest run scripts/soybeluz/alta.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribir `scripts/alta-soybeluz.ts`**

- Lee el estado con Prisma y llama a `planDeAlta`.
- Con `--mirar` (por defecto) imprime las acciones en español y no escribe nada.
- Con `--aplicar` ejecuta todo en una sola transacción e imprime el resultado.
- Antes de escribir, verifica que los dos emails existan; si falta uno, aborta con un mensaje claro.

- [ ] **Step 6: Typecheck y commit**

Run: `cd apps/fotoffice && pnpm typecheck`
```bash
git add apps/fotoffice/scripts/soybeluz/alta.ts apps/fotoffice/scripts/soybeluz/alta.test.ts apps/fotoffice/scripts/alta-soybeluz.ts apps/fotoffice/package.json
git commit -m "Script idempotente de alta de SOYBELUZ en FOTOFFICE"
```

- [ ] **Step 7: PR, CI verde y fusión**

Abrir un PR contra `main` con las Tasks 1 a 4. Esperar CI con `gh pr checks --watch` y fusionar con `gh pr merge --squash`. Verificar que el deploy de producción terminó.

### Task 5: Alta en producción, marca y publicación

Esta tarea toca la base de producción: el `--aplicar` se corre **con el permiso de Daniel**, después de mostrarle el `--mirar`.

- [ ] **Step 1: Mirar**

Run: `cd apps/fotoffice && pnpm soybeluz:alta` (con el `DATABASE_URL` de producción de FOTOFFICE: Neon `divine-hall`, rama `development`)
Expected: la lista de las 10 acciones de "base vacía". Mostrársela a Daniel.

- [ ] **Step 2: Aplicar y repetir**

Run: `pnpm soybeluz:alta --aplicar` y después `pnpm soybeluz:alta` otra vez.
Expected: la segunda corrida muestra todo "saltear".

- [ ] **Step 3: Verificar que SFPR no cambió**

Consulta de solo lectura: las cuatro instituciones existentes siguen con la misma cantidad de módulos, socios y dominio que en el análisis del 3/11 (SFPR 160 / 13 / 1, fotoclub-demo 160 / 13 / 0, foto-positiva 112 / 2 / 0, gusbarbers 0 / 13 / 0). `fotoffice.com/w/sfpr` se ve igual que antes.

- [ ] **Step 4: Logo e isotipo**

**Bloqueado hasta que Belén mande el paquete del manual** (SVG trazados y PNG transparentes, versiones color, cacao y marfil). Se cargan desde el panel en Configuración → Marca:
- `logoUrl`: el conjunto principal en color;
- `faviconUrl`: el isotipo en color.

Verificar que en el encabezado el logo no baje de 200 px de ancho en computadora; si no entra, que se use el isotipo, que no baja de 32 px. No se recorta ni se redibuja nada.

- [ ] **Step 5: Revisar el borrador y publicar**

Daniel y Belén entran a `/website` con sus cuentas, revisan el borrador, completan lo que dice «a confirmar» (día y horario de las clases, enlaces de WhatsApp) y publican.

Verificar en `fotoffice.com/w/soybeluz`, en 375 px y en computadora:
- las diez entradas del menú abren;
- la letra es DejaVu Sans (en la consola, `getComputedStyle(document.body).fontFamily` incluye `--font-dejavu-sans` resuelta);
- no hay errores en la consola.

- [ ] **Step 6: Dominio propio**

En el panel, Sitio → Dominio, conectar `soybeluz.com`. Daniel carga los DNS que indique el panel en el proveedor del dominio. Cuando quede CONNECTED, verificar en `soybeluz.com`:
- la página carga;
- **la letra carga** (en la pestaña de red, el woff2 responde 200 desde `/_next/static/media/…`, no 404);
- `www.soybeluz.com` redirige al dominio raíz.

- [ ] **Step 7: Registrar**

Actualizar la memoria `project_fotoffice_club_arte_belen.md` con el id de la institución, el estado del dominio y lo que quedó «a confirmar».

---

## Qué queda para la Etapa 2 (otro plan)

Según el análisis: acceso controlado por el pago (`paidThrough`), cursos incluidos en la suscripción con módulos y temáticas, la pantalla Mi suscripción, el calendario de clases gratuitas y encuentros, Descargables, el kit mensual y el probador de cuadros adaptado a artistas. En la Etapa 1, la página de Suscripción junta la lista de espera, y "Cursos" muestra el catálogo con la lógica actual (cada curso con su precio, o gratis).
