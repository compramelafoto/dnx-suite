# CLF escolar: «¿Quién elige las fotos?» — Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que en una preventa escolar de ComprameLaFoto el fotógrafo decida si las fotos del pack las elige la familia, él mismo, o la familia con un plazo y después él; y que elegir por la familia sea rápido («elegir de corrido»).

**Arquitectura:** la regla vive en una tabla nueva por álbum. La elección del fotógrafo **reutiliza el canje de la familia tal cual**: el fotógrafo abre la misma pantalla `/canje/preventa/[token]` con su sesión y `?como=fotografo`, igual que ya hace con los packs de prueba (`modoPrueba`). El canje se graba con el mismo motor (`executePreventaPackRedeemV1`), así que el diseño, la imprenta, las etiquetas y la entrega no cambian. Lo nuevo es la regla, la división de «Por canjear», la cola «de corrido», la búsqueda del alumno a partir de una foto y la grupal guardada por curso.

**Tecnología:** Next.js (app `apps/compramelafoto`, leer `node_modules/next/dist/docs/` antes de tocar rutas), Prisma (`packages/db/prisma/schema.prisma`, compartido por todas las apps), AWS Rekognition (`lib/faces/rekognition.ts`), pruebas con `node:test` corridas con tsx.

**Spec:** la sección «Diseño acordado» de este mismo documento (lo acordado con Daniel el 24/11/2026).

## Diseño acordado

1. **Opción por álbum** en la sección de preventa: «¿Quién elige las fotos?»
   - `FAMILY` — La familia (como hoy, valor por defecto).
   - `PHOTOGRAPHER` — El fotógrafo. La familia paga y no elige. Si abre su link ve «El fotógrafo está eligiendo tus fotos».
   - `FAMILY_THEN_PHOTOGRAPHER` — La familia, y si no elige en N días (por defecto 7), pasa al fotógrafo. La familia **sigue pudiendo** elegir hasta que el fotógrafo lo haga: gana el primero que confirma.
2. **«Por canjear» se divide** en «Esperando a la familia» y «Te toca elegir».
3. **«Elegir de corrido»:** abre el canje de cada pedido uno atrás del otro. Al confirmar uno, pasa solo al siguiente.
4. **Buscar al alumno:** en modo fotógrafo, en lugar de la selfie, el fotógrafo toca una foto donde aparece el chico (y la cara, si hay varias). Se buscan todas sus fotos por reconocimiento facial.
5. **Grupal por curso:** la primera grupal que elige el fotógrafo en un curso queda guardada y aparece ya puesta en los pedidos siguientes del mismo curso.
6. **Mismo canje por dentro:** se registra «elegido por el fotógrafo» en una tabla aparte. Todo lo posterior no se toca.
7. **Fuera de esta etapa:** el botón «Elegir yo» en un pedido suelto con la regla en `FAMILY`.

## Restricciones globales

- Todo texto de pantalla, correo, commit y PR va en español rioplatense claro. Se dice «dinero», no «plata».
- **Sólo tablas nuevas**, sin columnas nuevas en `Album`, `Order` ni otros modelos existentes. Una columna que falta en una base rompe todas las consultas de ese modelo en las demás apps (P2022). Las tablas nuevas llevan ids enteros sueltos, sin relaciones Prisma, igual que `SchoolCopiesPrintJob`.
- Migración nueva: `packages/db/prisma/migrations/20270303090000_clf_quien_elige_las_fotos/migration.sql`. Se aplica y registra **sólo en la base de CLF** (Neon `divine-hall-10689679`, rama `br-autumn-rain-ad18wq7y`), **con permiso explícito de Daniel**, y antes del merge.
- El link del fotógrafo se crea con `createPackAccessTokenForOrder(id, { ttlDays: 1, revokeExisting: false })`. **Nunca con `revokeExisting` en `true` (es el valor por defecto)**, porque mataría el link de la familia.
- Los packs DEMO (`isTest`) nunca mandan correos a familias.
- Comando de pruebas (desde `apps/compramelafoto`): `../../packages/payments/node_modules/.bin/tsx --tsconfig ./tsconfig.json --test <archivo>`.
- Trabajar en un worktree cortado de `origin/main`: el `main` local está desactualizado.

## Puntos a vigilar en la revisión

1. **Los dos confirman a la vez** (familia y fotógrafo, en `FAMILY_THEN_PHOTOGRAPHER`): el segundo recibe el P2002 del canje. La pantalla tiene que decir «Este pack ya lo eligió la familia» (o «…el fotógrafo»), no un error genérico. → prueba en la Tarea 5.
2. **El link de la familia sigue andando** después de que el fotógrafo abre el suyo (`revokeExisting: false`). → prueba en la Tarea 5.
3. **Se cambia la regla con pedidos a medias:** los ya canjeados no se tocan, y sólo cambia de lado lo que está «Por canjear». → prueba de `quienElige` en la Tarea 2.
4. **Álbum con fotos ocultas por selfie:** en modo fotógrafo se ven todas las fotos, igual que en `modoPrueba`. → paso en la Tarea 5.
5. **Pack sin librito** (sólo digitales o sólo copias): el modo fotógrafo funciona igual, y la grupal por curso sólo se guarda si hubo una grupal. → prueba en la Tarea 7.

---

### Tarea 1: Tablas nuevas

**Archivos:**
- Modificar: `packages/db/prisma/schema.prisma` (al final, junto a `SchoolCopiesPrintJob`)
- Crear: `packages/db/prisma/migrations/20270303090000_clf_quien_elige_las_fotos/migration.sql`

**Interfaces producidas:**
```prisma
/// Regla de la preventa escolar: quién elige las fotos del pack (CLF). Una fila por álbum; sin fila = FAMILY.
model SchoolPhotoChooserSetting {
  id              Int      @id @default(autoincrement())
  albumId         Int      @unique
  /// FAMILY | PHOTOGRAPHER | FAMILY_THEN_PHOTOGRAPHER
  mode            String   @default("FAMILY")
  /// Sólo FAMILY_THEN_PHOTOGRAPHER: días que tiene la familia antes de que pase al fotógrafo.
  familyDays      Int?
  updatedByUserId Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

/// Canjes que hizo el fotógrafo por la familia. `preventaOrderId` = pack (Order PREVENTA_PACK).
model SchoolPhotoChosenByPhotographer {
  id                 Int      @id @default(autoincrement())
  preventaOrderId    Int      @unique
  redemptionOrderId  Int      @unique
  photographerUserId Int
  createdAt          DateTime @default(now())
}

/// Foto grupal elegida por el fotógrafo para un curso: se propone en los pedidos siguientes.
model SchoolCourseGroupPhoto {
  id             Int      @id @default(autoincrement())
  albumId        Int
  /// `claveDeCurso()` (Tarea 7).
  courseKey      String
  photoId        Int
  chosenByUserId Int
  updatedAt      DateTime @updatedAt
  @@unique([albumId, courseKey])
}
```

- [ ] **Paso 1:** Agregar los tres modelos al schema.
- [ ] **Paso 2:** Escribir el `migration.sql` a mano, con `CREATE TABLE IF NOT EXISTS` y los índices únicos, tomando como molde `20270215090000_clf_school_copies_print_job`.
- [ ] **Paso 3:** Correr `pnpm --filter @repo/db exec prisma validate`. Esperado: «The schema … is valid».
- [ ] **Paso 4:** Correr `pnpm --filter @repo/db exec prisma generate`. Esperado: sin errores.
- [ ] **Paso 5:** Commit: `Agregar las tablas de quién elige las fotos en la preventa escolar`.
- [ ] **Paso 6 (antes del merge, con permiso de Daniel):** aplicar el SQL en la base de CLF con el MCP de Neon (`run_sql_transaction`, `branch_id` explícito) y registrar la fila en `_prisma_migrations` con el `sha256` del archivo.

### Tarea 2: La regla, como función pura

**Archivos:**
- Crear: `apps/compramelafoto/lib/schools/quien-elige-las-fotos.ts`
- Prueba: `apps/compramelafoto/lib/schools/quien-elige-las-fotos.test.ts`

**Interfaces producidas:**
```ts
export const MODOS_ELECCION = ["FAMILY", "PHOTOGRAPHER", "FAMILY_THEN_PHOTOGRAPHER"] as const;
export type ModoEleccion = (typeof MODOS_ELECCION)[number];
export type ReglaEleccion = { mode: ModoEleccion; familyDays: number };
export const DIAS_POR_DEFECTO = 7;
export function leerRegla(fila: { mode: string; familyDays: number | null } | null): ReglaEleccion;
/** Quién tiene que elegir hoy un pack no canjeado. `inicio` = aviso de fotos listas, o la fecha del pack. */
export function quienElige(regla: ReglaEleccion, pack: { inicio: Date }, ahora: Date): "FAMILIA" | "FOTOGRAFO";
/** ¿La familia puede confirmar el canje? FAMILY y FAMILY_THEN_PHOTOGRAPHER: sí; PHOTOGRAPHER: no. */
export function familiaPuedeElegir(regla: ReglaEleccion): boolean;
export const TEXTOS_MODO: Record<ModoEleccion, { titulo: string; ayuda: string }>;
```

- [ ] **Paso 1: escribir las pruebas que fallan**
  - `leerRegla(null)` → `{ mode: "FAMILY", familyDays: 7 }`.
  - `leerRegla({ mode: "CUALQUIERA", familyDays: 3 })` → `mode: "FAMILY"`.
  - `familyDays` se acota entre 1 y 60: `0` → 1, `90` → 60, `null` → 7.
  - `quienElige(FAMILY, …)` → `"FAMILIA"` siempre. `quienElige(PHOTOGRAPHER, …)` → `"FOTOGRAFO"` siempre.
  - `FAMILY_THEN_PHOTOGRAPHER` con 7 días: inicio 1/11 y ahora 7/11 23:59 (hora argentina) → `"FAMILIA"`. Inicio 1/11 y ahora 8/11 00:01 → `"FOTOGRAFO"`.
  - `familiaPuedeElegir`: `true`, `false`, `true` para los tres modos.
- [ ] **Paso 2:** correr la prueba. Esperado: FALLA (el módulo no existe).
- [ ] **Paso 3:** implementar. Los días se cuentan como `inicio + familyDays × 24 h`, comparando instantes (sin zona horaria).
- [ ] **Paso 4:** correr la prueba. Esperado: PASA.
- [ ] **Paso 5:** Commit: `Regla de quién elige las fotos de la preventa escolar`.

Textos de `TEXTOS_MODO` (copia fija):
- FAMILY: «La familia» / «Cada familia elige sus fotos con su link, como hasta ahora.»
- PHOTOGRAPHER: «Yo (el fotógrafo)» / «Las familias pagan y vos elegís las fotos de cada pack. Ellas reciben el aviso cuando está listo.»
- FAMILY_THEN_PHOTOGRAPHER: «La familia, y si no elige, yo» / «La familia tiene unos días para elegir. Si no lo hace, el pedido pasa a «Te toca elegir». Hasta que elijas vos, la familia todavía puede hacerlo.»

### Tarea 3: Configuración en la preventa del álbum

**Archivos:**
- Crear: `apps/compramelafoto/app/api/dashboard/albums/[id]/quien-elige/route.ts` (GET y PUT)
- Crear: `apps/compramelafoto/components/dashboard/preventa-packs/QuienEligeFotosCard.tsx`
- Modificar: `apps/compramelafoto/components/dashboard/preventa-packs/PreventaPackDashboardSection.tsx` (poner la tarjeta junto a `PreventaAvisoFamiliasCard`)

**Interfaces:**
- Consume: `leerRegla`, `MODOS_ELECCION`, `TEXTOS_MODO` (Tarea 2).
- Produce: `GET` → `{ mode, familyDays }`; `PUT { mode, familyDays? }` → `{ ok: true, mode, familyDays }`. Exige dueño del álbum (o admin), con la misma verificación que `app/api/dashboard/albums/[id]/preventa-aviso/route.ts`. Un `mode` inválido devuelve 400.
- Produce también: `export async function cargarRegla(albumId: number): Promise<ReglaEleccion>` en `apps/compramelafoto/lib/schools/quien-elige-las-fotos-server.ts` (con `import "server-only"`). La usan las Tareas 4, 5 y 8.

- [ ] **Paso 1:** implementar `cargarRegla` y la ruta. El PUT hace un `upsert` por `albumId` y guarda `updatedByUserId`.
- [ ] **Paso 2:** implementar la tarjeta: tres opciones de radio con `TEXTOS_MODO`. Con `FAMILY_THEN_PHOTOGRAPHER` aparece «Días que tiene la familia» (número, de 1 a 60). Botón «Guardar», y un aviso «Sin guardar» mientras haya cambios pendientes.
- [ ] **Paso 3:** verificar en el navegador con un álbum de prueba que la opción se guarda y se mantiene al recargar.
- [ ] **Paso 4:** Commit: `Elegir en la preventa quién elige las fotos`.

### Tarea 4: «Por canjear» dividido en dos

**Archivos:**
- Modificar: `apps/compramelafoto/lib/schools/embudo-pedidos-escolares.ts` y su `.test.ts`
- Modificar: `apps/compramelafoto/app/api/fotografo/school-orders/route.ts`
- Modificar: `apps/compramelafoto/app/fotografo/escuelas/pedidos/page.tsx`

**Interfaces:**
- Consume: `cargarRegla`, `quienElige` (Tareas 2 y 3).
- Produce, en cada fila del API:
  - `eligeQuien: "FAMILIA" | "FOTOGRAFO" | null`. Es `null` fuera de «Por canjear».
  - `packOrderIds: number[]`: los packs (`Order` PREVENTA_PACK, `PAID`, `redemptionOrderId: null`) que se pueden elegir. En PACK_EXTERNO es `[id]`. En TIENDA_ESCOLAR son los `Order` con `preCompraPaymentRef = String(preCompraOrder.id)`.
- Produce, en el embudo:
  ```ts
  export type ResponsablePorCanjear = "FAMILIA" | "FOTOGRAFO";
  export function separarPorCanjear<T extends { paso: string; eligeQuien?: ResponsablePorCanjear | null }>(filas: T[]): { familia: T[]; fotografo: T[] };
  ```
- Cambia: `packsPendientesPorAlbum` ignora las filas con `eligeQuien === "FOTOGRAFO"`.

- [ ] **Paso 1: pruebas que fallan** en `embudo-pedidos-escolares.test.ts`:
  - `separarPorCanjear` reparte por `eligeQuien`. Ignora las filas fuera de `POR_CANJEAR`. Una fila `POR_CANJEAR` sin `eligeQuien` va a `familia`.
  - `packsPendientesPorAlbum` no incluye un pack externo con `eligeQuien: "FOTOGRAFO"`.
- [ ] **Paso 2:** correr. Esperado: FALLA.
- [ ] **Paso 3:** implementar las funciones. En el API, cargar la regla de cada álbum una vez (un `Map` por `albumId`). Calcular `inicio` con `fechaAvisoFotosListas(order.redemptionPaymentRefsJson) ?? order.createdAt`.
- [ ] **Paso 4:** correr. Esperado: PASA.
- [ ] **Paso 5:** en la pantalla, en la vista «Por canjear», poner dos pestañas: «Esperando a la familia (n)» y «Te toca elegir (n)».
  - En «Te toca elegir», el botón principal es «Elegir de corrido (n)» (se conecta en la Tarea 5) y no aparecen «Avisar a las familias» ni «Reenviar link».
  - Texto de cada fila: «Te toca elegir» o «Todavía no eligió sus fotos».
  - Ayuda del paso 1 en `INFO_PASOS`: «Pagaron y falta elegir las fotos: la familia o vos, según la preventa.»
- [ ] **Paso 6:** Commit: `Dividir «Por canjear» entre la familia y el fotógrafo`.

### Tarea 5: Elegir por la familia, de corrido

**Archivos:**
- Crear: `apps/compramelafoto/app/api/fotografo/escolar/elegir/route.ts` (POST)
- Crear: `apps/compramelafoto/app/fotografo/escuelas/elegir/page.tsx` (página cliente de la cola)
- Crear: `apps/compramelafoto/lib/schools/cola-de-eleccion.ts` y `cola-de-eleccion.test.ts`
- Modificar: `apps/compramelafoto/app/canje/preventa/[token]/page.tsx`
- Modificar: `apps/compramelafoto/components/canje-externo/PreventaCanjeFlow.tsx`
- Modificar: `apps/compramelafoto/app/api/public/pack/[token]/redeem/route.ts`

**Interfaces:**
- Consume: `packOrderIds` (Tarea 4), `cargarRegla`, `familiaPuedeElegir` (Tareas 2 y 3), `createPackAccessTokenForOrder`, `puedeUsarPackDePrueba(viewer, album.userId)` (ya existe: dueño o admin).
- Produce:
  - `POST /api/fotografo/escolar/elegir { packOrderId }` → `{ url: "/canje/preventa/<token>?como=fotografo" }`. Responde 403 si no es el dueño y 409 «Este pack ya fue elegido» si ya tiene `redemptionOrderId`.
  - Cola en `sessionStorage`, clave `clf:cola-elegir`:
    ```ts
    export function armarCola(packOrderIds: number[]): number[];            // sin repetidos, en orden
    export function siguienteDeLaCola(cola: number[], hecho: number | null): { siguiente: number | null; resto: number[] };
    ```
  - Prop nueva de `PreventaCanjeFlow`: `modoFotografo?: { alumno: string; grupalDelCurso: number | null }`.
  - Cuerpo nuevo del redeem: `comoFotografo?: true` y `grupalElegida?: number` (la segunda la usa la Tarea 7).

- [ ] **Paso 1: pruebas que fallan** de `cola-de-eleccion`:
  - `armarCola([3, 1, 3])` → `[3, 1]`.
  - `siguienteDeLaCola([3, 1], 3)` → `{ siguiente: 1, resto: [] }`.
  - `siguienteDeLaCola([], null)` → `{ siguiente: null, resto: [] }`.
- [ ] **Paso 2:** correr. Esperado: FALLA. Implementar. Correr. Esperado: PASA.
- [ ] **Paso 3:** ruta POST. Verificar que el pack es `PREVENTA_PACK`, `PAID`, sin canjear y de un álbum del fotógrafo. Crear el token con `{ ttlDays: 1, revokeExisting: false }`.
- [ ] **Paso 4:** página `/fotografo/escuelas/elegir`. Lee la cola, pide el link del siguiente y redirige. Con la cola vacía vuelve a `/fotografo/escuelas/pedidos` en la vista «Por canjear». Si un pack da 409, lo saltea y sigue con el próximo. El botón «Elegir de corrido» de la Tarea 4 guarda `armarCola(filas.flatMap(f => f.packOrderIds))` y navega a esta página.
- [ ] **Paso 5:** página del canje.
  - Con `?como=fotografo` y `puedeUsarPackDePrueba(viewer, album.userId)` → `modoFotografo`: sin selfie, sin el filtro de fotos ocultas y sin el aviso «Las fotos de tu curso todavía no están», igual que `modoPrueba`.
  - Sin modo fotógrafo y con `familiaPuedeElegir(regla) === false` → `<Aviso titulo="El fotógrafo está eligiendo tus fotos" texto="{fotógrafo} va a elegir las mejores fotos de {alumno}. Cuando esté listo te llega un correo con todo." />`.
- [ ] **Paso 6:** en `PreventaCanjeFlow`, con `modoFotografo`:
  - Franja fija arriba: «Estás eligiendo por la familia de {alumno}».
  - La revisión del librito se mantiene, y el fotógrafo es quien autoriza la impresión.
  - Al confirmar, en lugar de la pantalla final de la familia, ir a `/fotografo/escuelas/elegir?hecho=<packOrderId>`.
- [ ] **Paso 7:** ruta redeem.
  - Con `comoFotografo`, exigir sesión de dueño (403 si no). `revision.by` = nombre y email del fotógrafo. Después del canje, insertar `SchoolPhotoChosenByPhotographer`.
  - Sin `comoFotografo` y con `familiaPuedeElegir(regla) === false` → 409 «El fotógrafo elige las fotos de este pack».
  - Si el canje choca (P2002 o «ya fue canjeado»), responder 409 con «Este pack ya lo eligió la familia» o «…el fotógrafo», según exista la fila en `SchoolPhotoChosenByPhotographer`.
  - `completePreventaRedemption` se llama igual: la familia recibe su correo de entrega.
- [ ] **Paso 8:** probar a mano con un pack DEMO del álbum de prueba:
  - El link viejo de la familia sigue abriendo después de que el fotógrafo creó el suyo.
  - Con la regla en `PHOTOGRAPHER`, la familia ve el aviso.
  - El fotógrafo canjea y pasa solo al siguiente pack de la cola.
  - El pedido pasa a «Revisar diseño».
- [ ] **Paso 9:** Commit: `Elegir de corrido las fotos de la preventa por la familia`.

### Tarea 6: Buscar al alumno a partir de una foto

**Archivos:**
- Modificar: `apps/compramelafoto/lib/faces/rekognition.ts`
- Crear: `apps/compramelafoto/lib/faces/fotos-del-alumno.ts` y `fotos-del-alumno.test.ts`
- Crear: `apps/compramelafoto/app/api/fotografo/escolar/fotos-del-alumno/route.ts` (GET)
- Modificar: `apps/compramelafoto/components/canje-externo/PreventaCanjeFlow.tsx`

**Interfaces:**
- `export async function searchFacesByFaceId(faceId: string): Promise<FaceSearchMatch[]>`: usa `SearchFacesCommand` sobre la misma colección y con el mismo umbral que `searchFacesByImage`.
- Función pura:
  ```ts
  export function fotosDelAlumno(
    origen: { photoId: number },
    matches: Array<{ faceId: string; similarity: number }>,
    detecciones: Array<{ rekognitionFaceId: string; photoId: number }>,
    fotosDelAlbum: Set<number>,
  ): number[]; // la foto de origen primero, después las demás de mayor a menor parecido, sin repetir y sólo del álbum
  ```
- `GET /api/fotografo/escolar/fotos-del-alumno?albumId=&photoId=&detectionId=` (sólo el dueño):
  - Si la foto tiene más de una cara y no llega `detectionId` → `{ caras: [{ detectionId, bbox }] }`.
  - Si tiene una cara, o llega `detectionId` → `{ photoIds: number[] }`.
  - Si no tiene caras → `{ photoIds: [photoId], aviso: "No encontramos caras en esta foto" }`.

- [ ] **Paso 1: pruebas que fallan** de `fotosDelAlumno`:
  - El origen va primero aunque no esté en `matches`.
  - El orden es por `similarity` de mayor a menor.
  - Se descartan las fotos fuera de `fotosDelAlbum`.
  - Dos caras de la misma foto dan una sola entrada.
- [ ] **Paso 2:** correr. Esperado: FALLA. Implementar. Correr. Esperado: PASA.
- [ ] **Paso 3:** `searchFacesByFaceId` y la ruta.
- [ ] **Paso 4:** en `PreventaCanjeFlow` con `modoFotografo`, el paso de la selfie se reemplaza por «Tocá una foto donde aparezca {alumno}». Se muestra la grilla de todas las fotos. Si la foto tiene varias caras, se marcan sobre la foto para tocar una. Después, la grilla queda filtrada con esas fotos (el mismo filtro que deja la selfie) y con el botón «Ver todas».
- [ ] **Paso 5:** probar en el álbum de prueba con fotos ya analizadas: tocar un chico devuelve sus fotos.
- [ ] **Paso 6:** Commit: `Buscar las fotos del alumno tocando una foto suya`.

### Tarea 7: Grupal por curso

**Archivos:**
- Crear: `apps/compramelafoto/lib/schools/grupal-del-curso.ts` y `grupal-del-curso.test.ts`
- Modificar: `apps/compramelafoto/app/canje/preventa/[token]/page.tsx` (pasar `grupalDelCurso`)
- Modificar: `apps/compramelafoto/components/canje-externo/PreventaCanjeFlow.tsx` (proponerla y mandar `grupalElegida`)
- Modificar: `apps/compramelafoto/app/api/public/pack/[token]/redeem/route.ts` (guardarla)

**Interfaces:**
```ts
/** "5° A" → "5° a"; espacios colapsados. null si no hay curso. */
export function claveDeCurso(curso: { name: string; division: string | null } | null | undefined): string | null;
/** La foto que se guarda: la elegida para el lugar grupal, si está entre las del canje. */
export function grupalParaGuardar(grupalElegida: number | undefined, fotosDelCanje: number[]): number | null;
```
- El curso del pack sale de `preCompra.schoolCourse` (tienda escolar) o de `externo.courseName` (pack por fuera). Pasa por `claveDeCurso`, que se apoya en `textoCurso`.

- [ ] **Paso 1: pruebas que fallan**:
  - `claveDeCurso({ name: "5°", division: "A" })` y `claveDeCurso({ name: " 5° ", division: "a " })` dan la misma clave.
  - `claveDeCurso(null)` → `null`.
  - `grupalParaGuardar(9, [4, 9])` → 9.
  - `grupalParaGuardar(9, [4])` → `null`.
  - `grupalParaGuardar(undefined, [4])` → `null` (pack sin grupal).
- [ ] **Paso 2:** correr. Esperado: FALLA. Implementar. Correr. Esperado: PASA.
- [ ] **Paso 3:** la página busca `SchoolCourseGroupPhoto` por `(albumId, claveDeCurso(curso))` y la pasa en `modoFotografo.grupalDelCurso`. El flujo la pone en el lugar grupal (hueco `photo_group` del librito o la copia «Foto grupal» del combo) y deja cambiarla. Al confirmar manda `grupalElegida` con la foto de ese lugar.
- [ ] **Paso 4:** el redeem, con `comoFotografo` y `grupalParaGuardar(...) != null`, hace un `upsert` de `SchoolCourseGroupPhoto`.
- [ ] **Paso 5:** probar a mano: dos packs DEMO del mismo curso. Al segundo ya le aparece la grupal del primero.
- [ ] **Paso 6:** Commit: `Recordar la foto grupal de cada curso al elegir por las familias`.

### Tarea 8: Correo de pago y avisos a las familias

**Archivos:**
- Modificar: `apps/compramelafoto/lib/preventa-canjeable/pack-access-email-content.ts` y su `.test.ts`
- Modificar: quien llama a `buildPreventaPackAccessEmailContent(` (buscarlo con `git grep`)
- Modificar: `apps/compramelafoto/app/api/dashboard/albums/[id]/preventa-aviso/route.ts` y `apps/compramelafoto/app/api/fotografo/school-orders/reenviar-link/route.ts`

**Interfaces:**
- `PreventaPackAccessEmailInput` suma `eligeElFotografo?: boolean`. Quien llama lo calcula con `cargarRegla(albumId)` y es `true` sólo con `PHOTOGRAPHER`.

- [ ] **Paso 1: pruebas que fallan** en `pack-access-email-content.test.ts`: con `eligeElFotografo: true`, el texto contiene «va a elegir las mejores fotos» y el botón dice «Ver mi pack» (no «Elegir mis fotos»). Sin la marca, el correo queda igual que hoy (comparar con la salida actual).
- [ ] **Paso 2:** correr. Esperado: FALLA. Implementar. Correr. Esperado: PASA.
- [ ] **Paso 3:** «Avisar a las familias» y «Reenviar link» no mandan nada a los packs de un álbum en `PHOTOGRAPHER`. Responden con `{ enviados: 0, motivo: "En esta preventa elegís vos las fotos" }`, y la pantalla muestra ese motivo.
- [ ] **Paso 4:** Commit: `Avisarle a la familia que el fotógrafo elige sus fotos`.

### Tarea 9: Verificación final

- [ ] **Paso 1:** correr todas las pruebas nuevas y las del embudo. Esperado: todas pasan.
- [ ] **Paso 2:** typecheck de `apps/compramelafoto`. Verificar el código de salida, no sólo el texto, porque el typecheck puede morir por falta de memoria y devolver éxito.
- [ ] **Paso 3:** con la migración ya aplicada en CLF, recorrido completo con packs DEMO en el álbum de prueba:
  - regla `PHOTOGRAPHER`;
  - «Te toca elegir»;
  - «Elegir de corrido» en dos packs del mismo curso;
  - grupal propuesta en el segundo;
  - los dos pasan a «Revisar diseño»;
  - aprobar y armar el lote.
- [ ] **Paso 4:** PR en español, avisando en la descripción que la migración ya está aplicada en la base de CLF y que las demás bases no la necesitan.
