# MercadoFotoRaw — Etapa 1b, parte 2: ventas, calificaciones, favoritos, alertas, «Busco» y bloqueo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una venta se cierre dentro del portal (el vendedor elige al comprador, el comprador confirma y el equipo pasa a su inventario con su historial), que las partes se califiquen, que los compradores guarden favoritos, creen alertas de búsqueda y pedidos «Busco», y que el administrador pueda atender reportes de usuarios y bloquear cuentas.

**Architecture:** Igual que la 1b-1: lógica de dominio en `apps/equipos/lib/**` con pruebas Vitest que simulan `@repo/db` con `vi.mock`, pantallas finas en `app/**` con server actions y los mapas de avisos de `lib/avisos.ts` (códigos, nunca texto por la URL). Un solo cron diario nuevo (`/api/cron/mercado-diario`) corre tres trabajos independientes: vencer ventas sin confirmar, mandar alertas de búsqueda y cruzar pedidos «Busco». El bloqueo es del portal (tabla propia), no el `User.isBlocked` de CLF.

**Tech Stack:** Next 16.2.1, React 19.2.4, Prisma (`@repo/db`), `@repo/auth-guards` (`isSuperAdmin`), Resend vía `lib/correo.ts`, Vitest. Sin dependencias npm nuevas.

**Spec:** `docs/superpowers/specs/2026-11-25-portal-equipos-usados-verificados-design.md` (§6 favoritos y alertas, §8, §12, §13, §14, §16). Sigue a `docs/superpowers/plans/2026-11-27-portal-equipos-etapa-1b1-publicaciones.md`.

## Global Constraints

- Rama nueva `portal-equipos-etapa-1b2` creada desde `portal-equipos-etapa-1b1` en el worktree `portal-equipos-etapa-1a`. Nunca `git add -A`; nunca commitear `apps/equipos/next-env.d.ts` ni `.env.local`.
- Base compartida con CLF producción. **Cambios de esquema sólo aditivos**: tablas nuevas, enums nuevos, columnas nuevas con valor por defecto en tablas del portal (`GearOwnerSettings`), relaciones inversas nuevas. **No** se agregan valores a enums existentes: el traspaso deja `GearItemEvent` `STATUS_CHANGED` con `detail: { accion: "traspaso", saleId }`.
- Migración `packages/db/prisma/migrations/20270310090000_portal_equipos_etapa_1b2/migration.sql`, idempotente (`IF NOT EXISTS`, `DO $$` para claves foráneas y enums), aplicada sólo en la rama Neon de prueba `br-frosty-wildflower-advymj8r` (proyecto `divine-hall-10689679`). A producción **sólo con el OK de Daniel**.
- Niveles: favoritos y alertas exigen `requireLevel("registrado")`; marcar venta, confirmar compra, calificar, reportar usuario y crear pedidos «Busco» exigen `requireLevel("identidad")`; responder un aviso de pedido exige `registrado` y ser el dueño del equipo.
- Privacidad: el comprador de un pedido «Busco» **nunca** sabe quién tiene el equipo ni cuántos dueños hay; la ficha pública muestra del vendedor sólo nombre de pila, «Identidad verificada» y su calificación (promedio con un decimal y cantidad). Los comentarios de una calificación los ven sólo la persona calificada y el administrador.
- Avisos sólo por correo, con plantillas nuevas en `lib/correo.ts`; asuntos de correos al admin sin datos personales. Montos en pesos enteros; fechas en hora argentina (`lib/inventario/formato.ts`). Textos en español; decir «dinero», nunca «plata».
- Topes contados en la base: 5 pedidos «Busco» activos por comprador; pedido vence a los 30 días; 2 avisos de pedido por dueño cada 7 días; 10 alertas activas por usuario; 5 pedidos cancelados en 30 días sin compra → no puede crear pedidos por 30 días; venta pendiente vence a los 7 días.
- Cada cambio de estado de venta, pedido o publicación usa `updateMany` condicional al estado esperado (como en la 1b-1) para que dos clics simultáneos no pisen nada.

## Decisiones tomadas sin consultar (Daniel puede corregirlas)

- **Bloqueo propio del portal** (`PortalAccountBlock`): bloquear en MercadoFotoRaw no saca a la persona de CLF. Una cuenta bloqueada no publica, no contacta, no crea pedidos ni alertas; sus publicaciones dejan de verse en el catálogo y en el inicio (no cambian de estado, así desbloquear las devuelve). Costo si es incorrecto: bloquear también en CLF a mano.
- **«Busco» sólo con dueños del portal**: no se avisa a fotógrafos de CLF que no cargaron su inventario (decisión pendiente de Daniel, §16). Cada dueño puede apagar los avisos en «Mi cuenta» (`GearOwnerSettings.purchaseRequestOptOut`). Los avisos que superan el tope semanal esperan a la semana siguiente (no hay resumen agrupado todavía). No salen en redes (eso es la 1b-3).
- **«Me interesa vender»** registra la respuesta y lleva al formulario de publicar ese equipo; cuando la publicación queda `PUBLISHED`, el comprador recibe el correo `pedido_publicado` con el enlace. Hasta entonces el comprador no sabe nada.
- **Traspaso**: el equipo cambia de `ownerId`, queda `IN_USE`, conserva fotos, factura e historial; se borran `notes`, `declaredValueArs`, `declaredValueUsd` y `sightingId` (son del vendedor).
- **Calificación**: 1 a 5 estrellas y comentario opcional de hasta 300 caracteres, dentro de los 30 días de confirmada la venta; no se edita.
- **Estadísticas del admin**: identidades aprobadas, teléfonos verificados, publicaciones por estado, ventas confirmadas, contactos de 30 días, favoritos, alertas activas, pedidos activos, cuentas bloqueadas.

## Review Focus

1. **Vender a quien no consultó o dos veces**: `markSold` con un comprador que no está en `GearListingContact` de esa publicación → error; dos `markSold` simultáneos → una sola venta (`listingId` único). Confirmar una venta vencida, rechazada o ajena → error. → Task 2.
2. **Traspaso a medias**: la confirmación cambia dueño, estado del equipo, venta y evento en una sola transacción; si la venta ya no está `PENDING_BUYER` no toca el equipo. → Task 2.
3. **Fuga de dueños en «Busco»**: nada de lo que devuelve al comprador (`createPurchaseRequest`, `listMyRequests`) dice cuántos avisos se mandaron; el cron nunca avisa por equipos `STOLEN`/`LOST`/`SOLD`/`FOR_SALE`, del propio comprador, de dueños bloqueados o con avisos apagados; corre dos veces y no repite avisos. → Task 6.
4. **Cuenta bloqueada**: no puede contactar, publicar ni crear pedidos (aunque haga POST directo a la server action); sus publicaciones no salen en `searchListings` ni en `getPublicListing`. → Task 8.
5. **Alertas repetidas o propias**: el cron corre dos veces y manda un solo correo por coincidencia; nunca avisa por publicaciones propias ni de vendedores bloqueados. → Task 5.

---

### Task 1: Esquema y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelos nuevos después de `GearSerialLookup`; relaciones inversas en `User`, `GearItem`, `GearListing`; columna en `GearOwnerSettings`)
- Create: `packages/db/prisma/migrations/20270310090000_portal_equipos_etapa_1b2/migration.sql`

**Interfaces:**
- Produces (Prisma):
  - `enum GearSaleStatus { PENDING_BUYER CONFIRMED DECLINED EXPIRED }`
  - `model GearSale { id, listingId Int @unique, gearItemId Int, sellerId Int, buyerId Int, status GearSaleStatus @default(PENDING_BUYER), priceArs Int, createdAt @default(now()), expiresAt DateTime, resolvedAt DateTime? }`; índices `[buyerId, status]`, `[sellerId]`, `[status, expiresAt]`.
  - `model GearSaleRating { id, saleId Int, raterId Int, ratedId Int, score Int, comment String?, createdAt @default(now()) }`; `@@unique([saleId, raterId])`, `@@index([ratedId])`.
  - `model GearListingFavorite { id, userId Int, listingId Int, createdAt @default(now()) }`; `@@unique([userId, listingId])`, `@@index([listingId])`.
  - `model GearSearchAlert { id, userId Int, kind GearItemKind?, make String?, mount String?, maxPriceArs Int?, province String?, active Boolean @default(true), createdAt @default(now()) }`; `@@index([userId, active])`.
  - `model GearSearchAlertHit { id, alertId Int, listingId Int, sentAt @default(now()) }`; `@@unique([alertId, listingId])`.
  - `enum PurchaseRequestStatus { ACTIVE FULFILLED CANCELLED EXPIRED }`
  - `model PurchaseRequest { id, buyerId Int, kind GearItemKind, make String, model String, modelKey String, maxPriceArs Int?, minCondition GearListingCondition?, province String?, status PurchaseRequestStatus @default(ACTIVE), expiresAt DateTime, createdAt @default(now()), cancelledAt DateTime? }`; índices `[buyerId, status]`, `[status, modelKey]`.
  - `enum PurchaseRequestResponse { INTERESTED DECLINED }`
  - `model PurchaseRequestNotice { id, requestId Int, ownerId Int, gearItemId Int, sentAt @default(now()), response PurchaseRequestResponse?, respondedAt DateTime?, listingId Int? }`; `@@unique([requestId, ownerId])`, `@@index([ownerId, sentAt])`, `@@index([gearItemId])`.
  - `model PortalUserReport { id, reporterId Int, reportedId Int, reason String, context String?, createdAt @default(now()), resolvedAt DateTime?, resolution String? }`; `@@unique([reporterId, reportedId])`, `@@index([resolvedAt])`.
  - `model PortalAccountBlock { id, userId Int @unique, reason String, blockedById Int, createdAt @default(now()), liftedAt DateTime? }`.
  - `GearOwnerSettings.purchaseRequestOptOut Boolean @default(false)`.
  - Claves foráneas: a `User` (`sellerId`, `buyerId`, `raterId`, `ratedId`, `userId`, `reporterId`, `reportedId`, `ownerId`) con `onDelete: Cascade` salvo `PortalAccountBlock.blockedById` (sin clave foránea, sólo dato); `GearSale.listingId` → `GearListing` `Cascade`; `GearSale.gearItemId` y `PurchaseRequestNotice.gearItemId` → `GearItem` `Cascade`; `GearSaleRating.saleId` → `GearSale` `Cascade`; `GearListingFavorite.listingId` → `GearListing` `Cascade`; `GearSearchAlertHit.alertId` → `GearSearchAlert` `Cascade` y `listingId` → `GearListing` `Cascade`; `PurchaseRequestNotice.requestId` → `PurchaseRequest` `Cascade`; `PurchaseRequestNotice.listingId` sin clave foránea.

- [ ] **Step 1:** Escribir los modelos y la migración SQL a mano (mismo estilo que `20270309090000_portal_equipos_etapa_1b1`).
- [ ] **Step 2:** `pnpm --filter @repo/db exec prisma validate` y `pnpm --filter @repo/db exec prisma generate` → Expected: sin errores.
- [ ] **Step 3:** Aplicar en la rama de prueba con `prisma db execute --file <migration.sql>` usando el `DATABASE_URL` de la rama (sin imprimirlo), y ejecutar el SQL **dos veces** → Expected: la segunda vez no falla. Registrar con `prisma migrate resolve --applied 20270310090000_portal_equipos_etapa_1b2`.
- [ ] **Step 4:** Commit `MercadoFotoRaw 1b-2: esquema de ventas, calificaciones, favoritos, alertas, pedidos y bloqueos`.

### Task 2: Cierre de venta y traspaso

**Files:**
- Create: `apps/equipos/lib/ventas/ventas.ts`, `apps/equipos/lib/ventas/ventas.test.ts`
- Modify: `apps/equipos/lib/correo.ts` (plantillas), `apps/equipos/lib/publicaciones/publicar.ts` (una publicación `SOLD` no se reabre ni edita)

**Interfaces:**
- Consumes: `GearListingContact` (1b-1), `EquipoError` de `lib/inventario/equipos.ts`, `sendPortalEmail`.
- Produces:
  - `const SALE_DAYS = 7`
  - `type VentaErrorCode = "NO_ENCONTRADA" | "NO_CONSULTO" | "YA_VENDIDA" | "NO_PENDIENTE" | "VENCIDA"`; `class VentaError extends Error { code }`.
  - `async markSold(sellerId: number, listingId: number, buyerId: number, priceArs: number): Promise<{ saleId: number }>` — la publicación debe ser del vendedor y estar `PUBLISHED` o `PAUSED` (si no, `NO_ENCONTRADA`/`YA_VENDIDA`); `buyerId` debe tener `GearListingContact` en esa publicación (`NO_CONSULTO`); precio entero > 0. Transacción: `updateMany` publicación → `SOLD` con `closedAt` condicionado al estado leído (0 filas → `YA_VENDIDA`), crea `GearSale` con `expiresAt = ahora + 7 días`, evento `STATUS_CHANGED` `{ listingId, accion: "vendido_pendiente", saleId }`. Después: correo `confirmar_compra` al comprador (nombre de pila del vendedor, modelo, precio, enlace `/compras/<saleId>`).
  - `async confirmPurchase(buyerId: number, saleId: number): Promise<void>` — venta del comprador (`NO_ENCONTRADA`), `PENDING_BUYER` (`NO_PENDIENTE`), no vencida (`VENCIDA`). Transacción: `updateMany` venta → `CONFIRMED` + `resolvedAt` condicionada a `PENDING_BUYER` (0 filas → `NO_PENDIENTE`); `GearItem` → `ownerId: buyerId, status: "IN_USE", notes: null, declaredValueArs: null, declaredValueUsd: null, sightingId: null`; evento `STATUS_CHANGED` `{ accion: "traspaso", saleId }`. Después: correo `venta_confirmada` a ambos.
  - `async declinePurchase(buyerId: number, saleId: number): Promise<void>` — `PENDING_BUYER` → `DECLINED`; la publicación queda `SOLD`→`CLOSED`, el equipo vuelve a `IN_USE` con el vendedor; evento `{ accion: "venta_no_confirmada", saleId }`; correo `venta_no_confirmada` al vendedor.
  - `async expirePendingSales(now?: Date): Promise<{ expired: number }>` — `PENDING_BUYER` con `expiresAt < now` → `EXPIRED`, mismo efecto que `declinePurchase` (incluido el correo al vendedor). Correr dos veces no repite correos.
  - `async listMyPurchases(buyerId)` y `async listMySales(sellerId)`: ventas con modelo, precio, estado, fechas y el nombre de pila de la otra parte.
  - `async getSaleForParty(userId: number, saleId: number)`: la venta si `userId` es comprador o vendedor; si no, `null`.
  - Plantillas: `confirmar_compra`, `venta_confirmada`, `venta_no_confirmada`.

- [ ] **Step 1: Pruebas que fallan**, entre ellas: `markSold` a quien no consultó → `NO_CONSULTO`; segundo `markSold` cuando `updateMany` devuelve 0 → `YA_VENDIDA` y ningún correo; `confirmPurchase` cambia `ownerId` y borra `notes` en la misma transacción; confirmar una venta `DECLINED` → `NO_PENDIENTE` sin tocar el equipo; confirmar con `expiresAt` pasado → `VENCIDA`; tercero que confirma → `NO_ENCONTRADA`; `expirePendingSales` dos veces → un correo.
- [ ] **Step 2:** `pnpm --filter equipos test lib/ventas` → Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mismo comando y `pnpm --filter equipos test` → Expected: PASS.
- [ ] **Step 5:** Commit `MercadoFotoRaw 1b-2: cierre de venta y traspaso del equipo al comprador`.

### Task 3: Calificaciones

**Files:**
- Create: `apps/equipos/lib/ventas/calificaciones.ts`, `apps/equipos/lib/ventas/calificaciones.test.ts`
- Modify: `apps/equipos/lib/catalogo/buscar.ts` (`PublicListing.sellerRating`), `apps/equipos/lib/contacto/avisos.ts` (el correo `nueva_consulta` lleva la calificación del interesado)

**Interfaces:**
- Consumes: `GearSale` (Task 1), `getSaleForParty` (Task 2).
- Produces:
  - `const RATING_WINDOW_DAYS = 30`
  - `type UserRating = { average: number | null; count: number }`; `async getUserRating(userId: number): Promise<UserRating>` (promedio redondeado a un decimal).
  - `async getUserRatings(userIds: number[]): Promise<Map<number, UserRating>>` (una consulta `groupBy` para el catálogo).
  - `async rateSale(raterId: number, saleId: number, score: number, comment?: string): Promise<void>` — sólo partes de una venta `CONFIRMED` y dentro de 30 días de `resolvedAt`; `score` entero 1..5; comentario recortado, hasta 300; `ratedId` = la otra parte. Errores `VentaError("NO_ENCONTRADA" | "NO_PENDIENTE")` o `EquipoError("DATO_INVALIDO", …)`; segunda calificación → `EquipoError("DATO_INVALIDO", "Ya calificaste esta operación.")` (choque de `@@unique` capturado).
  - `async listRatingsAbout(userId: number)`: calificaciones recibidas con comentario (para «Mi cuenta» y el admin).
  - `formatRating(r: UserRating): string` — `"4,5 ★ (12 calificaciones)"`, `"5 ★ (1 calificación)"`, `"Sin calificaciones todavía"`.
  - `PublicListing.sellerRating: UserRating`.

- [ ] **Step 1: Pruebas que fallan**: tercero califica → error; venta `PENDING_BUYER` → error; día 31 → error; 0 y 6 estrellas → `DATO_INVALIDO`; doble calificación → «Ya calificaste esta operación.»; `formatRating` con los tres textos; `searchListings` trae `sellerRating` sin consultar por cada publicación.
- [ ] **Step 2:** `pnpm --filter equipos test lib/ventas lib/catalogo lib/contacto` → Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mismo comando → Expected: PASS.
- [ ] **Step 5:** Commit `MercadoFotoRaw 1b-2: calificaciones entre comprador y vendedor`.

### Task 4: Pantallas de venta, compra y calificación

**Files:**
- Create: `apps/equipos/app/mis-publicaciones/[id]/vender/page.tsx`, `apps/equipos/app/compras/page.tsx`, `apps/equipos/app/compras/[id]/page.tsx`, `apps/equipos/app/compras/actions.ts`, `apps/equipos/app/ventas/[id]/page.tsx`, `apps/equipos/app/cuenta/page.tsx`, `apps/equipos/app/_ui/Estrellas.tsx`
- Modify: `apps/equipos/app/mis-publicaciones/[id]/page.tsx` (botón «Marcar como vendido»), `apps/equipos/app/mis-publicaciones/actions.ts`, `apps/equipos/app/equipos/[id]/page.tsx` (calificación del vendedor), `apps/equipos/app/_ui/Encabezado.tsx` (el nombre lleva a `/cuenta`), `apps/equipos/app/_ui/index.ts`, `apps/equipos/lib/avisos.ts` (códigos nuevos), `apps/equipos/app/globals.css`

**Interfaces:**
- Consumes: Tasks 2 y 3; `listInterested` (1b-1); piezas de `app/_ui`.
- Produces: rutas `/mis-publicaciones/[id]/vender`, `/compras`, `/compras/[id]`, `/ventas/[id]`, `/cuenta`. `<Estrellas valor={UserRating} />` (texto de `formatRating`, estrellas con `aria-hidden` y el texto accesible).

- [ ] **Step 1:** «Vender» muestra los interesados de esa publicación (nombre verificado y calificación) como opciones de radio, el precio final y la aclaración «El comprador tiene 7 días para confirmar. Si no confirma, la publicación se cierra y el equipo sigue siendo tuyo.» Sin interesados: «Todavía nadie consultó por esta publicación. Sólo podés marcarla como vendida a alguien que te haya escrito desde el portal.»
- [ ] **Step 2:** `/compras/[id]` para el comprador: datos de la compra, «Confirmar que lo compré» y «No lo compré» (con confirmación); una vez confirmada, el formulario de calificación (estrellas 1–5 y comentario). `/ventas/[id]` para el vendedor: estado y, confirmada, su formulario de calificación. `/compras` lista compras y ventas.
- [ ] **Step 3:** `/cuenta`: enlaces a Mi verificación, Mis compras y ventas, Favoritos, Alertas, Mis pedidos «Busco», las calificaciones recibidas con comentarios, y la casilla «Avisarme cuando alguien busque un equipo como los míos» (`purchaseRequestOptOut`, Task 6).
- [ ] **Step 4:** Errores y avisos con códigos en `AVISOS_OK`/`AVISOS_ERROR` (nunca texto por la URL). Comprobar en `localhost:3020`: vender un lente del usuario 1306 a un segundo usuario verificado, confirmar, calificar; el equipo aparece en «Mi equipo» del comprador con su historial.
- [ ] **Step 5:** `pnpm --filter equipos test` y `tsc` (`NODE_OPTIONS=--max-old-space-size=12288`) → Expected: verde. Commit `MercadoFotoRaw 1b-2: pantallas para vender, confirmar la compra y calificar`.

### Task 5: Favoritos y alertas de búsqueda

**Files:**
- Create: `apps/equipos/lib/catalogo/favoritos.ts`, `apps/equipos/lib/catalogo/alertas.ts` (+ `.test.ts` de cada uno), `apps/equipos/app/favoritos/page.tsx`, `apps/equipos/app/alertas/page.tsx`, `apps/equipos/app/alertas/actions.ts`, `apps/equipos/app/equipos/[id]/favorito/actions.ts`, `apps/equipos/app/api/cron/mercado-diario/route.ts`
- Modify: `apps/equipos/app/equipos/page.tsx` (botón «Avisarme cuando aparezca» con los filtros actuales), `apps/equipos/app/equipos/[id]/page.tsx` (botón favorito), `apps/equipos/app/mis-publicaciones/[id]/page.tsx` (cantidad de favoritos), `apps/equipos/lib/correo.ts` (plantilla `alerta_busqueda`), `apps/equipos/vercel.json`

**Interfaces:**
- Consumes: `CatalogFilters`, `parseCatalogFilters` (1b-1).
- Produces:
  - `async toggleFavorite(userId, listingId): Promise<{ favorite: boolean }>` (sólo publicaciones `PUBLISHED`; la propia → `EquipoError("DATO_INVALIDO", "No podés guardar tu propia publicación.")`), `async listFavorites(userId): Promise<PublicListing[]>` (sólo las que siguen `PUBLISHED`), `async isFavorite(userId, listingId)`, `async countFavorites(listingId)`.
  - `const MAX_ALERTS = 10`; `async createAlert(userId, f: Omit<CatalogFilters, "page" | "minPrice">): Promise<{ alertId }>` (al menos un filtro; tope → `DATO_INVALIDO` «Llegaste al máximo de 10 alertas activas.»), `async deleteAlert(userId, alertId)`, `async listAlerts(userId)`, `describeAlert(a): string` (ej. «Lentes Sony, montura E, hasta $900.000, en Córdoba»).
  - `async runSearchAlerts(now?: Date): Promise<{ emails: number }>` — por alerta activa, publicaciones `PUBLISHED` desde `alert.createdAt` que cumplen los filtros, sin hit previo, que no sean del dueño de la alerta ni de vendedores bloqueados (Task 8: si `PortalAccountBlock` aún no existe en el código, filtrar con la consulta directa a la tabla); crea los `GearSearchAlertHit` y manda **un** correo por usuario con hasta 10 publicaciones.
  - Ruta `GET /api/cron/mercado-diario`: misma autenticación que `api/cron/cruce-inventario`; corre `expirePendingSales`, `runSearchAlerts` y (Task 6) `runPurchaseRequests`, cada uno en su `try/catch` (si falla uno, los otros corren) y devuelve los conteos. `vercel.json`: `{ "path": "/api/cron/mercado-diario", "schedule": "30 13 * * *" }`.

- [ ] **Step 1: Pruebas que fallan**: favorito propio → error; doble toggle vuelve a `false`; alerta sin filtros → error; alerta 11 → error; `runSearchAlerts` dos veces → un correo; publicación propia y de vendedor bloqueado no cuentan; publicación con precio sobre `maxPriceArs` no cuenta.
- [ ] **Step 2:** `pnpm --filter equipos test lib/catalogo` → Expected: FAIL.
- [ ] **Step 3:** Implementar lib, ruta del cron y pantallas (`/favoritos` reusa la tarjeta del catálogo; `/alertas` lista con «Borrar»; sin sesión el botón lleva a `/login?returnTo=…`).
- [ ] **Step 4:** Tests y `tsc` → Expected: verde.
- [ ] **Step 5:** Commit `MercadoFotoRaw 1b-2: favoritos y alertas de búsqueda`.

### Task 6: «Busco»: pedidos de compra (lógica y cron)

**Files:**
- Create: `apps/equipos/lib/busco/modelo.ts`, `apps/equipos/lib/busco/pedidos.ts`, `apps/equipos/lib/busco/cruce.ts` (+ `.test.ts` de cada uno)
- Modify: `apps/equipos/lib/correo.ts` (plantillas `pedido_dueno`, `pedido_publicado`), `apps/equipos/lib/publicaciones/publicar.ts` y `moderacion.ts` (al quedar `PUBLISHED`, llamar a `notifyRequestBuyers(listingId)`), `apps/equipos/app/api/cron/mercado-diario/route.ts`

**Interfaces:**
- Produces:
  - `modelKey(make: string, model: string): string` — minúsculas, sin acentos, sin espacios, guiones, puntos ni barras; saca la marca repetida al principio del modelo; alias de marca `{ "nikon corporation": "nikon", "canon inc.": "canon", "sony corporation": "sony", "fujifilm corporation": "fujifilm", "olympus imaging corp.": "olympus", "om digital solutions": "olympus" }`. Ej.: `modelKey("Sony", "FE 20mm F1.8 G") === modelKey("SONY", "Sony FE 20mm f/1.8 G") === "sony:fe20mmf18g"`.
  - `async knownModels(kind?: GearItemKind): Promise<{ make: string; model: string }[]>` — distintos de `GearItem` y `GearSerialSighting`, hasta 500, para un `<datalist>`.
  - `const MAX_ACTIVE_REQUESTS = 5`, `REQUEST_DAYS = 30`, `NOTICES_PER_WEEK = 2`, `CANCEL_LIMIT = 5`.
  - `async createPurchaseRequest(buyerId, input: { kind; make; model; maxPriceArs?: number; minCondition?: GearListingCondition; province?: string }): Promise<{ requestId: number; matches: PublicListing[] }>` — valida, aplica topes (5 activos; 5 cancelados en 30 días → `DATO_INVALIDO` «Cancelaste muchos pedidos en poco tiempo. Vas a poder crear otro en unos días.»); `matches` = publicaciones `PUBLISHED` con el mismo `modelKey` (no del comprador). Nunca devuelve nada sobre inventarios.
  - `async renewRequest(buyerId, requestId)` (+30 días desde hoy, sólo `ACTIVE` o `EXPIRED`), `async cancelRequest(buyerId, requestId)`, `async listMyRequests(buyerId)` (sin conteos de avisos).
  - `async runPurchaseRequests(now?: Date): Promise<{ notices: number; expired: number }>` — vence pedidos; por pedido `ACTIVE`: si hay publicación `PUBLISHED` de ese `modelKey`, no avisa a nadie; si no, busca `GearItem` con ese `modelKey` en estado `IN_USE` o `RECOVERED`, dueño ≠ comprador, dueño sin bloqueo activo, sin `purchaseRequestOptOut`, sin aviso previo para ese pedido y con menos de 2 avisos en los últimos 7 días; crea `PurchaseRequestNotice` (el `@@unique` corta la repetición) y manda `pedido_dueno` con enlace a `/busco/avisos/<noticeId>`. El correo dice modelo, precio máximo si hay, zona si hay, y nunca el nombre del comprador.
  - `async respondNotice(ownerId, noticeId, response: "INTERESTED" | "DECLINED"): Promise<{ gearItemId: number }>` — sólo el dueño; sólo una vez.
  - `async notifyRequestBuyers(listingId): Promise<void>` — si la publicación es de un equipo con aviso `INTERESTED` de un pedido `ACTIVE`, guarda `listingId` en el aviso, pasa el pedido a `FULFILLED` y manda `pedido_publicado` al comprador con el enlace a la ficha. Nunca tira error.

- [ ] **Step 1: Pruebas que fallan**: equivalencias y diferencias de `modelKey`; sexto pedido activo → error; quinto cancelado → error; cron dos veces → mismos avisos; equipos `STOLEN`/`FOR_SALE`/propios/dueño bloqueado/opt-out → sin aviso; dueño con 2 avisos en 7 días → espera; con publicación existente → cero avisos; `createPurchaseRequest` no trae campos de dueños; `respondNotice` de otro → `NO_ENCONTRADO`.
- [ ] **Step 2:** `pnpm --filter equipos test lib/busco` → Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pnpm --filter equipos test` → Expected: PASS.
- [ ] **Step 5:** Commit `MercadoFotoRaw 1b-2: pedidos «Busco» y aviso privado a dueños`.

### Task 7: «Busco»: pantallas

**Files:**
- Create: `apps/equipos/app/busco/page.tsx` (qué es y mis pedidos), `apps/equipos/app/busco/nuevo/page.tsx`, `apps/equipos/app/busco/actions.ts`, `apps/equipos/app/busco/avisos/[id]/page.tsx`
- Modify: `apps/equipos/app/_ui/Encabezado.tsx` (enlace «Busco» después de «Ver equipos»), `apps/equipos/app/page.tsx` (cuarto camino «Pedí lo que buscás» con foto existente), `apps/equipos/app/mi-equipo/[id]/publicar/page.tsx` (acepta `?pedido=<noticeId>` y muestra «Un comprador verificado busca este equipo»), `apps/equipos/lib/avisos.ts`

- [ ] **Step 1:** `/busco`: explicación corta («Contanos qué equipo buscás. Si alguien lo tiene en su inventario, le avisamos sin decirle quién sos ni decirte quién es») y la lista de pedidos con vencimiento, «Renovar» y «Cancelar».
- [ ] **Step 2:** `/busco/nuevo`: tipo, marca y modelo con `<datalist>` de `knownModels`, precio máximo, estado mínimo, provincia. Al crear, si hay `matches` los muestra («Ya hay equipos publicados como el que buscás») además de guardar el pedido.
- [ ] **Step 3:** `/busco/avisos/[id]`: para el dueño, el pedido (modelo, precio, zona, nombre verificado y calificación del comprador recién acá), «Me interesa vender» → `respondNotice` y redirige a `/mi-equipo/<gearItemId>/publicar?pedido=<id>`; «No, gracias».
- [ ] **Step 4:** Tests, `tsc` y prueba en `localhost:3020`: un comprador pide un modelo que tiene el usuario 1306; correr el cron a mano; el dueño recibe el aviso, responde, publica y el comprador recibe `pedido_publicado`.
- [ ] **Step 5:** Commit `MercadoFotoRaw 1b-2: pantallas de «Busco»`.

### Task 8: Reportar usuario, bloqueo de cuentas y panel del administrador

**Files:**
- Create: `apps/equipos/lib/usuarios/reportes.ts`, `apps/equipos/lib/usuarios/bloqueo.ts`, `apps/equipos/lib/admin/estadisticas.ts` (+ `.test.ts`), `apps/equipos/app/admin/page.tsx`, `apps/equipos/app/admin/usuarios/page.tsx`, `apps/equipos/app/api/admin/usuarios/[id]/route.ts` (+ `route.test.ts`), `apps/equipos/app/reportar-usuario/actions.ts`, `apps/equipos/app/cuenta/bloqueada/page.tsx`
- Modify: `apps/equipos/lib/guards.ts` (`requireLevel` redirige a `/cuenta/bloqueada` con bloqueo activo), `apps/equipos/lib/catalogo/buscar.ts` (excluir vendedores bloqueados), `apps/equipos/lib/contacto/contactar.ts`, `apps/equipos/lib/publicaciones/publicar.ts` (chequeo en vivo además del guard), `apps/equipos/app/mis-publicaciones/[id]/page.tsx` y `apps/equipos/app/ventas/[id]/page.tsx` y `apps/equipos/app/compras/[id]/page.tsx` (enlace «Reportar a esta persona»), `apps/equipos/lib/correo.ts` (`reporte_usuario_admin`, `cuenta_bloqueada`)

**Interfaces:**
- Produces:
  - `async isBlocked(userId: number): Promise<boolean>` (bloqueo con `liftedAt` nulo), `async blockAccount(adminId, userId, reason)` (motivo 10–500; correo `cuenta_bloqueada` sin el motivo interno: «Tu cuenta de MercadoFotoRaw fue suspendida. Si creés que es un error, respondé este correo.»), `async unblockAccount(adminId, userId)`.
  - `async reportUser(reporterId, reportedId, reason, context?: string)`: sólo si tuvieron contacto o venta entre ellos; no a uno mismo; motivo 10–500; repetido no duplica ni reavisa; avisa al admin.
  - `async resolveUserReport(adminId, reportId, resolution: string)`.
  - `async portalStats(): Promise<Record<"identidadesAprobadas" | "telefonosVerificados" | "publicadas" | "enRevision" | "pausadas" | "vendidas" | "ventasConfirmadas" | "contactos30d" | "favoritos" | "alertasActivas" | "pedidosActivos" | "cuentasBloqueadas", number>>`.
  - `getPortalUser()` suma `blocked: boolean`.
  - `POST /api/admin/usuarios/[id]` con `{ accion: "bloquear", motivo } | { accion: "desbloquear" } | { accion: "resolver", reportId, resolucion }`; 403 si no `isSuperAdmin`.
  - `/admin`: tablero con `portalStats` y enlaces a verificaciones, publicaciones y usuarios. `/admin/usuarios`: reportes sin resolver (quién reporta, a quién, motivo, contexto), cuentas bloqueadas, buscar por correo para bloquear.

- [ ] **Step 1: Pruebas que fallan**: bloqueado → `contactSeller` y `createListing` y `createPurchaseRequest` rechazan aunque se llamen directo; `searchListings`/`getPublicListing` no devuelven sus publicaciones; desbloquear las devuelve; reportar sin contacto previo → error; ruta sin super admin → 403.
- [ ] **Step 2:** `pnpm --filter equipos test lib/usuarios lib/admin app/api/admin` → Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Todos los tests y `tsc` → Expected: verde.
- [ ] **Step 5:** Commit `MercadoFotoRaw 1b-2: reportar usuarios, bloqueo de cuentas y tablero del administrador`.

### Task 9: Recorrido completo y vista privada

**Files:**
- Modify: `docs/superpowers/plans/2026-11-25-portal-equipos-etapa-1a-pendientes.md` (estado de la 1b-2)

- [ ] **Step 1:** `npx vitest run`, `tsc` (12 GB) y `NODE_OPTIONS='--max-old-space-size=7168' pnpm --filter equipos build`; leer el código de salida real; borrar `apps/equipos/.next` al terminar.
- [ ] **Step 2:** Recorrido en `localhost:3020` contra la rama de prueba con dos cuentas verificadas por el simulador: favorito, alerta, venta, confirmación, calificación, pedido «Busco», reporte y bloqueo desde el admin.
- [ ] **Step 3:** Vista privada: `vercel deploy --yes --archive=tgz --target=preview --scope compramelafotos-projects` desde la raíz del worktree y mover el alias `equipos-dnx-vista.vercel.app`.
- [ ] **Step 4:** Push de la rama. **Sin** PR a `main`, sin migración a producción y sin fusión: eso sólo con el OK de Daniel.
- [ ] **Step 5:** Commit del documento de pendientes.
