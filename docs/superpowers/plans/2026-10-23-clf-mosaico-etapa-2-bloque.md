# Mosaico del curso — Etapa 2: el bloque en el editor — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un bloque «Mosaico del curso» en el editor de plantillas que reparte solo a los compañeros
(retrato + nombre) con estilos configurables, y que se ve igual en el lienzo, en la vista previa y
en el PDF.

**Architecture:** igual que «Listado del curso»: un bloque `VARIABLE_TEXT` con la clave
`course.mosaic` (sin tipo de bloque nuevo, sin migración). La lista viaja como JSON en el valor. Una
única función pura de reparto (`layoutCourseMosaic`) la usan el lienzo del editor y el puente a
design-studio, que convierte cada celda en bloques comunes (`rect`, `image`, `text`). Esta etapa se
construye antes que la etapa 1 porque permite diseñar las plantillas con fotos de demo; las fotos
reales del padrón llegan en la etapa 1 llenando el mismo valor.

**Tech Stack:** TypeScript, React (template-editor-ui), `node:test` + `node:assert/strict` corridos con `tsx --test` (así están todas las pruebas de estos paquetes), design-studio, Next.js (CLF), sharp.

**Spec:** `docs/superpowers/specs/2026-10-23-clf-mosaico-del-curso-design.md`

## Global Constraints

- Sin tipo de bloque nuevo: `VARIABLE_TEXT` + `configJson.variableKey = "course.mosaic"` + opciones en `configJson.courseMosaic`.
- La misma cuenta de reparto en lienzo, vista previa y PDF (anti-objetivo: «que el mosaico se vea distinto en la vista previa que en el papel»).
- El dueño de la carpeta no aparece en su mosaico (lo saca quien arma el valor, no el bloque).
- Un chico sin foto sale con silueta neutra y su nombre, nunca con la foto de otro.
- Cursos de 15 a 40 chicos sin mover nada; probar también 5 (jardín) y 40.
- Textos de interfaz en español rioplatense; comentarios del código en español, como el resto de `plugins/school`.
- Sin dependencias nuevas (el lockfile es compartido).
- Cada archivo de prueba nuevo se agrega a la lista explícita del script `test` de su `package.json` (en CLF, a `test:school-design`); si no, la CI no lo corre.
- design-studio no dibuja elipses con borde, hexágonos ni sombras: lo que no se pueda imprimir no se ofrece, o se avisa (como hace hoy el puente con la elipse).

## Review Focus

- Nombres largos («María de los Ángeles Fernández Etcheverry») en recuadros chicos: no deben pisar al vecino; se achican hasta un mínimo y después se cortan con «…».
- Bloque muy apaisado o muy alto con 40 chicos: el reparto tiene que elegir columnas que aprovechen el lugar, no una sola fila de estampillas.
- Mosaico girado (la carpeta de San Patricio gira el listado 90°): las celdas giran alrededor del centro del bloque, igual que el listado.
- Valor vacío o roto en `course.mosaic` en un diseño real: no dibuja nada y no rompe el PDF; en el editor sin valor, muestra los compañeros de muestra.
- Dos bloques encadenados con capacidad mayor que la cantidad de chicos: el segundo queda vacío sin error.

---

## Archivos

- Create: `packages/template-engine/src/plugins/school/course-mosaic.ts` — clave, opciones, valor (serializar/leer), muestra, reparto en varios bloques, reparto de un bloque.
- Create: `packages/template-engine/src/plugins/school/course-mosaic.test.ts`
- Modify: `packages/template-engine/src/plugins/school/index.ts` y `packages/template-engine/src/index.ts` — exportar.
- Modify: `packages/template-engine/src/plugins/school/definitions.ts` — declarar la variable `course.mosaic` como la de `course.studentList`.
- Modify: `packages/template-editor-core/src/design-studio-bridge.ts` — caso `course.mosaic` dentro de `VARIABLE_TEXT`.
- Create: `packages/template-editor-core/src/__tests__/mosaico-del-curso.test.ts`
- Modify: `packages/template-editor-core/src/create-default-blocks.ts` — `createDefaultCourseMosaicBlock`.
- Modify: `packages/template-editor-ui/src/TemplateCanvasRenderer.tsx` — `CourseMosaicBlockRenderer`.
- Modify: `packages/template-editor-ui/src/TemplateEditorInspector.tsx` — `CourseMosaicOptionsPanel`.
- Modify: `packages/template-editor-ui/src/TemplateEditorShell.tsx` — botón «Mosaico del curso» junto a «Listado del curso».
- Modify: `apps/compramelafoto/lib/design-v2/values.ts` — `courseMosaic` en `DesignValueSources`.
- Modify: `apps/compramelafoto/lib/design-v2/render.ts` — no convertir el mosaico en texto; resolver `mosaic-photo:<id>`; pasar el mosaico al puente.
- Modify: `apps/compramelafoto/lib/design-v2/demo-valores.ts` — mosaico de demo con las fotos de `template-v2/demo/`.
- Modify: `apps/compramelafoto/lib/design-v2/rasgos-de-plantilla.ts` — rasgo `conMosaico` y filtro.
- Modify: `apps/compramelafoto/lib/design-v2/pantalla-vs-pdf/casos.ts` — un caso con mosaico.

---

### Task 1: El modelo y el reparto (`course-mosaic.ts`)

**Files:**
- Create: `packages/template-engine/src/plugins/school/course-mosaic.ts`
- Test: `packages/template-engine/src/plugins/school/course-mosaic.test.ts`
- Modify: `packages/template-engine/src/plugins/school/index.ts`, `packages/template-engine/src/index.ts`, `packages/template-engine/src/plugins/school/definitions.ts`

**Interfaces:**
- Produces:
  ```ts
  export const COURSE_MOSAIC_VARIABLE_KEY = "course.mosaic";
  export type CourseMosaicStudent = {
    firstName: string; lastName: string;
    /** Foto real del álbum (la imprime el render de CLF). */
    photoId?: number;
    /** Para pantalla y demo: URL pública de la foto (o de su versión con marca de agua). */
    photoUrl?: string;
    /** Encuadre de la cara dentro del recuadro. */
    crop?: { zoom: number; x: number; y: number };
    /** Ancho ÷ alto de la foto original (para ubicar el encuadre en pantalla). */
    sourceAspect?: number;
  };
  export type CourseMosaicFrame = "rect" | "rounded" | "circle" | "ellipse" | "polaroid";
  export type CourseMosaicNamePosition = "below" | "above" | "insideBottom" | "none";
  export type CourseMosaicOptions = {
    frame: CourseMosaicFrame;
    cornerRadius: number;          // px de lienzo, sólo "rounded"
    photoAspect: number;           // ancho ÷ alto del retrato, por defecto 0.75 (3:4)
    gapX: number; gapY: number;    // px de lienzo; 0 = pegados
    borderWidth: number; borderColor: string;
    /** Sombra sólida corrida (el recuadro amarillo/azul de las referencias). null = sin sombra. */
    shadow: { dx: number; dy: number; color: string } | null;
    /** Giro alternado en grados (0 = derecho; 3 = +3°, -3°, +3°…). */
    tilt: number;
    /** Imagen de marco (PNG con transparencia) encima de cada retrato; "" = sin marco. */
    frameSrc: string;
    namePosition: CourseMosaicNamePosition;
    nameLines: 1 | 2;              // 2 = nombre arriba, apellido abajo
    nameBackground: string;        // "" = sin cinta
    sortBy: "firstName" | "lastName";
    givenNames: "all" | "first";
    lastRowAlign: "left" | "center" | "right";
    /** Zona libre para un cartel, en proporciones del bloque (0–1). null = sin zona. */
    reserved: { x: number; y: number; width: number; height: number } | null;
    /** Orden en la cadena de bloques (1, 2, …) y cuántos chicos entran como máximo (0 = sin tope). */
    chainOrder: number;
    capacity: number;
  };
  export const DEFAULT_COURSE_MOSAIC_OPTIONS: CourseMosaicOptions;
  export function isCourseMosaicConfig(config: unknown): boolean;
  export function readCourseMosaicOptions(config: unknown): CourseMosaicOptions;
  export function serializeCourseMosaic(students: CourseMosaicStudent[]): string;
  export function parseCourseMosaic(value: string | null | undefined): CourseMosaicStudent[];
  export const COURSE_MOSAIC_SAMPLE: CourseMosaicStudent[]; // 24 chicos, sin fotos
  export function formatMosaicName(s: CourseMosaicStudent, o: CourseMosaicOptions): string[]; // 1 o 2 líneas
  export type CourseMosaicCell = {
    student: CourseMosaicStudent;
    /** Todo relativo al bloque, en px de lienzo, sin girar. */
    photo: { x: number; y: number; width: number; height: number };
    name: { x: number; y: number; width: number; height: number; lines: string[]; fontSize: number } | null;
    rotation: number; // giro propio de la celda (tilt)
  };
  export function layoutCourseMosaic(input: {
    students: CourseMosaicStudent[];   // ya ordenados y sin el dueño
    options: CourseMosaicOptions;
    width: number; height: number;     // del bloque
    fontSize: number; lineHeight: number;
  }): { cells: CourseMosaicCell[]; overflow: number };
  /** Reparte los chicos entre los bloques encadenados, por `chainOrder`. */
  export function splitCourseMosaicChain<T extends { id: string; options: CourseMosaicOptions }>(
    blocks: T[], students: CourseMosaicStudent[],
  ): Map<string, CourseMosaicStudent[]>;
  export function sortCourseMosaic(students: CourseMosaicStudent[], o: CourseMosaicOptions): CourseMosaicStudent[];
  ```

- [ ] **Step 1: Tests que fallan.** En `course-mosaic.test.ts`:
  - `parseCourseMosaic` de `serializeCourseMosaic(x)` devuelve `x`; de `""`, `"{roto"` o `null` devuelve `[]`; descarta entradas sin `firstName` ni `lastName`.
  - `readCourseMosaicOptions({})` es igual a `DEFAULT_COURSE_MOSAIC_OPTIONS`; valores fuera de rango se acotan: `gapX: -5 → 0`, `photoAspect: 0 → 0.2`, `photoAspect: 9 → 5`, `tilt: 30 → 10`, `chainOrder: 0 → 1`, `capacity: -1 → 0`; `frame: "hexagon" → "rect"`.
  - `layoutCourseMosaic` con 25 chicos en 1000×800, `gapX = gapY = 10`, `photoAspect 0.75`, nombre debajo, `fontSize 16`: devuelve 25 celdas, `overflow 0`; ninguna celda se sale del bloque; ninguna se superpone con otra (comparar rectángulos foto+nombre); todas las fotos miden lo mismo.
  - El mismo reparto elige más columnas que filas para un bloque de 2000×500 y más filas que columnas para 500×2000.
  - Con 5 chicos la foto es más grande que con 40 en el mismo bloque.
  - `lastRowAlign: "center"` con 7 chicos en 3 columnas: la celda de la última fila queda centrada (su centro x = 500 ± 1 en un bloque de 1000).
  - `reserved = {x:0.5,y:0,width:0.5,height:0.5}`: ninguna celda corta esa zona y siguen entrando los 25.
  - `gapX: 0, gapY: 0, namePosition: "none"`: las celdas vecinas se tocan (borde derecho de una = borde izquierdo de la siguiente).
  - `tilt: 3`: los giros alternan `3, -3, 3…` por orden de celda; con `tilt: 0` todos son 0.
  - `splitCourseMosaicChain` con bloques `{a: chainOrder 1, capacity 10}`, `{b: chainOrder 2, capacity 0}` y 25 chicos: `a` recibe los 10 primeros, `b` los 15 restantes; con 6 chicos `b` recibe `[]`.
  - `formatMosaicName` con «María Sol» «Pérez»: `givenNames:"first", nameLines:1` → `["María Pérez"]`; `nameLines:2` → `["María", "Pérez"]`.
  - `sortCourseMosaic` por apellido ordena con `localeCompare(…, "es")`, así «Ñandú» va después de «Nuñez».

- [ ] **Step 2: Correr y ver que fallan.**
  Run: `pnpm --filter @repo/template-engine exec tsx --test src/plugins/school/course-mosaic.test.ts` (y sumarlo al script `test`)
  Expected: FAIL, el módulo no existe.

- [ ] **Step 3: Implementar.** Seguir el estilo de `class-list.ts` (lectura defensiva de opciones, comentarios en español). Reparto de un bloque:
  ```
  labelH = namePosition === "none" ? 0 : nameLines * fontSize * lineHeight + fontSize * 0.4
  (con "insideBottom" y "polaroid", labelH va dentro del recuadro: no suma alto)
  para cols de 1 a min(n, 14):
    rows = ceil(n / cols)
    repetir:
      pw = min((W - gapX*(cols-1)) / cols,
               ((H - gapY*(rows-1)) / rows - labelH) * photoAspect)
      ubicar la grilla cols×rows de celdas (pw × pw/photoAspect + labelH), centrada en el bloque
      contar celdas que no cortan `reserved`; si alcanzan para n, salir; si no, rows++ (tope 40)
    quedarse con el cols de mayor pw
  llenar fila por fila saltando las celdas de `reserved`; alinear la última fila según lastRowAlign
  ```
  Si con `cols = 1` y `pw` menor a 8 px no entra, devolver las celdas que entran y `overflow` con el resto. El cuerpo del nombre se achica (no menos del 60 %) si la línea más larga, medida como `0.55 * fontSize * caracteres`, no entra en `pw`; si igual no entra, se corta con «…». Declarar la variable `course.mosaic` en `definitions.ts`, igual que `course.studentList`.

- [ ] **Step 4: Correr y ver que pasan.** Mismo comando. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "Mosaico del curso: modelo, opciones y reparto"`

### Task 2: El puente a design-studio (PDF y vista previa)

**Files:**
- Modify: `packages/template-editor-core/src/design-studio-bridge.ts`
- Test: `packages/template-editor-core/src/__tests__/mosaico-del-curso.test.ts`

**Interfaces:**
- Consumes: todo lo de la Task 1.
- Produces: `editorADocumento` acepta `mosaicoDelCurso?: readonly CourseMosaicStudent[]` (sin valor: `COURSE_MOSAIC_SAMPLE`; lista vacía: no dibuja nada). Cada celda sale como, en este orden de dibujo: sombra (`rect` corrido), fondo de polaroid (`rect` blanco), foto (`image`), borde (`rect` sin relleno, encima), marco (`image` con `resourceRef = frameSrc`), cinta (`rect`) y nombre (`text`). Ids `${bloque}__m${i}_${parte}`. La foto: `resourceRef = "mosaic-photo:" + photoId` si hay `photoId`; si no, `photoUrl`; sin ninguno, `rect` gris `#d6d3d1` con las iniciales en `text` (silueta). `crop` y `sourceAspect` pasan tal cual.

- [ ] **Step 1: Tests que fallan.**
  - Un bloque mosaico con 3 chicos (uno con `photoId: 7`, uno con `photoUrl`, uno sin foto) produce 3 `image` o silueta en ese orden, con `resourceRef` `mosaic-photo:7`, la URL y un `rect` gris más un `text` con «JP» para «Juan Pérez».
  - `frame: "circle"` → `image.mask === "circle"` y el borde con `cornerRadius = ancho/2`; `frame: "ellipse"` con `borderWidth > 0` agrega un aviso «borde de elipse» en `avisos` y no dibuja el borde.
  - Dos bloques encadenados (capacidad 2 y 0) con 5 chicos: el primero dibuja 2 nombres y el segundo 3.
  - Bloque girado 90°: el centro de cada celda gira alrededor del centro del bloque (misma cuenta que el listado; reutilizar esa rotación extrayéndola a una función común `girarAlrededor`).
  - Sin `mosaicoDelCurso`, dibuja los 24 de `COURSE_MOSAIC_SAMPLE`.
- [ ] **Step 2:** `pnpm --filter @repo/template-editor-core exec tsx --test src/__tests__/mosaico-del-curso.test.ts` (y sumarlo al script `test`) → FAIL.
- [ ] **Step 3: Implementar** el caso dentro de `case "VARIABLE_TEXT"`, antes del listado. Los bloques mosaico de cada cara se juntan primero (todas las caras, por `chainOrder`) con `splitCourseMosaicChain`, así una cadena puede cruzar de página. La tipografía del nombre sale de las mismas claves que el listado (`fontFamily`, `fontSize`, `color`, `fontWeight`, `lineHeight`).
- [ ] **Step 4:** mismo comando → PASS; además `pnpm --filter @repo/template-editor-core test` sin roturas en `listado-girado.test.ts`.
- [ ] **Step 5: Commit.** `git commit -m "Mosaico del curso: impresión con design-studio"`

### Task 3: El lienzo del editor y el inspector

**Files:**
- Modify: `packages/template-editor-core/src/create-default-blocks.ts`, `packages/template-editor-ui/src/TemplateCanvasRenderer.tsx`, `packages/template-editor-ui/src/TemplateEditorInspector.tsx`, `packages/template-editor-ui/src/TemplateEditorShell.tsx`
- Test: `packages/template-editor-core/src/__tests__/mosaico-del-curso.test.ts` (caso de bloque por defecto)

**Interfaces:**
- Produces: `createDefaultCourseMosaicBlock(canvas: { width: number; height: number }, pageIndex?: number)` → bloque `VARIABLE_TEXT` de 80 % × 60 % del lienzo, centrado, `name: "Mosaico del curso"`, `configJson: { variableKey: COURSE_MOSAIC_VARIABLE_KEY, courseMosaic: DEFAULT_COURSE_MOSAIC_OPTIONS, fontFamily: "Inter", fontSize: 14, color: "#111111", textAlign: "center" }`.
- Consumes: `layoutCourseMosaic`, `readCourseMosaicOptions`, `parseCourseMosaic`, `COURSE_MOSAIC_SAMPLE`.

- [ ] **Step 1: Test que falla:** el bloque por defecto cumple `isCourseMosaicConfig` y su `readCourseMosaicOptions` es igual a los valores por defecto.
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3: Implementar.**
  - `CourseMosaicBlockRenderer` dibuja con la misma `layoutCourseMosaic` (y `splitCourseMosaicChain` sobre los bloques mosaico del diseño), con `<img>` y `object-fit: cover`, ubicando el encuadre con `ubicarFotoEncuadrada` de design-studio, igual que las fotos del lienzo. Sin foto: silueta gris con iniciales.
  - `CourseMosaicOptionsPanel` en el inspector, con las mismas partes que `ClassListOptionsPanel`: Forma, Proporción (3:4, 4:5, 1:1, 2:3), Separación horizontal/vertical, Borde, Sombra (color y corrimiento), Giro alternado, Marco (subir PNG como cualquier imagen), Nombre (posición, una o dos líneas, cinta, sólo primer nombre), Orden, Última fila, Zona libre (casilla y cuatro valores en %), Orden en la cadena y Tope.
  - Botón «Mosaico del curso» al lado de «Listado del curso» en `TemplateEditorShell`, con la misma condición de producto (`school` o `unknown`).
- [ ] **Step 4:** correr el test → PASS; `pnpm --filter @repo/template-editor-ui exec tsc --noEmit` sin errores.
- [ ] **Step 5: Verificar en el navegador** (CLF con `next dev --webpack`): agregar el bloque a una plantilla, cambiar forma, separación y cantidad de columnas. Captura con 24 chicos de muestra en rectángulo, círculo y polaroid.
- [ ] **Step 6: Commit.** `git commit -m "Mosaico del curso: bloque en el editor con sus opciones"`

### Task 4: CLF imprime el mosaico y lo muestra en la demo

**Files:**
- Modify: `apps/compramelafoto/lib/design-v2/values.ts`, `render.ts`, `demo-valores.ts`, `rasgos-de-plantilla.ts`, `pantalla-vs-pdf/casos.ts`
- Test: `apps/compramelafoto/lib/design-v2/values-formatos.test.ts`, `rasgos-de-plantilla.test.ts`, `demo-de-plantilla.test.ts`

**Interfaces:**
- Consumes: Tasks 1 y 2.
- Produces: `DesignValueSources.courseMosaic?: CourseMosaicStudent[] | null` (lo llena la etapa 1 con el padrón); `RasgosDePlantilla.conMosaico: boolean` y filtro `conMosaico: SiNo` en `FiltrosDeCatalogo`.

- [ ] **Step 1: Tests que fallan.**
  - `buildDesignValues({ courseMosaic: [a, b] })[COURSE_MOSAIC_VARIABLE_KEY]` es `serializeCourseMosaic([a, b])`; con `[]` o `null` no pone la clave.
  - `rasgosDePlantilla` de una plantilla con un bloque mosaico da `conMosaico: true`; `filtrarPlantillas` con `conMosaico: "si"` la deja y con `"no"` la saca.
  - La demo de una plantilla con mosaico trae `course.mosaic` con 24 chicos, cada uno con `photoUrl` de `template-v2/demo/` (repartiendo las fotos de chicos de demo en ronda).
- [ ] **Step 2:** `pnpm --filter compramelafoto run test:school-design` (con los archivos de prueba tocados sumados al script si no estaban) → FAIL en esos casos.
- [ ] **Step 3: Implementar.**
  - `render.ts`: en `editorBlocksFromResolved`, el `VARIABLE_TEXT` con `isCourseMosaicConfig` sigue como variable (igual que el listado). Pasar `mosaicoDelCurso: parseCourseMosaic(data.values[COURSE_MOSAIC_VARIABLE_KEY])` al puente, o `undefined` si la clave no está, para que la vista de la plantilla sin datos muestre la muestra. En `resources.read`, el prefijo `mosaic-photo:` carga la foto con `input.loadPhoto(id)` (con el mismo `photoCache`) y la achica a 1200 px de lado mayor en JPG; el encuadre lo aplica design-studio con `crop`.
  - `demo-valores.ts`: el mosaico de demo.
  - `pantalla-vs-pdf/casos.ts`: un caso «mosaico 24 en polaroid con giro» para que la comparación pantalla/PDF lo cubra.
- [ ] **Step 4:** el mismo comando → PASS. Correr `pnpm --filter compramelafoto run test:pantalla-vs-pdf` y ver que el caso nuevo no difiere.
- [ ] **Step 5: Verificar** en «Probar plantilla» (`/fotografo/diseno/plantillas/v2/[templateId]/probar`) que el PDF descargado tiene el mosaico con fotos de demo y que la vista previa coincide.
- [ ] **Step 6: Commit.** `git commit -m "Mosaico del curso: impresión en CLF, demo y filtro del catálogo"`

---

## Etapas siguientes (cada una con su propio plan, después de esta)

1. **Etapa 1 — Retrato oficial y padrón**: la foto que elige la familia queda atada a su fila del padrón (migración a mano); maestra y directivos por curso; enlace del colegio para nombrar a los no identificados; cierre del curso; `courseMosaic` se llena desde el padrón sin el dueño.
2. **Etapa 3 — Quitar fondo**: opción «quitar fondo» en el hueco de foto, servicio externo que no guarde fotos, resultado en R2, revisión del fotógrafo.
3. **Etapa 4 — Armado de carpetas**: por compra de la familia (bloqueo hasta el cierre) y «armar las carpetas del curso».
4. **Etapa 5 — 20 plantillas de sistema o más**, con el generador de `scripts/plantillas-sistema/`.
5. **Etapa 6 — Álbum de figuritas.**
