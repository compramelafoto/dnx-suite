# Portfolios del estudio — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solapa «Del estudio» en `/portfolios` con los Trabajos publicados agrupados por rubro → estilo, con «Abrir» y «Copiar enlace», más las etiquetas internas en la ficha de cada trabajo.

**Architecture:** Dos tablas nuevas (`FotofficePortfolioRubro`, `FotofficeTrabajoPortfolio`) sin tocar `FotofficeTrabajo`. Un módulo puro (`lib/portfolio-estudio/reglas.ts`) valida, arma URLs y agrupa; un repositorio server-only lee/escribe y tolera tablas faltantes (P2021). Pantalla server component + un componente cliente para buscar/copiar.

**Tech Stack:** Next.js (versión con cambios: leer `node_modules/next/dist/docs/` antes de escribir páginas/acciones), Prisma (`@repo/db`), Vitest, Tailwind con tokens `--fo-*`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-11-15-portfolios-del-estudio-design.md`

Todas las rutas son relativas a `apps/fotoffice/` salvo las de `packages/db`.

## Global Constraints

- Textos de pantalla en español rioplatense, claros para alguien que no programa.
- Todo filtrado por `workspaceId` sacado de la sesión; nunca del navegador.
- Estilos: texto libre, recortado, sin repetir (sin distinguir mayúsculas), máx. **6** por trabajo, máx. **40** caracteres cada uno.
- Presentaciones (`enlacesJson`): `https://` obligatorio, título ≤ **80**, máx. **10** por rubro.
- Nombre de rubro: 1–60 caracteres, único por workspace.
- Si faltan las tablas nuevas (Prisma `P2021`): la solapa muestra un aviso y la ficha del trabajo oculta el recuadro; nada da 500 y el sitio público no se entera.
- Migración: SQL idempotente, aplicado a mano en Neon `compramelafoto` rama `development` (`br-old-rain-adwthzng`) y registrado con `prisma migrate resolve --applied` **antes** de fusionar.

## Review Focus

1. Trabajo con etiquetas cuyo rubro se borró → va a «Sin etiquetar» (no desaparece, no rompe). Test en Task 2.
2. Trabajo publicado pero de categoría oculta / sin categoría / sitio sin publicar → nunca ofrece «Copiar enlace»; a la vendedora (sin `website` MANAGE) no le aparece. Test en Task 2 y Task 3.
3. Enlace con dominio propio conectado → `https://<dominio>/trabajos/<cat>/<slug>`; sin dominio → `<appUrl>/w/<slug>/trabajos/<cat>/<slug>`; sin slug público → `null` (no se ofrece copiar). Test en Task 2.
4. Estilos con mayúsculas/espacios distintos («Book previo» / « book previo ») → uno solo. Test en Task 2.
5. Portapapeles bloqueado (http, navegador viejo) → se muestra el enlace seleccionado para copiar a mano. Verificación manual en Task 6.

---

### Task 1: Tablas nuevas

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (después de `model FotofficeTrabajoFoto`)
- Create: `packages/db/prisma/migrations/20270212090000_fotoffice_portfolios_del_estudio/migration.sql`

**Interfaces:**
- Produces: `prisma.fotofficePortfolioRubro` (`id, workspaceId, nombre, orden, enlacesJson Json @default("[]"), createdAt, updatedAt`; `@@unique([workspaceId, nombre])`, `@@index([workspaceId, orden])`) y `prisma.fotofficeTrabajoPortfolio` (`id, workspaceId, trabajoId @unique, rubroId String?, estilos String[] @default([]), createdAt, updatedAt`; `@@index([workspaceId, rubroId])`). Sin relaciones Prisma (igual que Trabajos).

- [ ] **Step 1:** Agregar los dos modelos con comentario `///` que explique para qué son y que son internos.
- [ ] **Step 2:** Escribir el SQL idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE [UNIQUE] INDEX IF NOT EXISTS`, `TIMESTAMP(3)`, `"estilos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`, `"enlacesJson" JSONB NOT NULL DEFAULT '[]'`), con FK a `"Workspace"("id") ON DELETE CASCADE` en ambas dentro de `DO $$ … EXCEPTION WHEN duplicate_object` (como `20270130…` de archivos de trabajo).
- [ ] **Step 3:** `pnpm --filter @repo/db exec prisma validate` → OK; `pnpm --filter @repo/db exec prisma generate` → OK.
- [ ] **Step 4:** Commit «Sumar las tablas de portfolios del estudio».

### Task 2: Reglas puras

**Files:**
- Create: `lib/portfolio-estudio/reglas.ts`, `lib/portfolio-estudio/reglas.test.ts`

**Interfaces:**
- Produces:
  - `type Enlace = { titulo: string; url: string }`
  - `type Rubro = { id: string; nombre: string; orden: number; enlaces: Enlace[] }`
  - `type PortfolioTrabajo = { id: string; titulo: string; lugar: string | null; fecha: Date | null; destacado: boolean; portadaUrl: string | null; rubroId: string | null; estilos: string[]; compartible: boolean; motivo: string | null; url: string | null }`
  - `type GrupoEstilo = { estilo: string; trabajos: PortfolioTrabajo[] }`
  - `type GrupoRubro = { rubro: Rubro; estilos: GrupoEstilo[]; total: number }`
  - `normalizarEstilos(crudo: unknown): string[]`
  - `validarEnlaces(crudo: unknown): Enlace[]` (descarta los inválidos, recorta a 10)
  - `validarNombreRubro(n: unknown): string | null`
  - `urlDelTrabajo(i: { customDomain: string | null; appOrigin: string; slug: string | null; categoriaSlug: string; trabajoSlug: string }): string | null`
  - `motivoNoCompartible(i: { estado: string; categoriaVisible: boolean | null; sitioPublicado: boolean; url: string | null }): string | null` — `null` = compartible. Textos: «Es un borrador», «No tiene categoría», «Su categoría está oculta en el sitio», «El sitio no está publicado», «El sitio no tiene dirección pública».
  - `agrupar(rubros: Rubro[], trabajos: PortfolioTrabajo[]): { grupos: GrupoRubro[]; sinEtiquetar: PortfolioTrabajo[] }`
  - `const OTROS = "Otros"`

- [ ] **Step 1: Tests que fallan**

```ts
it("normaliza estilos: recorta, une mayúsculas, tope 6 de 40", () => {
  expect(normalizarEstilos([" Book previo", "book previo", "", 3, "x".repeat(41), "Fiesta"])).toEqual(["Book previo", "Fiesta"]);
  expect(normalizarEstilos(["a","b","c","d","e","f","g"])).toHaveLength(6);
});
it("valida enlaces: sólo https, título ≤ 80, máx 10", () => {
  expect(validarEnlaces([{ titulo: "XV", url: "https://www.compramelafoto.com/dnx/xv" }, { titulo: "x", url: "http://a.com" }, { titulo: "", url: "https://a.com" }]))
    .toEqual([{ titulo: "XV", url: "https://www.compramelafoto.com/dnx/xv" }]);
});
it("arma la URL con dominio propio, con /w/<slug> o null", () => {
  const b = { appOrigin: "https://fotoffice.com", categoriaSlug: "bodas", trabajoSlug: "sofi-y-misa" };
  expect(urlDelTrabajo({ ...b, customDomain: "dnxfotografia.com.ar", slug: "dnx-estudio" })).toBe("https://dnxfotografia.com.ar/trabajos/bodas/sofi-y-misa");
  expect(urlDelTrabajo({ ...b, customDomain: null, slug: "dnx-estudio" })).toBe("https://fotoffice.com/w/dnx-estudio/trabajos/bodas/sofi-y-misa");
  expect(urlDelTrabajo({ ...b, customDomain: null, slug: null })).toBeNull();
});
it("motivo: borrador, sin categoría, oculta, sitio sin publicar; null si se puede compartir", () => {
  const ok = { estado: "PUBLICADO", categoriaVisible: true, sitioPublicado: true, url: "https://x" };
  expect(motivoNoCompartible(ok)).toBeNull();
  expect(motivoNoCompartible({ ...ok, estado: "BORRADOR" })).toBe("Es un borrador");
  expect(motivoNoCompartible({ ...ok, categoriaVisible: null })).toBe("No tiene categoría");
  expect(motivoNoCompartible({ ...ok, categoriaVisible: false })).toBe("Su categoría está oculta en el sitio");
  expect(motivoNoCompartible({ ...ok, sitioPublicado: false })).toBe("El sitio no está publicado");
});
it("agrupa por rubro (en orden) y estilo; varios estilos = aparece en cada uno; sin estilo = Otros", ...);
it("dentro de un estilo: destacados primero, después fecha desc (sin fecha al final)", ...);
it("rubro inexistente o nulo → sinEtiquetar; rubro sin trabajos igual aparece con total 0", ...);
```

- [ ] **Step 2:** `pnpm vitest run lib/portfolio-estudio/reglas.test.ts` → FAIL (no existe el módulo).
- [ ] **Step 3:** Implementar. Los estilos de un rubro se ordenan por el primer orden de aparición en los trabajos ya ordenados, con «Otros» siempre al final.
- [ ] **Step 4:** Mismo comando → PASS.
- [ ] **Step 5:** Commit «Reglas de los portfolios del estudio».

### Task 3: Repositorio

**Files:**
- Create: `lib/portfolio-estudio/repositorio.ts`, `lib/portfolio-estudio/repositorio.test.ts`
- Modify: `lib/trabajos/repositorio.ts` (`borrarTrabajo`: borrar también su fila de `fotofficeTrabajoPortfolio` con `deleteMany({ where: { workspaceId, trabajoId } })`, tolerando P2021) y su test.

**Interfaces:**
- Consumes: todo lo de Task 2; `esTablaFaltante` de `lib/trabajos/reglas.ts`; `sitioDelWorkspace` de `lib/presupuestos/sitio.ts`; `appUrl()` de `lib/app-url`.
- Produces (`import "server-only"`; `type Resultado<T>` igual al de `lib/trabajos/repositorio.ts`):
  - `listarRubros(workspaceId): Promise<Rubro[] | "FALTAN_TABLAS">`
  - `crearRubro(workspaceId, nombre: unknown): Promise<Resultado<Rubro>>` (orden = máximo + 1; nombre repetido → «Ya hay un rubro con ese nombre.»)
  - `editarRubro(workspaceId, id, datos: { nombre?: unknown; enlaces?: unknown }): Promise<Resultado<Rubro>>`
  - `moverRubro(workspaceId, id, hacia: -1 | 1): Promise<Resultado<null>>`
  - `borrarRubro(workspaceId, id): Promise<Resultado<null>>` (pone `rubroId: null` en sus etiquetas con `updateMany` y borra el rubro, en `$transaction`)
  - `etiquetasDeTrabajo(workspaceId, trabajoId): Promise<{ rubroId: string | null; estilos: string[] } | "FALTAN_TABLAS">`
  - `guardarEtiquetas(workspaceId, trabajoId, datos: { rubroId: unknown; estilos: unknown }): Promise<Resultado<null>>` (valida que trabajo y rubro sean del workspace; `upsert` por `trabajoId`; rubro vacío y sin estilos → borra la fila)
  - `sugerenciasDeEstilos(workspaceId): Promise<Record<string, string[]>>` (por rubroId, ordenados por uso)
  - `cargarPortfoliosDelEstudio(workspaceId, opciones: { incluirNoCompartibles: boolean }): Promise<{ rubros: Rubro[]; grupos: GrupoRubro[]; sinEtiquetar: PortfolioTrabajo[] } | "FALTAN_TABLAS">` — lee todos los trabajos del workspace (con `titulo, slug, lugar, fecha, destacado, portadaUrl, estado, categoriaId`), sus categorías, sus etiquetas, `FotofficeWorkspaceWebsite.publishedAt` y `sitioDelWorkspace`; calcula `url`/`motivo` con Task 2; si `incluirNoCompartibles` es false, filtra los no compartibles **antes** de agrupar (también de `sinEtiquetar`). La portada usa la miniatura de la foto de portada si existe (misma consulta que `miniaturasDePortadas` en `lib/trabajos/publico.ts`: exportarla desde ahí en vez de copiarla).

- [ ] **Step 1: Tests que fallan** (mock de `@repo/db` como en `lib/trabajos/repositorio.test.ts`):
  - `crearRubro` con nombre repetido (P2002) → `{ ok: false, error: "Ya hay un rubro con ese nombre." }`.
  - `guardarEtiquetas` con rubro de otro workspace → `{ ok: false }` y no escribe.
  - `guardarEtiquetas` sin rubro ni estilos → `deleteMany`, no `upsert`.
  - `borrarRubro` → `updateMany({ where: { workspaceId, rubroId: id }, data: { rubroId: null } })` y `delete`.
  - `cargarPortfoliosDelEstudio` con P2021 → `"FALTAN_TABLAS"`.
  - `cargarPortfoliosDelEstudio({ incluirNoCompartibles: false })` con un borrador y uno de categoría oculta → ninguno aparece ni en grupos ni en `sinEtiquetar`.
  - `borrarTrabajo` borra la fila de etiquetas, y si esa tabla falta (P2021) igual borra el trabajo.
- [ ] **Step 2:** `pnpm vitest run lib/portfolio-estudio lib/trabajos/repositorio.test.ts` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mismo comando → PASS.
- [ ] **Step 5:** Commit «Repositorio de los portfolios del estudio».

### Task 4: Acciones

**Files:**
- Create: `app/actions/portfolio-estudio.ts`, `app/actions/portfolio-estudio.test.ts`
- Modify: `app/actions/trabajos.ts` (`FormularioTrabajo` suma `rubroId: string` y `estilos: string[]`; `guardarTrabajoAction` llama a `guardarEtiquetas` después de `editarTrabajo` si `editarTrabajo` dio ok; si `guardarEtiquetas` falla con P2021 se ignora) y su test.

**Interfaces:**
- Consumes: Task 3; `resolvePortfolioAdminContext` (`lib/portfolio/admin-access.ts`) para MANAGE.
- Produces (`"use server"`, devuelven `{ ok: true } | { ok: false; error: string }` y hacen `revalidatePath("/portfolios")`):
  - `crearRubroAction(nombre: string)`, `editarRubroAction(id: string, datos: { nombre?: string; enlaces?: Enlace[] })`, `moverRubroAction(id: string, hacia: -1 | 1)`, `borrarRubroAction(id: string)` — sin `portfolio` MANAGE → `{ ok: false, error: "No tenés permiso para administrar los rubros." }` antes de leer nada.

- [ ] **Step 1: Tests que fallan:** sin contexto MANAGE cada acción devuelve el error y no llama al repositorio; con contexto pasa el `workspaceId` de la sesión. En `trabajos.test.ts`: `guardarTrabajoAction` llama a `guardarEtiquetas(ws, id, { rubroId, estilos })` y no lo llama si `editarTrabajo` falló.
- [ ] **Step 2:** `pnpm vitest run app/actions/portfolio-estudio.test.ts app/actions/trabajos.test.ts` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mismo comando → PASS.
- [ ] **Step 5:** Commit «Acciones de los portfolios del estudio».

### Task 5: Etiquetas en la ficha del trabajo

**Files:**
- Modify: `app/(shell)/website/trabajos/[id]/page.tsx` (cargar `listarRubros`, `etiquetasDeTrabajo`, `sugerenciasDeEstilos`; pasar al editor `rubros`, `sugerencias` y en `inicial` `rubroId`/`estilos`; si cualquiera da `"FALTAN_TABLAS"`, pasar `rubros = null`)
- Modify: `components/website/trabajos/trabajo-editor.tsx` (recuadro)
- Create: `components/website/trabajos/estilos-input.tsx`

**Interfaces:**
- Consumes: Task 3 y Task 4.
- Produces: `EstilosInput({ valor: string[]; sugerencias: string[]; onChange: (v: string[]) => void })` — fichas con ×, agrega con Enter o coma, `<datalist>` con sugerencias, respeta topes de Task 2 (usa `normalizarEstilos`).

- [ ] **Step 1:** En `TrabajoEditor`, prop `rubros: { id: string; nombre: string }[] | null` y `sugerencias: Record<string, string[]>`. Con `rubros === null` no se dibuja nada. Si no, un `<fieldset>` con leyenda «Portfolio interno (no se ve en el sitio)», ayuda «Para que la vendedora encuentre este trabajo en Portfolios.», `<select>` «Rubro» (opción vacía «Sin rubro») y `EstilosInput` con las sugerencias del rubro elegido. Si no hay rubros: «Todavía no hay rubros. Creálos en Portfolios → Del estudio.» con enlace a `/portfolios`.
- [ ] **Step 2:** `pnpm typecheck` (ver que termine con salida real; si muere por memoria, correr con `NODE_OPTIONS=--max-old-space-size=8192`) → sin errores.
- [ ] **Step 3:** Commit «Etiquetar trabajos para el portfolio interno».

### Task 6: Solapa «Del estudio» en `/portfolios`

**Files:**
- Modify: `app/(shell)/portfolios/page.tsx` (solapas con `?vista=estudio|socios`)
- Create: `components/portfolios/estudio/portfolios-del-estudio.tsx` (servidor: arma la vista), `components/portfolios/estudio/lista-portfolios.tsx` (cliente: buscador, selector de rubro, copiar), `components/portfolios/estudio/administrar-rubros.tsx` (cliente, sólo MANAGE)

**Interfaces:**
- Consumes: `cargarPortfoliosDelEstudio`, acciones de Task 4, `hasModuleLevel(user.id, workspace.id, WEBSITE_MODULE_KEY, "MANAGE")` para `incluirNoCompartibles` y para mostrar «Sin etiquetar».

- [ ] **Step 1:** Página: contar socios (`prisma.member.count({ where: { workspaceId } })`). Con 0 socios: sin solapas, directo «Del estudio». Con socios: solapas «De los socios» (por omisión, la pantalla de hoy sin cambios) y «Del estudio». Encabezado de «Del estudio»: «Portfolios del estudio» / «Los trabajos publicados, ordenados para mandarle a cada cliente el que corresponde.»
- [ ] **Step 2:** Vista: `"FALTAN_TABLAS"` → aviso «Esta sección todavía no está lista en esta cuenta.». Por rubro: título + cantidad; «Presentaciones de venta» con sus enlaces; cada estilo con sus trabajos (miniatura 64 px `loading="lazy"`, título, lugar · año, botones «Abrir» `target="_blank" rel="noreferrer"` y «Copiar enlace»); al final del rubro un recuadro atenuado «Videos — próximamente»; rubro vacío: «Todavía no hay trabajos etiquetados en este rubro.». No compartibles (sólo editores): atenuados, con el motivo y sin botones. «Sin etiquetar (N)» al final (sólo editores), cada uno enlaza a `/website/trabajos/<id>`.
- [ ] **Step 3:** Copiar: `navigator.clipboard.writeText(url)` → el botón dice «Copiado ✓» 2 s; si falla, mostrar un `<input readOnly>` con la URL seleccionada y «Copialo a mano». Buscador: filtra por título y lugar sin distinguir mayúsculas ni acentos; el selector de rubro hace scroll al ancla del rubro.
- [ ] **Step 4:** `AdministrarRubros` (dentro de `<details>` «Administrar rubros»): crear, renombrar, ↑/↓, borrar (confirmación «Los trabajos de este rubro quedan sin etiquetar.»), y por rubro editar presentaciones (título + enlace, agregar/quitar). Errores de la acción en `fo-alert-error`.
- [ ] **Step 5:** `pnpm typecheck` y `pnpm test` → verdes. Commit «Solapa de portfolios del estudio».

### Task 7: Base de producción y carga inicial

- [ ] **Step 1:** Confirmar que el endpoint del `DATABASE_URL` de producción es `ep-dawn-dew-adyr8f1v` (rama `br-old-rain-adwthzng`) y aplicar el SQL de Task 1 ahí. Registrar: `cd packages/db && set -a && . ../../apps/fotoffice/.env.local && set +a && npx prisma migrate resolve --applied 20270212090000_fotoffice_portfolios_del_estudio` (verificar antes que `.env.local` apunte a esa base; si no, insertar en `_prisma_migrations` con el checksum del archivo). Verificar con `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name LIKE '%portfolios_del_estudio'`.
- [ ] **Step 2:** Insertar rubros en DNX Estudio (`cmv5z6qxwwmmhf0q5gp8qja1j`), en este orden: XV · Bodas · Sesiones infantiles · Cumpleaños · Bautismos y comuniones · Graduaciones · Eventos corporativos · Producción de contenido · Arquitectura. Presentaciones: XV ← «Presentación XV» `https://www.compramelafoto.com/dnx/xv` y «Presentación XV sin precio» `https://www.compramelafoto.com/dnx/xv/sp`; Bodas ← «Presentación Bodas» `…/dnx/bodas` y «Presentación Bodas sin precio» `…/dnx/bodas/sp` (comprobar que los cuatro responden 200).
- [ ] **Step 3:** Armar la tabla de pre-etiquetado (Fiestas de XV → XV/Fiesta; Books con XV/15/pre/post → XV/Book previo, Sofi Bracco además Sesión temática; Bodas → Bodas; Graduaciones; Arquitectura; dudosos sin etiquetar), **mostrársela a Daniel** y aplicar sólo con su OK.

### Task 8: Verificación en navegador y PR

- [ ] **Step 1:** Levantar `next dev --webpack --port 3017` por Bash en segundo plano (preview_start por nombre no funciona en el Escritorio) contra la base de producción, entrar con la cuenta de Daniel y revisar: `/portfolios` muestra XV y Bodas con material real; «Copiar enlace» copia y la URL abre la página pública (200); la ficha de un trabajo guarda rubro y estilos; en ancho celular (375 px) no hay scroll horizontal.
- [ ] **Step 2:** `pnpm typecheck`, `pnpm test` y `pnpm --filter fotoffice build` (el CI no compila con `server-only`).
- [ ] **Step 3:** PR en español a `main`, con capturas, aviso de que la migración ya está aplicada y registrada, y lo que queda para Daniel (dudosos sin etiquetar, darle a la vendedora el permiso `portfolio` VER).
