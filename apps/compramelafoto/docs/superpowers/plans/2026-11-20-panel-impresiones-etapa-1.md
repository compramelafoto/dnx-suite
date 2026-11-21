# Panel de impresiones — Etapa 1: lotes de pedidos comunes al laboratorio por enlace

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que el fotógrafo de CLF arme lotes con las copias de sus pedidos comunes pagados, se los
mande a su laboratorio por correo con un enlace, siga el estado del lote y de cada pedido, imprima sobres
y etiquetas con QR, y que el cliente pueda retirar en el laboratorio que eligió al comprar.

**Arquitectura:** tablas nuevas `PhotographerLabContact`, `PrintBatch`, `PrintBatchEntry` y la columna
`Order.pickupLabContactId`. Las reglas puras (estados, equivalencias, elegibilidad, códigos firmados,
token) viven en `lib/print-batches/` con pruebas `node:test`; el servicio con Prisma en
`lib/print-batches/servicio.ts` (`server-only`). El estado de cada pedido se escribe en el `PrintOrder`
espejo que ya existe, **sin `labId`** y **sin pasar por las rutas viejas de estado**. El laboratorio entra
por `/lab/lote/[token]`.

**Stack:** Next.js (App Router, ver `node_modules/next/dist/docs/` antes de escribir rutas), Prisma,
Postgres (Neon), `pdf-lib` + `qrcode`, R2, `queueEmail`.

**Diseño:** `apps/compramelafoto/docs/superpowers/specs/2026-11-20-panel-impresiones-lotes-laboratorio-design.md`
(leerlo entero antes de empezar; §4.2 y §6.2 son los que más se rompen).

## Restricciones globales

- Todos los textos de pantalla, correos y mensajes de error en español rioplatense («Elegí», «Tocá»).
- Montos en ARS enteros (como `PrintOrder.total`).
- Al `PrintOrder` espejo **nunca** se le pone `labId`.
- Los cambios de estado del lote **no** usan `/api/print-orders/[id]/status` ni `/bulk-status`.
- Al cliente sólo le llega correo al pasar a «Listo para retirar» (`READY_TO_PICKUP`).
- Correo al laboratorio fallido ⇒ el lote queda `ARMADO`, no `ENVIADO`.
- Pedidos que entran: `Order.status = PAID`, con ítems `PRINT`/`FRAME` fuera de un diseño, no demo, no
  canje con voucher, sin otro lote vivo.
- La línea escolar de 7 pasos no cambia de comportamiento (no se toca `lib/design-v2/produccion.ts`).
- Migración sólo en la base de CLF (`production`, `br-autumn-rain-ad18wq7y`), aplicada a mano y registrada
  **antes** de fusionar.
- Tope por ZIP: 15 pedidos (`MAX_PEDIDOS` de `export-print-lote`); lotes más grandes, en partes.
- Pruebas: `tsx --test` como el resto (`../../packages/payments/node_modules/.bin/tsx --tsconfig ./tsconfig.json --test …`),
  agrupadas en el script nuevo `test:lotes-impresion`, sumado a `.github/workflows/chequeos.yml`.
- El `tsc` local puede quedarse sin memoria o mentir por cliente Prisma viejo: el control de tipos lo da CI.

## Foco de revisión

1. **Pedido con librito + copias sueltas**: al lote van sólo las copias sueltas; el ZIP no trae las fotos
   del librito. → prueba en Tarea 2 (`elegibilidad`) y verificación manual en Tarea 6.
2. **Dos pestañas, dos «Armar lote» al mismo tiempo** con el mismo pedido: uno solo gana (índice único
   parcial) y el otro recibe «Ese pedido ya está en el Lote N». → Tarea 1 (índice) y Tarea 4 (manejo del
   error P2002).
3. **Enlace del lote reenviado o adivinado**: un token de otro lote o uno inventado da 404, sin decir si
   existe. → prueba en Tarea 3.
4. **Lote mixto (retira fotógrafo + retira cliente)** pasa a `LISTO`: los de retiro del fotógrafo quedan
   `READY`, los de retiro del cliente `READY_TO_PICKUP` con correo; el lote no se cierra hasta que todos
   estén entregados o recibidos. → prueba en Tarea 2 (`estadoDelPedidoPara`, `loteCerrado`).
5. **Foto borrada del álbum entre armar y enviar** (álbum vencido a los 45 días): el envío se frena y dice
   qué pedido. → Tarea 4 (`enviarLote` revalida con `fileExistsInR2`).

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/db/prisma/schema.prisma` | modelos y enums nuevos |
| `packages/db/prisma/migrations/20270222090000_clf_lotes_impresion/migration.sql` | migración + índice parcial |
| `apps/compramelafoto/lib/print-batches/reglas.ts` | estados, equivalencias, quién mueve qué, elegibilidad (puro) |
| `apps/compramelafoto/lib/print-batches/codigos.ts` | código del QR del pedido y token del lote (puro) |
| `apps/compramelafoto/lib/print-batches/servicio.ts` | Prisma: listar, armar, enviar, mover estados, reimprimir |
| `apps/compramelafoto/lib/print-batches/correos.ts` | textos y encolado de los correos |
| `apps/compramelafoto/lib/print-batches/zip-del-lote.ts` | planes de ZIP por partes |
| `apps/compramelafoto/lib/print-batches/impresos.ts` | PDFs: sobres, etiqueta del lote, remito |
| `apps/compramelafoto/lib/print-batches/contactos.ts` | validación y vínculo de «Mis laboratorios» |
| `apps/compramelafoto/app/api/fotografo/laboratorios/**` | CRUD de contactos |
| `apps/compramelafoto/app/api/fotografo/impresiones/**` | panel, lotes, envío, estados, ZIP, PDFs |
| `apps/compramelafoto/app/lab/lote/[token]/page.tsx` + `app/api/lab-lote/[token]/**` | puerta del laboratorio sin cuenta |
| `apps/compramelafoto/app/pedido/entrega/[codigo]/page.tsx` + `app/api/pedido/entrega/[codigo]/route.ts` | QR del sobre |
| `apps/compramelafoto/app/fotografo/impresiones/page.tsx` + `components/fotografo/impresiones/*` | panel |
| `app/api/a/[id]/order-photos/route.ts`, `app/a/[id]/comprar/ComprarClient.tsx`, `app/api/a/[id]/orders/route.ts` | elegir punto de retiro |

---

### Tarea 1: Esquema y migración

**Archivos:**
- Modificar: `packages/db/prisma/schema.prisma` (junto a `PrintOrder`, ~línea 4505)
- Crear: `packages/db/prisma/migrations/20270222090000_clf_lotes_impresion/migration.sql`

**Interfaces — Produce:**
```prisma
enum PrintBatchEstado { ARMADO ENVIADO EN_PRODUCCION LISTO DESPACHADO RECIBIDO CERRADO ANULADO }
enum PrintBatchTipo { COMUNES ESCOLAR }
enum PrintBatchEntrega { RETIRA_FOTOGRAFO ENVIA_LAB }

model PhotographerLabContact {
  id Int @id @default(autoincrement())
  photographerId Int; labId Int?; nombre String; email String; whatsapp String?; notas String?
  esPredeterminado Boolean @default(false); puntoDeRetiro Boolean @default(false)
  direccion String?; horario String?; activo Boolean @default(true)
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  @@unique([photographerId, email]) @@index([labId])
}
model PrintBatch {
  id Int @id @default(autoincrement())
  photographerId Int; labContactId Int?; labId Int?
  nombre String; tipo PrintBatchTipo @default(COMUNES); estado PrintBatchEstado @default(ARMADO)
  mensajeAlLab String?; entregaPreferida PrintBatchEntrega @default(RETIRA_FOTOGRAFO); fechaPrometida DateTime?
  tokenHash String? @unique
  enviadoAt DateTime?; labAbrioAt DateTime?; labDescargoAt DateTime?; enProduccionAt DateTime?
  listoAt DateTime?; despachadoAt DateTime?; recibidoAt DateTime?; cerradoAt DateTime?
  pagadoAlLabAt DateTime?
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  entries PrintBatchEntry[]
  @@index([photographerId, estado])
}
model PrintBatchEntry {
  id Int @id @default(autoincrement())
  batchId Int; albumOrderId Int?; printOrderId Int?; designProjectId Int?; schoolCopiesJobId Int?
  retiraCliente Boolean @default(false); pickupLabContactId Int?
  resumen Json; quitadoAt DateTime?; entregadoAt DateTime?
  createdAt DateTime @default(now())
  @@index([batchId]) @@index([albumOrderId]) @@index([printOrderId])
}
// Order: + pickupLabContactId Int?  (relación a PhotographerLabContact, onDelete: SetNull)
```
Relaciones con `User` (fotógrafo), `Lab`, `PrintOrder`, `Order` con nombres explícitos; `onDelete: Cascade`
de `PrintBatchEntry` a `PrintBatch`.

- [ ] **Paso 1:** escribir los modelos en `schema.prisma` y generar la migración con
  `pnpm --filter @repo/db exec prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --script`
  (o a mano); revisar que **sólo** cree estas tablas, enums y la columna.
- [ ] **Paso 2:** agregar al final del `migration.sql`:
  ```sql
  CREATE UNIQUE INDEX "PrintBatchEntry_albumOrder_vivo" ON "PrintBatchEntry" ("albumOrderId")
    WHERE "albumOrderId" IS NOT NULL AND "quitadoAt" IS NULL;
  ```
- [ ] **Paso 3:** probar el SQL en una rama de Neon nueva hija de `production` (`run_sql_transaction`), con
  un `INSERT` duplicado que debe fallar por el índice; borrar la rama.
- [ ] **Paso 4:** `pnpm --filter @repo/db exec prisma generate` y commit
  («Sumar las tablas de lotes de impresión de CLF»).

> La aplicación en producción va en la Tarea 12, con permiso de Daniel.

---

### Tarea 2: Reglas puras de estados y elegibilidad

**Archivos:**
- Crear: `apps/compramelafoto/lib/print-batches/reglas.ts`, `apps/compramelafoto/lib/print-batches/reglas.test.ts`
- Modificar: `apps/compramelafoto/package.json` (script `test:lotes-impresion`), `.github/workflows/chequeos.yml`
  (paso «Pruebas de los lotes de impresión» después de «Pruebas de la carpeta de impresión»)

**Interfaces — Produce:**
```ts
export type EstadoLote = "ARMADO"|"ENVIADO"|"EN_PRODUCCION"|"LISTO"|"DESPACHADO"|"RECIBIDO"|"CERRADO"|"ANULADO";
export type QuienMueve = "FOTOGRAFO" | "LABORATORIO";
export function puedeMover(desde: EstadoLote, hacia: EstadoLote, quien: QuienMueve, entrega: "RETIRA_FOTOGRAFO"|"ENVIA_LAB"): boolean;
export function estadoDelPedidoPara(lote: EstadoLote, retiraCliente: boolean): "CREATED"|"IN_PRODUCTION"|"READY"|"READY_TO_PICKUP"|null;
export function avisaAlCliente(anterior: string, nuevo: string): boolean; // true sólo al entrar a READY_TO_PICKUP
export function loteCerrado(entries: Array<{ quitadoAt: Date|null; entregadoAt: Date|null; retiraCliente: boolean }>, estado: EstadoLote): boolean;
export type PedidoCandidato = { orderStatus: string; esDemo: boolean; esCanjeVoucher: boolean; copiasSueltas: number; enLoteVivo: boolean };
export function motivoParaNoEntrar(p: PedidoCandidato): string | null; // null = entra
```

- [ ] **Paso 1: pruebas que fallan** en `reglas.test.ts`:
  - `puedeMover("ENVIADO","EN_PRODUCCION","LABORATORIO","RETIRA_FOTOGRAFO") === true`;
    `puedeMover("ARMADO","ENVIADO","LABORATORIO",…) === false`;
    `puedeMover("LISTO","DESPACHADO","LABORATORIO","RETIRA_FOTOGRAFO") === false` (sólo con `ENVIA_LAB`);
    `puedeMover("LISTO","RECIBIDO","FOTOGRAFO",…) === true`; el fotógrafo puede cualquier paso hacia
    adelante (`ENVIADO→LISTO` true); nadie vuelve de `CERRADO`; `ARMADO→ANULADO` sólo el fotógrafo.
  - `estadoDelPedidoPara("EN_PRODUCCION", false) === "IN_PRODUCTION"`; `("LISTO", false) === "READY"`;
    `("LISTO", true) === "READY_TO_PICKUP"`; `("RECIBIDO", false) === "READY_TO_PICKUP"`;
    `("RECIBIDO", true) === null` (no lo pisa: el de retiro del cliente ya va por su lado);
    `("ENVIADO", x) === "CREATED"`.
  - `avisaAlCliente("READY","READY_TO_PICKUP") === true`; `("READY_TO_PICKUP","READY_TO_PICKUP") === false`;
    `("CREATED","READY") === false`.
  - `loteCerrado`: lote `LISTO` con un pedido del cliente sin entregar ⇒ false; todos entregados y el
    resto `RECIBIDO` ⇒ true; filas quitadas no cuentan.
  - `motivoParaNoEntrar`: `PENDING` ⇒ «El pedido todavía no está pagado.»; demo ⇒ «Es un pedido de
    prueba.»; voucher ⇒ «Es un canje: va por Pedidos escolares.»; `copiasSueltas 0` ⇒ «No tiene copias
    sueltas para imprimir.»; `enLoteVivo` ⇒ «Ya está en otro lote.»; caso válido ⇒ `null`.
- [ ] **Paso 2:** `pnpm --filter compramelafoto test:lotes-impresion` → FALLA (módulo inexistente).
- [ ] **Paso 3:** implementar `reglas.ts` (tabla de transiciones como constante).
- [ ] **Paso 4:** volver a correr → PASA. **Paso 5:** commit.

---

### Tarea 3: Código del QR del pedido y token del lote

**Archivos:** crear `lib/print-batches/codigos.ts` y `codigos.test.ts`; sumar el test al script.

**Interfaces — Produce:**
```ts
export function codigoDeEntregaDePedido(printOrderId: number, secreto: string): string; // "p<id>.<firma>"
export function leerCodigoDeEntregaDePedido(codigo: string, secreto: string): number | null;
export function nuevoTokenDeLote(): { token: string; hash: string }; // token base64url 32 bytes, hash sha256 hex
export function hashDeToken(token: string): string;
```
Mismo HMAC que `lib/school-fulfillment/codigo-de-canje.ts` pero con el texto `entrega-pedido:<id>` y la
letra `p`; secreto: `secretoDeEntrega()` de ese archivo.

- [ ] **Paso 1: pruebas que fallan:** ida y vuelta da el id; firma alterada ⇒ null; un código de canje
  `c123.xxx` válido ⇒ null (no se mezclan); `p0.x` y `p-1.x` ⇒ null; `hashDeToken(t)` igual al `hash` de
  `nuevoTokenDeLote()`; dos tokens seguidos distintos.
- [ ] **Pasos 2-5:** correr (falla), implementar, correr (pasa), commit.

---

### Tarea 4: Servicio de lotes (listar, armar, enviar, mover, reimprimir)

**Archivos:** crear `lib/print-batches/servicio.ts`, `lib/print-batches/correos.ts`.

**Interfaces — Consume:** Tareas 1-3; `createAlbumOrderPrintOrderMirror`
(`lib/orders/create-album-order-print-order-mirror.ts`), `copiasFueraDelDiseno` y `loadOrderDesigns`
(`lib/orders/print-export/…`), `esPedidoDemo` (`lib/canje-externo/pack-de-prueba`), `nombreDelProximoLote`
(`lib/design-v2/produccion-reglas.ts`), `fileExistsInR2` (`lib/r2-client.ts`), `queueEmail`
(`lib/email-queue.ts`).

**Interfaces — Produce:**
```ts
export type PedidoParaImprimir = { albumOrderId: number; printOrderId: number | null; cliente: string;
  album: string; copias: Array<{ medida: string; acabado: string; cantidad: number }>; totalCopias: number;
  retiraCliente: boolean; pickupLabContactId: number | null; pagadoAt: Date; motivo: string | null };
export async function listarParaImprimir(photographerId: number): Promise<PedidoParaImprimir[]>;
export async function armarLote(photographerId: number, albumOrderIds: number[], labContactId: number | null): Promise<{ batchId: number; nombre: string }>;
export async function deshacerLote(photographerId: number, batchId: number): Promise<void>;
export async function enviarLote(photographerId: number, batchId: number, opts: { labContactId: number; mensaje?: string; entregaPreferida: "RETIRA_FOTOGRAFO"|"ENVIA_LAB"; fechaPrometida?: Date }): Promise<void>;
export async function moverLote(batchId: number, hacia: EstadoLote, actor: { tipo: "FOTOGRAFO"; userId: number } | { tipo: "LABORATORIO"; tokenHash: string } | { tipo: "LABORATORIO_CUENTA"; userId: number; labId: number }): Promise<void>;
export async function quitarPedido(photographerId: number, entryId: number, motivo: "REIMPRIMIR" | "SACAR"): Promise<void>;
export async function marcarEntregado(printOrderId: number, quien: { userId?: number; nota: string }): Promise<void>;
export class LoteError extends Error {}
```
Reglas: `armarLote` usa `motivoParaNoEntrar`; un pedido con `pickupLabContactId` sólo entra si coincide
con `labContactId` del lote (si el lote todavía no tiene laboratorio, lo toma del primer pedido con
retiro); crea el espejo si falta; atrapa P2002 del índice y lanza `LoteError("Ese pedido ya está en el
<nombre>.")`. `enviarLote` revalida archivos (`fileExistsInR2` de cada original) y lanza
`LoteError("Al pedido #N le faltan fotos: el álbum venció o se borraron.")`; genera token, encola el
correo con `idempotencyKey: lote-enviado-<id>`, y sólo si el encolado responde `queued` pasa a `ENVIADO`
(todo en una transacción; el token en claro sólo viaja en el correo). `moverLote` valida con `puedeMover`,
escribe `PrintOrder.status` + `PrintOrderStatusHistory` (`notes: "Lote <nombre>"`) con
`estadoDelPedidoPara`, encola el correo al cliente cuando `avisaAlCliente`, y cierra con `loteCerrado`.

Textos de `correos.ts` (exactos):
- Al laboratorio — asunto `Lote <nombre> de <Fotógrafo> — <N> pedidos, <M> copias`; cuerpo con resumen
  por medida y acabado, mensaje del fotógrafo, botón «Abrir el lote» y, si no tiene cuenta, «Si querés ver
  todos tus lotes en un solo lugar, creá tu cuenta de laboratorio en CompraMeLaFoto.» con enlace a
  `/lab/registro?email=<correo>`.
- Al cliente, retira el fotógrafo — `Tus copias están listas` / «<Fotógrafo> ya tiene tus copias.
  Coordiná el retiro con él: <whatsapp o correo del fotógrafo>.»
- Al cliente, retira en el laboratorio — `Tus copias están listas para retirar` / «Tus copias de
  <Fotógrafo> están listas. Retiralas en <Laboratorio>, <dirección>, <horario>. Ya están pagas: decí que
  vas a buscar el pedido de <Fotógrafo> a nombre de <Cliente>.»

- [ ] **Paso 1:** implementar `correos.ts` con funciones puras que arman `{ subject, body, htmlBody }`,
  con pruebas en `correos.test.ts` que comprueban los textos anteriores (incluida la invitación sólo si
  `labTieneCuenta === false`); correr → pasa.
- [ ] **Paso 2:** implementar `servicio.ts`.
- [ ] **Paso 3:** prueba de humo contra una rama Neon hija de `production` con la migración aplicada
  (script en el scratchpad, no en el repo): `listarParaImprimir` de DNX devuelve pedidos pagados con
  copias sueltas y ninguno demo; `armarLote` dos veces con el mismo pedido ⇒ el segundo lanza
  `LoteError`. Borrar la rama.
- [ ] **Paso 4:** commit.

---

### Tarea 5: «Mis laboratorios»

**Archivos:** crear `lib/print-batches/contactos.ts` (+ test), `app/api/fotografo/laboratorios/route.ts`
(GET, POST), `app/api/fotografo/laboratorios/[id]/route.ts` (PATCH, DELETE = `activo false`),
`components/fotografo/impresiones/MisLaboratorios.tsx`.

**Interfaces — Produce:**
```ts
export type ContactoInput = { nombre: string; email: string; whatsapp?: string; puntoDeRetiro?: boolean; direccion?: string; horario?: string; esPredeterminado?: boolean };
export function validarContacto(i: ContactoInput, labVinculado: { address: string | null } | null): { ok: true; datos: ContactoInput } | { ok: false; error: string };
```
- `validarContacto`: nombre y correo obligatorios (correo normalizado a minúsculas); `puntoDeRetiro`
  exige dirección y horario salvo que el `Lab` vinculado tenga `address` («Para ser punto de retiro cargá
  la dirección y el horario.»).
- El POST busca `Lab` aprobado con ese correo y guarda `labId`; marcar predeterminado desmarca los demás.
- Autenticación: `requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER])`; todo filtrado por
  `photographerId = user.id`.

- [ ] **Paso 1:** pruebas de `validarContacto` (faltan datos, correo con mayúsculas, punto de retiro sin
  dirección con y sin lab vinculado) → falla; implementar → pasa.
- [ ] **Paso 2:** rutas y componente (lista + formulario; botón «Elegir del directorio» con los `Lab`
  aprobados).
- [ ] **Paso 3:** commit.

---

### Tarea 6: ZIP del lote por partes

**Archivos:** crear `lib/print-batches/zip-del-lote.ts` (+ test), `app/api/fotografo/impresiones/lotes/[id]/zip/route.ts`.

**Interfaces — Produce:**
```ts
export const PEDIDOS_POR_PARTE = 15;
export function partesDelLote(albumOrderIds: number[]): number[][]; // en orden, de a 15
export async function planesDeLaParte(batchId: number, parte: number): Promise<PrintExportPlan[]>;
export async function responderZipDeLaParte(batchId: number, parte: number, nombreArchivo: string): Promise<Response>;
```
`planesDeLaParte` carga los planes con la lógica de `loadAlbumOrderPrintPlan` **sin** el chequeo de
usuario: separar en `album-order-print-plan.ts` una función `cargarPlanDePedidoDeAlbum(orderId)` que hace
la carga, y dejar `loadAlbumOrderPrintPlan` como «permiso + cargarPlanDePedidoDeAlbum». No incluir los
diseños (sólo `copiasFueraDelDiseno`). `responderZipDeLaParte` arma con `organizarPorTamano(planes,
{ separarClientes: false })`, suma el remito (Tarea 8) y llama a `streamPrintExportZip`. La ruta lleva
`maxDuration = 300`. Nombre: `<Lote> - parte <k> de <n>.zip`.

- [ ] **Paso 1:** pruebas de `partesDelLote` (0 ⇒ `[]`, 15 ⇒ una parte, 16 ⇒ `[15, 1]`, orden respetado)
  → falla; implementar → pasa. Correr también `test:print-export` (no debe romperse).
- [ ] **Paso 2:** refactor de `album-order-print-plan.ts` + ruta del fotógrafo (dueño del lote).
- [ ] **Paso 3:** verificación manual local contra datos reales de lectura: un pedido de DNX con librito +
  copias sueltas ⇒ el ZIP trae sólo las sueltas. Commit.

---

### Tarea 7: Puerta del laboratorio sin cuenta

**Archivos:** crear `app/lab/lote/[token]/page.tsx`, `app/api/lab-lote/[token]/route.ts` (GET datos,
POST `{ hacia }`), `app/api/lab-lote/[token]/zip/route.ts` (`?parte=k`).

- La página busca por `hashDeToken(token)`; si no hay lote o está `ANULADO` ⇒ 404 genérico («Este enlace
  no es válido o el lote se anuló.»).
- Primera visita ⇒ `labAbrioAt`; primera descarga ⇒ `labDescargoAt`.
- Muestra: fotógrafo, nombre del lote, mensaje, fecha prometida, resumen por medida y acabado, pedidos (a
  nombre de «<Fotógrafo> + <Cliente>», marca «RETIRA EL CLIENTE · PAGADO, no cobrar» cuando corresponde;
  **sin** correo ni teléfono del cliente), botones de parte del ZIP y botones de estado según `puedeMover`
  con quien = LABORATORIO: «Lo empezamos», «Está listo», «Lo despachamos» (sólo `ENVIA_LAB`).
- Al abrir, deja la cookie `httpOnly` `lab_lote_<batchId>` = token por 30 días, `path=/`, `sameSite=lax`
  (la usa el QR, Tarea 9).
- `POST` llama a `moverLote` con `{ tipo: "LABORATORIO", tokenHash }`.

- [ ] **Paso 1:** implementar; **Paso 2:** probar en local con un lote de prueba: token inválido ⇒ 404;
  «Lo empezamos» cambia el estado; el panel viejo `/lab/pedidos` no muestra esos pedidos. **Paso 3:** commit.

---

### Tarea 8: Sobres, etiqueta del lote y remito

**Archivos:** crear `lib/print-batches/impresos.ts` (+ test), `app/api/fotografo/impresiones/lotes/[id]/{sobres,etiqueta,remito}/route.ts`.

**Interfaces — Produce:**
```ts
export type SobreDePedido = { fotografo: string; cliente: string; album: string; pedido: number; contenido: string; lote: string; retiraCliente: boolean; laboratorio?: string; qrUrl: string };
export function textoDeContenido(copias: Array<{ medida: string; acabado: string; cantidad: number }>): string; // "3× 13x18 brillo · 2× 10x15"
export async function pdfDeSobres(sobres: SobreDePedido[]): Promise<Uint8Array>;   // A4 3×8, geometriaDeEtiqueta
export async function pdfEtiquetaDeLote(l: { lote: string; fotografo: string; laboratorio: string; pedidos: number; copias: number; qrUrl: string; costoEstimado?: number }): Promise<Uint8Array>;
export async function pdfRemito(l: { lote: string; fotografo: string; laboratorio: string; filas: Array<{ pedido: number; nombre: string; contenido: string; retiraCliente: boolean }> }): Promise<Uint8Array>;
```
- Primera línea del sobre: `<Fotógrafo> + <Cliente>` (con el ajuste de letra de `etiquetas()`); si
  `retiraCliente`, línea «RETIRA EL CLIENTE · PAGADO, no cobrar» y el nombre del laboratorio.
- QR del sobre: `${baseAppUrl()}/pedido/entrega/${codigoDeEntregaDePedido(...)}`. QR del lote:
  `${baseAppUrl()}/fotografo/impresiones?lote=<id>`.
- El remito también entra al ZIP como `REMITO.pdf` en la carpeta `Control` (Tarea 6).

- [ ] **Paso 1:** pruebas: `textoDeContenido` (agrupa medida+acabado, acabado vacío se omite, orden por
  medida); `pdfDeSobres` con 25 sobres ⇒ 2 páginas; con `retiraCliente` el PDF contiene el texto «RETIRA EL
  CLIENTE» (leer con `pdf-lib` no extrae texto: probar la función que arma las líneas,
  `lineasDelSobre(s): string[]`, exportada para eso) → falla; implementar → pasa.
- [ ] **Paso 2:** rutas (dueño del lote, `Content-Type: application/pdf`). Commit.

---

### Tarea 9: QR del sobre

**Archivos:** crear `app/pedido/entrega/[codigo]/page.tsx`, `app/api/pedido/entrega/[codigo]/route.ts`
(POST `{ accion: "LISTO" | "ENTREGADO" | "RECIBIDO_POR_CLIENTE" }`).

- `leerCodigoDeEntregaDePedido` inválido ⇒ «Este código no es válido.»
- Quién puede qué:
  - Fotógrafo dueño con sesión: `LISTO` (⇒ `READY_TO_PICKUP` + correo) y `ENTREGADO`.
  - Laboratorio: si la cookie `lab_lote_<batchId>` del lote vivo de ese pedido coincide con su
    `tokenHash`, o si es la cuenta `LAB` del `labId` del lote: `ENTREGADO`, sólo para pedidos con
    `retiraCliente`. Pantalla: «Entregar a <Cliente>» + botón grande.
  - Sin sesión (el cliente): ve estado y, si retira en el laboratorio, dónde y en qué horario; botón
    «Confirmar que lo recibí» sólo si está `READY_TO_PICKUP`.
- `ENTREGADO` y `RECIBIDO_POR_CLIENTE` llaman a `marcarEntregado` (⇒ `DELIVERED`, `entregadoAt`, y
  `loteCerrado` puede cerrar el lote).

- [ ] **Paso 1:** implementar; **Paso 2:** probar en local los tres casos (fotógrafo, cookie de lab,
  anónimo) y un código adulterado. **Paso 3:** commit.

---

### Tarea 10: Elegir dónde retirar en la compra

**Archivos:** modificar `app/api/a/[id]/order-photos/route.ts` (~línea 564), `app/a/[id]/comprar/ComprarClient.tsx`
(~línea 2280), `app/api/a/[id]/orders/route.ts` (lectura del body ~línea 116 y `prisma.order.create` ~líneas 704/727).

- `order-photos` suma `puntosDeRetiro: Array<{ id, nombre, direccion, horario }>` cuando
  `album.pickupBy === "CLIENT"`: los `PhotographerLabContact` activos del dueño con `puntoDeRetiro`
  (dirección y horario del `Lab` vinculado si faltan). Si no hay ninguno, se mantiene el `pickupInfo` de hoy.
- `ComprarClient`: con más de uno, selector obligatorio «¿Dónde querés retirar tus copias?» en el bloque
  de retiro (sólo si hay ítems impresos); con uno, se muestra elegido. Manda `pickupLabContactId`.
- `orders/route.ts`: valida que el id esté entre los `puntosDeRetiro` del álbum (si no ⇒ 400 «Elegí dónde
  retirar tus copias.»); con uno solo y sin id, usa ese; guarda `Order.pickupLabContactId`.
- `PrintBatchEntry.retiraCliente` = `album.pickupBy === "CLIENT"`; `pickupLabContactId` = el del pedido o,
  si es nulo, el predeterminado del fotógrafo (esto vive en `armarLote`, Tarea 4).

- [ ] **Paso 1:** implementar; **Paso 2:** compra de prueba en local en un álbum de prueba con dos puntos
  de retiro: sin elegir ⇒ el botón de pagar pide elegir; eligiendo ⇒ la columna queda guardada. Un álbum
  con `pickupBy = PHOTOGRAPHER` no muestra el selector. **Paso 3:** commit.

---

### Tarea 11: Panel «Impresiones»

**Archivos:** crear `app/fotografo/impresiones/page.tsx`, `app/api/fotografo/impresiones/route.ts` (GET
panel), `app/api/fotografo/impresiones/lotes/route.ts` (POST armar),
`app/api/fotografo/impresiones/lotes/[id]/route.ts` (POST `{ accion: "ENVIAR" | "MOVER" | "DESHACER" | "PAGADO_AL_LAB", … }`),
`app/api/fotografo/impresiones/entradas/[id]/route.ts` (POST `{ motivo }`),
`components/fotografo/impresiones/{PanelImpresiones,ColumnaParaImprimir,TarjetaDeLote,DialogoEnviarLote}.tsx`;
modificar el menú del fotógrafo (entrada «Impresiones» junto a «Pedidos») y la ficha del pedido
(`components/fotografo/orders/OrderDetailDrawer.tsx`: estado de impresión y lote).

- Columnas: «Para imprimir» (agrupado por laboratorio de retiro cuando lo hay; casillas; pedidos con
  `motivo` se muestran grises con el motivo), «En el laboratorio» (lotes `ENVIADO…DESPACHADO`, con
  «abrió ✓ / descargó ✓»), «Listos para entregar», «Entregados» (últimos 30 días).
- Por lote: Etiquetas, Sobres, Remito, ZIP por partes, mover estado (el fotógrafo puede todo hacia
  adelante), «Pagado al laboratorio».
- `DialogoEnviarLote`: laboratorio (predeterminado elegido; deshabilitado si hay pedidos con retiro en
  otro), mensaje, entrega preferida, fecha prometida.
- Errores de `LoteError` se muestran tal cual.
- Seguir el estilo de `app/fotografo/pedidos` (`ds-*`, `OrdersWorkspaceHeader`).

- [ ] **Paso 1:** implementar; **Paso 2:** recorrido completo en local con el navegador integrado: armar,
  enviar (en local el correo va a la cola), abrir el enlace, «Lo empezamos», «Está listo», «Recibí el
  lote», escanear (abrir) el QR del sobre y entregar; capturas. **Paso 3:** commit.

---

### Tarea 12: Puesta en producción

- [ ] **Paso 1:** pedirle a Daniel permiso para aplicar la migración en la base de CLF; aplicarla con
  `run_sql_transaction` en `br-autumn-rain-ad18wq7y` y registrarla en `_prisma_migrations` con el checksum
  del archivo (ver memoria «Registrar con checksum»).
- [ ] **Paso 2:** PR en español con `superpowers:finishing-a-development-branch`; esperar CI verde
  (incluye `test:lotes-impresion`); fusionar a mano (el repo no tiene auto-merge).
- [ ] **Paso 3:** en producción, con la sesión de DNX: cargar Procolor como laboratorio, armar un lote de
  prueba con un pedido real chico, abrir el enlace desde otro navegador y verificar estados y el QR.
- [ ] **Paso 4:** actualizar la memoria `project-clf-panel-impresiones-lotes-laboratorio`.
