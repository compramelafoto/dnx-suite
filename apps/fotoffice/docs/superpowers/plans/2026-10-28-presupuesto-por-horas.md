# Presupuesto por horas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una consulta de cualquier evento o sesión sin propuesta modelo (por WhatsApp o por la web) arme sola un borrador de presupuesto a partir de las horas de cobertura, con traslado y segundo fotógrafo, y llegue a Telegram para aprobar.

**Architecture:** Una receta PURA (`por-horas-puro.ts`) convierte horas + km + ajustes en un trabajo para el motor de ¿Cuánto cobro? (`calcularItemDelPanel`). `armarBorrador` (propuesta-automatica) usa la receta cuando la categoría no tiene propuesta modelo y el presupuesto por horas está encendido. La puerta de Telegram (`apruebaPorTelegram`) se abre también por ese interruptor. Las horas y el resultado del cálculo (km, traslado) se guardan en `ServiceSalesLead.metaJson.porHoras` (sin migración); los ajustes en una columna nueva `FotofficePresupuestoAutoAjustes.porHoras Json?`.

**Tech Stack:** Next.js (server actions), Prisma 6, `@repo/cuanto-cobro-core`, `@repo/geo` (Nominatim), vitest + `lib/circuitos/base-en-memoria.ts`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-28-presupuesto-por-horas-design.md`

## Global Constraints

- Edición = **2 h por hora de cobertura** (configurable). `estimatedShots` = horas × **575** (interno).
- Fotos prometidas: **eventos mínimo 400**, **sesiones de fotos mínimo 70**. Nunca se promete la estimación.
- Traslado = km de distancia (recta × **1,3**, desde la dirección de partida) × **$3.000**; **sin margen y sin renglón propio**: se suma al precio final del renglón de cobertura. Más de **200 km** o sin coordenadas → no se suma y se avisa. Lugar = el estudio → 0.
- Dirección de partida por omisión: **García del Cossio 2050, Funes, Santa Fe** (geocodificada al guardar).
- Segundo fotógrafo = **30 %** × valor de la hora de Daniel × horas de cobertura; sin edición ni traslado extra. Va **siempre en Bodas** y en eventos con **más de 200 invitados**; no en sesiones.
- Galería online siempre incluida; impresiones y fotolibro como opcionales "para después", sin cotizar.
- Montos en pesos enteros; textos en castellano rioplatense; nunca loguear datos personales.
- Interruptor apagado por omisión. Migraciones FOTOFFICE: SQL a mano en la rama `development` (`br-old-rain-adwthzng`) + registro en `_prisma_migrations` con sha256.
- XV y Bodas con propuesta modelo siguen usando su propuesta (sólo se les suma el segundo fotógrafo).

## Rulings del plan (decisiones sobre lo que el spec deja abierto)

- **R1 — "Valor de la hora de Daniel"** = `getProfileHourlyRate(perfil) × getCommercialPositioningFactor(perfil.commercialPositioningId)` (el precio de su hora, no el costo). Si alguno falta, no se arma el segundo fotógrafo y el aviso lo dice.
- **R2 — Traslado** = `precioUnitario` del renglón de cobertura = sugerido + traslado, con `calculo.precioAjustado = true`. El margen guardado lo incluye; el aviso de Telegram muestra el traslado aparte.
- **R3 — Segundo fotógrafo con propuesta modelo que ya tiene opciones** (Boda y XV de DNX tienen 3 paquetes; el máximo es 4): va como ítem **opcional** dentro de cada paquete ("Segundo fotógrafo (N horas) — opcional"), no como opción nueva. En la receta por horas (sin paquetes) sí son dos opciones: "Un fotógrafo" / "Dos fotógrafos".
- **R4 — Categoría "Evento"** genérica (grupo `EVENTO`) se crea si hace falta, para consultas cuyo tipo no coincide con ninguna categoría.
- **R5 — Sesión de fotos** = categoría cuyo id está en `ajustes.categoriasSesion` (por omisión, las del grupo `TRABAJO_SIN_FECHA` cuyo nombre contiene "sesi"). DNX: "Sesión de Fotos".

## Review Focus

- Cliente con "3 horas y media" o "4hs": `horas` acepta decimales de a 0,5 entre 0,5 y 24; fuera de rango → se registra sin horas.
- Nominatim caído o lugar ambiguo ("salón La Arbolada"): borrador igual, sin traslado, aviso "No se pudo ubicar el lugar".
- La misma consulta dos veces (reintento): no se arman dos presupuestos (el candado y `YA_TIENE_PRESUPUESTO` existentes cubren; probarlo en Task 4).
- Perfil de precios incompleto: `calcularItemDelPanel` falla → `SIN_PROPUESTA` con motivo y aviso, nunca un presupuesto en $0.
- Consulta web sin horas en un formulario viejo (cacheado): llega a Telegram con "falta la cantidad de horas".

---

## Estructura de archivos

| Archivo | Qué hace |
|---|---|
| `packages/db/prisma/migrations/20270101120000_fotoffice_presupuesto_por_horas/migration.sql` + `schema.prisma` | Columna `porHoras Json?` en `FotofficePresupuestoAutoAjustes` |
| `lib/presupuesto-automatico/por-horas-puro.ts` (nuevo, PURO) | Ajustes por omisión y normalización, km, receta, segundo fotógrafo, horas válidas |
| `lib/presupuesto-automatico/por-horas.ts` (nuevo, server) | Leer/guardar ajustes (geocodifica la partida), leer/guardar `metaJson.porHoras` |
| `lib/presupuestos/borrador-por-horas.ts` (nuevo, server) | Armar los ítems por horas (motor + traslado + opciones) |
| `lib/presupuestos/propuesta-automatica.ts` | Enganchar la receta y el segundo fotógrafo opcional en `armarBorrador` |
| `lib/presupuesto-automatico/ajustes.ts`, `flujo.ts`, `resumen.ts` | Puerta de Telegram, motivo `SIN_HORAS`, líneas nuevas del aviso |
| `lib/presupuesto-automatico/whatsapp.ts`, `whatsapp-puro.ts`, `lib/bandeja/bot/herramientas.ts`, `guia.ts` | Horas e invitados desde el bot, categoría "Evento" |
| `app/actions/site-inquiry.ts`, `components/website/render/blocks/inquiry-form-block-view.tsx`, `app/w/[workspaceSlug]/public-dynamic-service-lead-form.tsx`, `app/actions/service-lead.ts` | Campo "¿Cuántas horas dura?" en la web |
| `app/workspace/configuracion/telegram/{page.tsx,actions.ts,telegram-form.tsx}` | Sección "Presupuesto por horas" |

---

### Task 1: Ajustes y receta (PURO)

**Files:** Create `apps/fotoffice/lib/presupuesto-automatico/por-horas-puro.ts`; Test `…/por-horas-puro.test.ts`.

**Interfaces — Produces:**
```ts
export type AjustesPorHoras = {
  encendido: boolean; edicionPorHora: number; disparosPorHora: number;
  minimoFotosEvento: number; minimoFotosSesion: number; pesosPorKm: number; maxKm: number;
  partida: { direccion: string; lat: number | null; lon: number | null };
  segundoFotografoPct: number; invitadosSegundoFotografo: number;
  categoriasSesion: string[]; incluye: string; opcionalesTexto: string;
};
export const AJUSTES_POR_HORAS_POR_OMISION: AjustesPorHoras; // valores de Global Constraints; incluye "Galería online"; opcionalesTexto "Opcionales para después: impresiones y fotolibro."
export function normalizarAjustesPorHoras(json: unknown): AjustesPorHoras; // completa con la omisión; números inválidos → omisión
export function horasValidas(v: unknown): number | null; // 0,5..24, redondeo a 0,5
export function kmDeDistancia(origen: {lat:number;lon:number} | null, destino: {lat:number;lon:number} | null, maxKm: number): number | null; // straightLineKm × CUANTO_COBRO_ROUTE_FACTOR, 1 decimal; > maxKm → null
export type Receta = { coberturaHoras: number; edicionHoras: number; disparos: number; trasladoPesos: number | null; minimoFotos: number; nombre: string; descripcion: string };
export function recetaPorHoras(p: { horas: number; esSesion: boolean; km: number | null; enElEstudio: boolean; ajustes: AjustesPorHoras }): Receta;
export function precioSegundoFotografo(valorHora: number | null, horas: number, pct: number): number | null; // redondeo a $100
export function llevaSegundoFotografo(p: { grupo: string; esSesion: boolean; invitados: number | null; umbral: number }): boolean; // BODA → true; sesión → false; invitados > umbral
```
`nombre` = "Cobertura fotográfica de N horas" (sesión: "Sesión de fotos de N horas"); `descripcion` = "Incluye la galería online con un mínimo de M fotos editadas. Opcionales para después: impresiones y fotolibro."

- [ ] **Step 1: Failing tests** (`por-horas-puro.test.ts`):
  - `recetaPorHoras({horas:3, esSesion:false, km:10, enElEstudio:false, ajustes:OMISION})` → `{coberturaHoras:3, edicionHoras:6, disparos:1725, trasladoPesos:30000, minimoFotos:400}` y `descripcion` contiene "mínimo de 400 fotos" y no contiene "1725".
  - sesión 1 h en el estudio → `minimoFotos:70`, `trasladoPesos:0`; con `km:null` y fuera del estudio → `trasladoPesos:null`.
  - `kmDeDistancia` de dos puntos a ~7,7 km en línea recta → ≈10 (tolerancia 0,2); a > 200 km → null; con null → null.
  - `horasValidas("3,5")`→3.5, `4`→4, `0`→null, `30`→null, `"tres"`→null, `3.3`→3.5.
  - `precioSegundoFotografo(50000, 3, 30)` → 45000; `(null,3,30)` → null.
  - `llevaSegundoFotografo`: BODA → true; EVENTO 250 inv → true; EVENTO 200 → false; sesión 500 → false.
  - `normalizarAjustesPorHoras(null)` = omisión; `({pesosPorKm:"x", encendido:true})` → `pesosPorKm:3000, encendido:true`.
- [ ] **Step 2: Run** `pnpm --filter fotoffice exec vitest run lib/presupuesto-automatico/por-horas-puro.test.ts` — FAIL.
- [ ] **Step 3: Implement** (usar `straightLineKm` y `CUANTO_COBRO_ROUTE_FACTOR` de `@repo/cuanto-cobro-core`).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** "Presupuesto por horas: receta y ajustes (puro)".

---

### Task 2: Migración y lectura/guardado de ajustes y horas

**Files:** Modify `packages/db/prisma/schema.prisma` (modelo `FotofficePresupuestoAutoAjustes`: `porHoras Json?`); Create migration `20270101120000_fotoffice_presupuesto_por_horas/migration.sql` (`ALTER TABLE "FotofficePresupuestoAutoAjustes" ADD COLUMN IF NOT EXISTS "porHoras" JSONB;`); Create `lib/presupuesto-automatico/por-horas.ts`; Test `…/por-horas.test.ts`, y agregar el caso a `migracion.test.ts`.

**Interfaces — Produces:**
```ts
export async function leerAjustesPorHoras(workspaceId: string): Promise<AjustesPorHoras>; // error / P2021 → omisión (apagado)
export async function guardarAjustesPorHoras(ctx: CtxPresupuestos, valores: unknown, deps?: { geocodificar?: (dir: string) => Promise<{lat:number;lon:number} | null> }): Promise<ResultadoAjustesAuto>; // exige configurar; si cambió la dirección, geocodifica (provider.search(q,{limit:1})); upsert por workspaceId
export type DatosPorHorasDeConsulta = { horas: number | null; km: number | null; traslado: number | null; ubicado: boolean; segundoFotografo: boolean };
export async function leerPorHorasDeConsulta(workspaceId: string, leadId: string): Promise<DatosPorHorasDeConsulta | null>; // ServiceSalesLead.metaJson.porHoras
export async function guardarPorHorasDeConsulta(workspaceId: string, leadId: string, datos: Partial<DatosPorHorasDeConsulta>): Promise<void>; // merge en metaJson, sin pisar otras claves
export async function geocodificarLugar(lugar: string | null): Promise<{lat:number;lon:number} | null>; // nunca lanza
```
- [ ] **Step 1: Failing tests:** guardar sin permiso → `{ok:false}`; guardar con dirección nueva llama a `geocodificar` y guarda lat/lon; leer con columna ausente (P2021 simulado) → omisión; `guardarPorHorasDeConsulta` conserva otras claves de `metaJson`; `migracion.test.ts` verifica que el SQL contiene `ADD COLUMN IF NOT EXISTS "porHoras" JSONB`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (agregar `porHoras` a la base en memoria si hace falta). **Step 4: Run** — PASS; `pnpm --filter @repo/db exec prisma generate`.
- [ ] **Step 5: Commit** "Presupuesto por horas: ajustes guardados y horas de la consulta".

---

### Task 3: Armar los ítems por horas

**Files:** Create `lib/presupuestos/borrador-por-horas.ts`; Test `…/borrador-por-horas.test.ts` (perfil real `createBaseCompleteProfile`, como `instanciar-propuesta.test.ts`).

**Interfaces:**
- Consumes: Task 1; `trabajoVacio`, `calcularItemDelPanel` (`panel-cuanto-cobro.ts`); `getProfileHourlyRate`, `getCommercialPositioningFactor` (`@repo/cuanto-cobro-core`).
- Produces:
```ts
export type ItemsPorHoras = { items: ItemPresupuesto[]; alternativas: Alternativa[]; traslado: number | null; segundoFotografo: number | null };
export function itemsPorHoras(p: { perfil: CuantoCobroProfileInput; receta: Receta; conSegundoFotografo: boolean; segundoFotografoPct: number; ahora: Date }): { ok: true; valor: ItemsPorHoras } | { ok: false; motivo: "PERFIL" };
export function valorHoraDeDaniel(perfil: CuantoCobroProfileInput): number | null; // R1
export function segundoFotografoOpcional(items: ItemPresupuesto[], alternativas: Alternativa[], precioPorHora: number | null, pct: number): ItemPresupuesto[]; // R3: por cada alternativa (o una vez si no hay), suma un ítem LISTA opcional con horas = suma de coverageHours de sus CALCULO
```
Cobertura: `trabajoVacio(receta.nombre)` con `horasCobertura`, `horasEdicion`, `disparosEstimados`; `calcularItemDelPanel(...)`; luego `{...item, descripcion: receta.descripcion, precioUnitario: sugerido + (traslado ?? 0), calculo: {...calculo, precioAjustado: true}}`. Con segundo fotógrafo: alternativas `[{id:"un-fotografo",nombre:"Un fotógrafo",…},{id:"dos-fotografos",nombre:"Dos fotógrafos",…}]`, el renglón de cobertura duplicado (ids distintos) y en la segunda un ítem LISTA "Segundo fotógrafo (N horas)" (`productId:null`, `modoPrecio:"LISTA"`, `calculo:null`).

- [ ] **Step 1: Failing tests:** 3 h + traslado 30000 → un ítem, `precioUnitario` = sugerido del motor + 30000, `descripcion` con "mínimo de 400"; con segundo fotógrafo → 2 alternativas, 3 ítems, el de la segunda = `precioSegundoFotografo(valorHoraDeDaniel(perfil),3,30)`; perfil vacío → `{ok:false, motivo:"PERFIL"}`; `segundoFotografoOpcional` con 3 alternativas → 3 ítems opcionales nuevos con `alternativaId` de cada una y `opcional:true`.
- [ ] **Step 2–4:** Run FAIL → implement → PASS (`vitest run lib/presupuestos/borrador-por-horas.test.ts lib/presupuestos/instanciar-propuesta.test.ts`).
- [ ] **Step 5: Commit** "Presupuesto por horas: ítems del motor con traslado y segundo fotógrafo".

---

### Task 4: Enganchar en el borrador y la puerta de Telegram

**Files:** Modify `lib/presupuestos/propuesta-automatica.ts` (`armarBorrador`), `lib/presupuesto-automatico/ajustes.ts` (`apruebaPorTelegram`), `lib/presupuesto-automatico/flujo.ts` (`alLlegarConsulta`, `datosDelResumen`); Test `lib/presupuestos/propuesta-automatica.test.ts`, `lib/presupuesto-automatico/flujo.test.ts`.

**Interfaces:**
- `apruebaPorTelegram(ws, categoriaId)` → true también si `leerAjustesPorHoras(ws).encendido` y la categoría **no** tiene propuesta modelo.
- `armarBorrador` (paraAprobar): sin propuesta y por horas encendido → lee horas (`leerPorHorasDeConsulta`); sin horas → `sin("SIN_HORAS")`; si no geocodifica `consulta.venue ?? city` (`geocodificarLugar`), calcula km; `itemsPorHoras`; arma con `normalizarBorrador` + `crearPresupuestoDelSistema` (mismo candado); guarda `{km, traslado, ubicado, segundoFotografo}` con `guardarPorHorasDeConsulta`. Con propuesta: si `llevaSegundoFotografo` → `segundoFotografoOpcional` sobre los ítems antes de `normalizarBorrador`.
- `ResultadoBorradorParaAprobar.resultado` suma `"SIN_HORAS"`; `alLlegarConsulta` lo guarda en `errorCode` y `motivoSinPresupuesto: "SIN_HORAS"`.
- `DatosResumen` suma `porHoras: DatosPorHorasDeConsulta | null` (de `leerPorHorasDeConsulta`).
- `enElEstudio`: `venue` normalizado contiene "estudio" o el nombre comercial del workspace.

- [ ] **Step 1: Failing tests:** (a) categoría sin propuesta, por horas encendido, horas 3, venue geocodificable (geocodificar inyectado) → presupuesto BORRADOR con total > 0 y fila AVISADO; (b) sin horas → fila `SIN_PROPUESTA` con `errorCode:"SIN_HORAS"`; (c) por horas apagado → "APAGADO" como hoy; (d) Boda con propuesta de 3 opciones → 3 ítems opcionales "Segundo fotógrafo"; (e) la misma consulta dos veces → un solo presupuesto; (f) geocodificar null → presupuesto sin traslado y `ubicado:false`.
- [ ] **Step 2–4:** FAIL → implement → PASS (`vitest run lib/presupuestos lib/presupuesto-automatico`).
- [ ] **Step 5: Commit** "Presupuesto por horas: armar el borrador y avisar por Telegram".

---

### Task 5: Aviso de Telegram

**Files:** Modify `lib/presupuesto-automatico/resumen.ts` (`armarResumen`); Test `resumen.test.ts`.

Líneas nuevas (escapadas como las existentes): "⏱ Armado por horas: 3 h de cobertura + 6 h de edición"; "🚗 Incluye traslado: 10 km, $30.000" o "⚠️ No se pudo ubicar el lugar: el traslado no está sumado"; con segundo fotógrafo "👥 Con opción de segundo fotógrafo"; motivo `SIN_HORAS` → "Falta la cantidad de horas: completala en la consulta".

- [ ] **Step 1–5:** tests de las cuatro líneas → FAIL → implement → PASS → commit "Presupuesto por horas: el aviso de Telegram lo explica".

---

### Task 6: Bot de WhatsApp

**Files:** Modify `lib/bandeja/bot/herramientas.ts` (zod `horas: z.number().min(0.5).max(24).optional()`, `DatosPresupuestoBot.horas`, descripción), `lib/presupuesto-automatico/whatsapp.ts` (`DatosDelBot.horas`), `whatsapp-puro.ts`, `lib/bandeja/bot/guia.ts`; Create `lib/presupuesto-automatico/categoria-evento.ts`; Tests `herramientas.test.ts`, `guia.test.ts`, nuevo `whatsapp.test.ts`.

**Interfaces:**
- `asegurarCategoriaEvento(workspaceId: string): Promise<string>` — busca "Evento" (incluidas archivadas: si está archivada la usa igual) o la crea con grupo `EVENTO`; P2002 → vuelve a buscar.
- `prepararDesdeWhatsapp`: si por horas encendido, busca entre **todas** las categorías activas (`categoriaDelTipo`); sin coincidencia → `asegurarCategoriaEvento`. Guarda `guardarPorHorasDeConsulta(ws, leadId, {horas: horasValidas(datos.horas)})` **antes** de `alLlegarConsulta`. Por horas apagado → como hoy.
- Guía: para eventos y sesiones pedir tipo, nombre, fecha, lugar (dirección o salón y localidad), **cuántas horas dura** y, en eventos, **cuántos invitados**; más de 200 → comentar que recomendamos un segundo fotógrafo y que el presupuesto trae las dos opciones; mencionar galería online incluida e impresiones/fotolibro para después; nunca precios.

- [ ] **Step 1: Failing tests:** herramienta acepta `horas: 3.5`; `whatsapp.test.ts`: tipo "cumpleaños infantil" → categoría "Cumpleaños Infantil" y `metaJson.porHoras.horas = 3`; tipo "fiesta de egresados" sin categoría → crea "Evento" una sola vez en dos llamadas; guía contiene "cuántas horas" y "más de 200 invitados".
- [ ] **Step 2–5:** FAIL → implement → PASS (`vitest run lib/bandeja/bot lib/presupuesto-automatico`) → commit "Bot de WhatsApp: presupuesto por horas para cualquier evento".

---

### Task 7: Formulario web

**Files:** Modify `app/actions/site-inquiry.ts` (zod `horas` opcional; tras `altaDeConsulta` ok → `guardarPorHorasDeConsulta`), `components/website/render/blocks/inquiry-form-block-view.tsx` (input numérico "¿Cuántas horas dura el evento o la sesión?", step 0.5, opcional), `app/w/[workspaceSlug]/public-dynamic-service-lead-form.tsx` + `app/actions/service-lead.ts` (mismo campo, mismo guardado). Test: el de la acción si existe (`site-inquiry.test.ts`), si no, uno nuevo con `altaDeConsulta` y `guardarPorHorasDeConsulta` simulados.

**Ruling previo:** el guardado de horas tiene que ocurrir antes de `alLlegarConsulta`, que corre en `despuesDeResponder` (después de la respuesta): pasar las horas dentro de `DatosAlta.metaJson` como `{ porHoras: { horas } }` (que `altaDeConsulta` ya graba en el alta) en vez de un guardado posterior.

- [ ] **Step 1–5:** test "la consulta web con horas 4 graba metaJson.porHoras.horas = 4; '4,5' → 4.5; vacío → sin porHoras" → FAIL → implement → PASS (`vitest run app/actions lib/consultas`) → commit "Formulario web: preguntar cuántas horas dura".

---

### Task 8: Configuración → Telegram

**Files:** Modify `app/workspace/configuracion/telegram/page.tsx`, `actions.ts` (`guardarPorHorasAction(_prev, fd)`), `telegram-form.tsx` (`PorHorasForm`); Test `pagina.test.ts`.

Sección "Presupuesto por horas (eventos sin propuesta modelo)" después del Paso 4: interruptor; edición por hora; fotos por hora (interno); mínimo de fotos eventos / sesiones; $ por km; dirección de partida con "Ubicada en el mapa ✓ / ✗"; segundo fotógrafo % y desde cuántos invitados; casillas de categorías que son sesión; textos de lo incluido y opcionales. Montos con `InputMoneda`.

- [ ] **Step 1–5:** `pagina.test.ts`: la página lee `leerAjustesPorHoras` y muestra la sección; la acción exige configurar → FAIL → implement → PASS → commit "Configuración: presupuesto por horas".

---

### Task 9: Producción

- [ ] `pnpm --filter fotoffice exec tsc --noEmit` (con `NODE_OPTIONS=--max-old-space-size=12288`) y `pnpm --filter fotoffice test`: sin errores.
- [ ] Aplicar el SQL en `development` (`br-old-rain-adwthzng`) y registrar en `_prisma_migrations` con el sha256 del archivo; fusionar recién después.
- [ ] PR, CI verde, fusionar, deploy "Ready".
- [ ] Guardar los ajustes de DNX Estudio (`cmv5z6qxwwmmhf0q5gp8qja1j`) con los valores del spec y verificar que la partida quedó ubicada; encender.
- [ ] Prueba real: por WhatsApp "cumpleaños infantil de 3 horas en [salón de Funes], 50 invitados" → aviso de Telegram con horas y traslado; otra con 250 invitados → dos opciones.
