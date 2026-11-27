# Portal de equipos verificados — Etapa 1b, parte 1: publicaciones, catálogo y contacto

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un fotógrafo con identidad verificada publique un equipo de su inventario, que cualquiera lo vea en un catálogo público, que un comprador verificado pueda contactarlo, y que cualquier verificado consulte si una serie tiene denuncia.

**Architecture:** Sigue la etapa 1a en `apps/equipos`: lógica de dominio en `lib/**` (funciones con pruebas Vitest que simulan `@repo/db` con `vi.mock`), pantallas finas en `app/**` con server actions. Una publicación (`GearListing`) cuelga siempre de un equipo del inventario (`GearItem`) y usa sus fotos; el catálogo lee sólo publicaciones `PUBLISHED` y devuelve un objeto público que no trae datos del vendedor. El cruce contra denuncias reutiliza `StolenGearReport` (estado `ACTIVE`).

**Tech Stack:** Next 16.2.1, React 19.2.4, Prisma (`@repo/db`), `@repo/auth-guards` (`isSuperAdmin`), `@repo/gear` (`normalizeGearSerial`, `extractExifMetadata`, `extractGearSerials`), Resend vía `lib/correo.ts`, R2 vía `lib/archivos.ts`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-portal-equipos-usados-verificados-design.md` (§4, §5, §6 sin favoritos ni alertas, §7, §9, §13 y §14).

**División de la etapa 1b** (cada parte sale a producción por separado):

| Parte | Qué trae | Plan |
|---|---|---|
| **1b-1** (este) | Publicar, sellos por metadatos, catálogo, contacto e interesados, consulta de serie, reportes, panel admin de publicaciones | este archivo |
| 1b-2 | Cierre de venta y traspaso, calificaciones, favoritos, alertas de búsqueda, «Busco», reportar usuario y bloqueo de cuentas (§8, §6 favoritos/alertas, §13, §14, §16) | a escribir al terminar 1b-1 |
| 1b-3 | Redes del portal: carrusel diario e historias (§11). Necesita las cuentas de Instagram y Facebook del portal | a escribir cuando existan las cuentas |

## Global Constraints

- Trabajar en el worktree `portal-equipos-etapa-1a` sobre `origin/main` actualizado, en una rama nueva `portal-equipos-etapa-1b1` creada desde la de la 1a (la 1a todavía no está fusionada).
- Base compartida con CLF producción. **Cambios de esquema sólo aditivos**: tablas nuevas, enums nuevos, relaciones nuevas en `User`. **No** se agregan valores a enums existentes (`GearItemEventType`, `GearItemStatus`): el historial de publicación usa `STATUS_CHANGED`/`UPDATED` con `detail: { listingId, accion }`.
- Migración: `packages/db/prisma/migrations/20270309090000_portal_equipos_etapa_1b1/migration.sql`, idempotente (`IF NOT EXISTS`, bloques `DO $$` para claves foráneas), como la de la 1a. Se prueba en la rama Neon `equipos-etapa-1a` (`br-frosty-wildflower-advymj8r`); a producción sólo con el OK de Daniel, con `prisma db execute` + `prisma migrate resolve --applied`.
- Publicar, contactar y consultar series exige `requireLevel("identidad")`. Ver el catálogo y la ficha no exige sesión.
- **La ficha y el catálogo nunca muestran** correo, teléfono, apellido, DNI ni la serie completa del vendedor. Serie pública enmascarada: `••••` + últimos 4 caracteres de `serialNormalized`.
- El vendedor **nunca** se entera de por qué una publicación quedó en revisión. Texto fijo: «Tu publicación está en revisión. Te avisamos por correo cuando esté publicada.»
- Montos en **pesos enteros**; referencia en dólares opcional, entera. Fechas en hora argentina (`lib/inventario/formato.ts`).
- Avisos sólo por correo, con plantillas nuevas en `lib/correo.ts`. Los asuntos de correos al admin no llevan datos personales.
- Textos en español; «verificado» significa *identidad verificada*, nunca «compra garantizada».
- Topes contados en la base (no en memoria): 20 contactos nuevos por comprador cada 24 h; 30 consultas de serie por usuario cada 24 h.

## Review Focus

1. **Equipo con denuncia activa de otra persona**: publicar lo deja `IN_REVIEW`, avisa al admin una vez y el vendedor ve sólo el texto fijo. Un equipo propio `STOLEN`/`LOST`/`SOLD` o con denuncia propia no se puede publicar. → tests en Task 3.
2. **Fuga de datos en la ficha**: el objeto público no trae `email`, `phone`, `name` completo, `serialRaw` ni `ownerId`. → test en Task 5.
3. **Contacto indebido**: sin identidad, el propio vendedor, publicación pausada o en revisión → rechazo; repetir el contacto no reenvía el correo al vendedor; el contacto 21 en 24 h se rechaza. → tests en Task 6.
4. **Serie escrita distinto** («0123-45», «12345», « 012345 ») encuentra la misma denuncia; denuncias `WITHDRAWN`, `RECOVERED`, `REJECTED` o `PENDING_REVIEW` responden «no figura»; la respuesta nunca trae datos del denunciante. → tests en Task 7.
5. **Denuncia aprobada después de publicar**: el cron diario pasa la publicación a `IN_REVIEW` y avisa al admin una sola vez aunque corra varios días. → test en Task 8.

---

### Task 1: Esquema y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelos nuevos después de `InsuranceReport`; relaciones inversas en `User` y `GearItem`)
- Create: `packages/db/prisma/migrations/20270309090000_portal_equipos_etapa_1b1/migration.sql`

**Interfaces:**
- Produces (Prisma):
  - `enum GearListingStatus { DRAFT IN_REVIEW PUBLISHED PAUSED SOLD CLOSED }`
  - `enum GearListingCondition { NEW LIKE_NEW VERY_GOOD GOOD WITH_DETAILS }`
  - `enum GearListingUsageSeal { USAGE_VERIFIED PROOF_PHOTO NONE }`
  - `model GearListing { id, sellerId Int, gearItemId Int, status GearListingStatus @default(DRAFT), kind GearItemKind, make String, model String, mount String?, priceArs Int, priceUsdRef Int?, condition GearListingCondition, description String?, accessories String?, province String, city String, serialPhotoKey String?, usageSeal GearListingUsageSeal @default(NONE), usageSince DateTime?, usagePhotosCount Int?, socialConsentAt DateTime, reviewNote String?, publishedAt DateTime?, closedAt DateTime?, createdAt, updatedAt }`; índices `[status, kind]`, `[sellerId]`, `[gearItemId]`.
  - `model GearListingView { id, listingId, userId, firstViewedAt @default(now()), lastViewedAt, count Int @default(1) }`; `@@unique([listingId, userId])`.
  - `model GearListingContact { id, listingId, buyerId, createdAt }`; `@@unique([listingId, buyerId])`, `@@index([buyerId, createdAt])`.
  - `model GearListingFlag { id, listingId, reporterId, reason String, createdAt, resolvedAt DateTime? }`; `@@unique([listingId, reporterId])`.
  - `model GearSerialLookup { id, userId, serialNormalized String, matchedReportId Int?, createdAt }`; `@@index([userId, createdAt])`.
  - Todas las claves foráneas a `User` y `GearListing` con `onDelete: Cascade`; `GearListing.gearItemId` → `GearItem` con `Cascade`; `matchedReportId` sin clave foránea (sólo dato).

- [ ] **Step 1:** Agregar enums, modelos y relaciones inversas al schema.
- [ ] **Step 2:** Generar el SQL con `pnpm --filter @repo/db exec prisma migrate diff --from-schema-datasource ... --to-schema-datamodel prisma/schema.prisma --script` contra la rama de prueba, pasarlo a idempotente a mano y guardarlo en la carpeta de la migración.
- [ ] **Step 3:** Aplicar en la rama de prueba: `prisma db execute --file <migration.sql>` y `prisma migrate resolve --applied 20270309090000_portal_equipos_etapa_1b1`. Expected: sin error; correrlo una segunda vez tampoco da error.
- [ ] **Step 4:** `pnpm --filter @repo/db exec prisma generate` y `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit` en `apps/equipos`. Expected: exit 0.
- [ ] **Step 5:** Commit `Portal de equipos 1b: tablas de publicaciones, contactos y consultas de serie`.

### Task 2: Reglas puras de publicación y sellos

**Files:**
- Create: `apps/equipos/lib/publicaciones/reglas.ts`, `apps/equipos/lib/publicaciones/sellos.ts`, `apps/equipos/lib/publicaciones/catalogos.ts`
- Test: `apps/equipos/lib/publicaciones/reglas.test.ts`, `apps/equipos/lib/publicaciones/sellos.test.ts`

**Interfaces:**
- Produces (`catalogos.ts`): `PROVINCIAS: string[]` (las 23 provincias + «Ciudad Autónoma de Buenos Aires»); `MONTURAS: string[]` = `["Canon EF", "Canon RF", "Nikon F", "Nikon Z", "Sony E", "Fujifilm X", "Fujifilm GFX", "Micro 4/3", "L-Mount", "Pentax K", "Otra"]`; `CONDITION_LABELS: Record<GearListingCondition, string>` = Nuevo, Como nuevo, Muy bueno, Bueno, Con detalles.
- Produces (`reglas.ts`):
  - `type ListingInput = { priceArs: number; priceUsdRef?: number | null; condition: GearListingCondition; description?: string; accessories?: string; province: string; city: string; mount?: string | null; socialConsent: boolean }`
  - `validateListingInput(input: ListingInput, kind: GearItemKind): ListingInput` — tira `EquipoError("DATO_INVALIDO", msg)` si: precio no entero o < 1; dólares no entero o < 0; provincia fuera de `PROVINCIAS`; ciudad vacía; montura fuera de `MONTURAS`; `socialConsent` falso («Para publicar tenés que aceptar que el artículo pueda salir en las redes del portal.»); descripción > 2000 o accesorios > 500 caracteres. Devuelve los textos recortados (`trim`).
  - `requiresSerial(kind: GearItemKind): boolean` → `true` sólo para `BODY` y `LENS`.
  - `listingBlocker(item: { status: GearItemStatus; kind: GearItemKind; serialNormalized: string | null; photoKeys: string[] }, ctx: { ownReportOpen: boolean; activeListing: boolean; serialPhotoKey: string | null }): string | null` — mensaje para el vendedor o `null`. En orden: estado `STOLEN`/`LOST`/`SOLD` → «Este equipo no se puede publicar en su estado actual.»; `ownReportOpen` → igual mensaje; `activeListing` → «Este equipo ya tiene una publicación.»; sin fotos → «Subí al menos una foto del equipo.»; `requiresSerial` y sin serie → «Para cámaras y lentes el número de serie es obligatorio.»; `requiresSerial` y sin `serialPhotoKey` → «Subí una foto del número de serie grabado en el equipo.»
  - `maskSerial(serialNormalized: string | null): string | null` → `"••••" + últimos 4`; `null` si no hay.
- Produces (`sellos.ts`):
  - `computeUsageSeal(sightings: Array<{ photographerId: number | null; firstSeenAt: Date; photosCount: number }>, sellerId: number): { seal: "USAGE_VERIFIED" | "NONE"; since: Date | null; photos: number | null; otherOwner: boolean }` — `USAGE_VERIFIED` si algún avistaje es del vendedor (usa el `firstSeenAt` más viejo y la suma de `photosCount` de los suyos); `otherOwner = true` si hay avistajes de otro `photographerId` no nulo.
  - `async proofPhotoMatches(buffer: Buffer, serialNormalized: string): Promise<boolean>` — `extractExifMetadata` + `extractGearSerials`; compara con `normalizeGearSerial` cada serie leída (cuerpo y lente).
  - `usageSealText(seal, since, photos): string | null` → USAGE_VERIFIED: «Usado por el vendedor desde {mes en letras} de {año}, en {N} fotos»; PROOF_PHOTO: «Serie comprobada con foto del equipo»; NONE: `null`.

- [ ] **Step 1: Escribir las pruebas que fallan**, entre ellas:

```ts
it("pide serie y foto de la serie sólo a cámaras y lentes", () => {
  const base = { status: "IN_USE" as const, serialNormalized: null, photoKeys: ["equipos/a.jpg"] };
  const ctx = { ownReportOpen: false, activeListing: false, serialPhotoKey: null };
  expect(listingBlocker({ ...base, kind: "LENS" }, ctx)).toBe("Para cámaras y lentes el número de serie es obligatorio.");
  expect(listingBlocker({ ...base, kind: "TRIPOD" }, ctx)).toBeNull();
});
it("no deja publicar un equipo robado, perdido o vendido", () => { /* STOLEN, LOST, SOLD → mismo mensaje */ });
it("enmascara la serie", () => expect(maskSerial("ABC123456")).toBe("••••3456"));
it("sello de uso con el avistaje más viejo del vendedor y suma de fotos", () => {
  const r = computeUsageSeal([
    { photographerId: 7, firstSeenAt: new Date("2025-03-10"), photosCount: 40 },
    { photographerId: 7, firstSeenAt: new Date("2024-11-02"), photosCount: 12 },
  ], 7);
  expect(r).toEqual({ seal: "USAGE_VERIFIED", since: new Date("2024-11-02"), photos: 52, otherOwner: false });
});
it("serie vista sólo bajo otro usuario: sin sello y marca otherOwner", () => { /* seal NONE, otherOwner true */ });
it("texto del sello", () => expect(usageSealText("USAGE_VERIFIED", new Date("2024-11-02T12:00:00-03:00"), 52)).toBe("Usado por el vendedor desde noviembre de 2024, en 52 fotos"));
```

- [ ] **Step 2:** `pnpm --filter equipos test lib/publicaciones` → Expected: FAIL (módulos inexistentes).
- [ ] **Step 3:** Implementar los tres archivos con las firmas de arriba. Para `proofPhotoMatches` usar en la prueba un JPEG chico con EXIF armado como en `packages/gear/src/exif.test.ts`.
- [ ] **Step 4:** Mismo comando → Expected: PASS.
- [ ] **Step 5:** Commit `Portal de equipos 1b: reglas de publicación y sellos por metadatos`.

### Task 3: Crear, publicar y administrar una publicación

**Files:**
- Create: `apps/equipos/lib/publicaciones/publicar.ts`
- Modify: `apps/equipos/lib/inventario/equipos.ts` (nuevo código de error y bloqueo de estado), `apps/equipos/lib/inventario/denuncias.ts` (`reportIncident` cierra la publicación), `apps/equipos/lib/correo.ts` (plantillas)
- Test: `apps/equipos/lib/publicaciones/publicar.test.ts`, agregar casos en `equipos.test.ts` y `denuncias.test.ts`

**Interfaces:**
- Consumes: Task 2 completa; `uploadPrivateFile`, `validateFile` de `lib/archivos.ts`; `sendPortalEmail`.
- Produces:
  - `EquipoErrorCode` suma `"CON_PUBLICACION"` (updateItem no cambia el estado manual de un equipo con publicación `IN_REVIEW`, `PUBLISHED` o `PAUSED`: «Este equipo tiene una publicación activa; pausala o cerrala primero.»).
  - `async createListing(sellerId: number, gearItemId: number, input: ListingInput, files: { serialPhoto?: File; proofPhoto?: File }): Promise<{ listingId: number; status: "IN_REVIEW" | "PUBLISHED" }>` — en este orden: busca el equipo del vendedor (`NO_ENCONTRADO` si no es suyo); calcula `ownReportOpen` (denuncia propia `PENDING_REVIEW` o `ACTIVE` sobre el equipo) y `activeListing`; sube `serialPhoto` si viene; `listingBlocker` → `EquipoError("DATO_INVALIDO", msg)`; `validateListingInput`; sello: `computeUsageSeal` sobre `GearSerialSighting` con esa `serialNormalized`, y si no da `USAGE_VERIFIED` y vino `proofPhoto` con `proofPhotoMatches` → `PROOF_PHOTO` (la foto de prueba **no se guarda**); cruce: ¿existe `StolenGearReport` `ACTIVE` con esa serie y `reporterId ≠ sellerId`? → `IN_REVIEW` con `reviewNote: "Denuncia activa #<id>"`; si no → `PUBLISHED` con `publishedAt`. En la misma transacción: crea la publicación (copia `kind/make/model` del equipo), pasa el equipo a `FOR_SALE` y crea `GearItemEvent` `STATUS_CHANGED` con `detail: { listingId, accion: "publicado" }`. Después de la transacción, avisos al admin: `publicacion_en_revision_admin` si quedó en revisión; `serie_de_otro_usuario_admin` si `otherOwner`.
  - `async pauseListing(sellerId, listingId)` (`PUBLISHED` → `PAUSED`, equipo → `IN_USE`), `async resumeListing(sellerId, listingId)` (`PAUSED` → `PUBLISHED`, rehace el cruce: si ahora hay denuncia activa → `IN_REVIEW`), `async closeListing(sellerId, listingId)` (`DRAFT`/`IN_REVIEW`/`PUBLISHED`/`PAUSED` → `CLOSED` con `closedAt`, equipo → `IN_USE`), `async updateListing(sellerId, listingId, input: ListingInput)` (sólo `PUBLISHED`/`PAUSED`; no cambia el sello). Transición inválida → `EquipoError("DATO_INVALIDO", "Esta publicación ya no se puede modificar.")`. Cada cambio deja su `GearItemEvent` con `accion`.
  - `async closeListingsForItem(tx, gearItemId: number): Promise<void>` — pasa a `CLOSED` las publicaciones abiertas del equipo; lo llama `reportIncident` dentro de su transacción.
  - `async listSellerListings(sellerId): Promise<GearListing[]>` ordenadas por `createdAt` desc.
  - Plantillas nuevas: `publicacion_en_revision_admin` (asunto «Publicación en revisión», cuerpo con `detalle` y `url`), `serie_de_otro_usuario_admin` (asunto «Serie publicada vista con otro usuario»), `publicacion_aprobada` y `publicacion_rechazada` (al vendedor; la rechazada sin motivo interno: «No pudimos publicar tu artículo. Si tenés dudas, respondé este correo.»).

- [ ] **Step 1: Escribir las pruebas que fallan** (mock de `@repo/db` como en `equipos.test.ts`), entre ellas:
  - `createListing` con denuncia `ACTIVE` de otro usuario → devuelve `{ status: "IN_REVIEW" }`, manda **un** correo `publicacion_en_revision_admin` y el `reviewNote` no aparece en lo devuelto.
  - Con denuncia propia `PENDING_REVIEW` → `EquipoError` con el mensaje «Este equipo no se puede publicar en su estado actual.»
  - Equipo de otro dueño → `NO_ENCONTRADO`.
  - Avistaje del vendedor → `usageSeal: "USAGE_VERIFIED"`; avistaje sólo de otro → `NONE` y correo `serie_de_otro_usuario_admin`; foto de prueba con la serie correcta → `PROOF_PHOTO` y `uploadPrivateFile` **no** se llama para esa foto.
  - `resumeListing` con denuncia aprobada mientras estaba pausada → `IN_REVIEW`.
  - `updateItem` con estado manual sobre un equipo con publicación `PUBLISHED` → `CON_PUBLICACION`.
  - `reportIncident` sobre un equipo publicado → la publicación queda `CLOSED`.
- [ ] **Step 2:** `pnpm --filter equipos test lib/publicaciones lib/inventario` → Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mismo comando → Expected: PASS (y las pruebas de la 1a siguen en verde).
- [ ] **Step 5:** Commit `Portal de equipos 1b: crear, pausar y cerrar publicaciones con cruce de denuncias`.

### Task 4: Pantallas del vendedor

**Files:**
- Create: `apps/equipos/app/mi-equipo/[id]/publicar/page.tsx`, `apps/equipos/app/mis-publicaciones/page.tsx`, `apps/equipos/app/mis-publicaciones/[id]/page.tsx`, `apps/equipos/app/mis-publicaciones/actions.ts`
- Modify: `apps/equipos/app/mi-equipo/[id]/page.tsx` (botón «Publicar a la venta» si no hay bloqueo de estado), `apps/equipos/app/mi-equipo/page.tsx` (enlace «Mis publicaciones»)

**Interfaces:**
- Consumes: Task 3 (`createListing`, `pauseListing`, `resumeListing`, `closeListing`, `updateListing`, `listSellerListings`), Task 6 (`listInterested`) para la sección de interesados — si Task 6 no está, la sección se agrega en Task 6.
- Produces: rutas `/mi-equipo/[id]/publicar` y `/mis-publicaciones[/id]`, todas con `requireLevel("identidad", <ruta>)`.

«Publicar desde cero» = el formulario de alta manual de `/mi-equipo` ya existente + este formulario; no se crea un flujo aparte.

- [ ] **Step 1:** Formulario de publicar: precio en pesos, referencia en dólares (opcional), estado (`CONDITION_LABELS`), provincia (`PROVINCIAS`), ciudad, montura (sólo cámaras y lentes), descripción, accesorios incluidos, foto del número de serie (obligatoria en cámaras y lentes), foto de prueba opcional («Subí una foto tomada con este equipo: si su número de serie coincide, la publicación muestra el sello "Serie comprobada"»), casilla obligatoria de redes. Errores `EquipoError` se muestran arriba del formulario; tras crear, redirige a `/mis-publicaciones/[id]`.
- [ ] **Step 2:** `/mis-publicaciones`: lista con estado (`IN_REVIEW` muestra el texto fijo de las restricciones globales), precio y enlace. `/mis-publicaciones/[id]`: editar precio y datos, pausar, reanudar, cerrar (con confirmación), y el sello obtenido.
- [ ] **Step 3:** Comprobar en `localhost:3020` contra la rama de prueba: publicar un lente del usuario de prueba 1306 y ver que queda `PUBLISHED` con sello «Uso verificado» si su serie está en `GearSerialSighting`.
- [ ] **Step 4:** `npx vitest run` y `tsc` → Expected: verde.
- [ ] **Step 5:** Commit `Portal de equipos 1b: pantallas para publicar y administrar publicaciones`.

### Task 5: Catálogo público y ficha

**Files:**
- Create: `apps/equipos/lib/catalogo/buscar.ts`, `apps/equipos/app/equipos/page.tsx`, `apps/equipos/app/equipos/[id]/page.tsx`, `apps/equipos/app/equipos/GuiaCompraSegura.tsx`
- Modify: `apps/equipos/app/page.tsx` (enlaces «Ver equipos en venta», «Mis publicaciones», «Consultar una serie»)
- Test: `apps/equipos/lib/catalogo/buscar.test.ts`

**Interfaces:**
- Produces:
  - `type CatalogFilters = { kind?: GearItemKind; make?: string; mount?: string; minPrice?: number; maxPrice?: number; province?: string; page: number }`
  - `parseCatalogFilters(sp: Record<string, string | string[] | undefined>): CatalogFilters` — ignora valores inválidos (tipo fuera del enum, montura/provincia fuera de las listas, precios no enteros o negativos); `page` ≥ 1, por defecto 1.
  - `type PublicListing = { id: number; kind; make; model; mount: string | null; priceArs: number; priceUsdRef: number | null; condition; description: string | null; accessories: string | null; province: string; city: string; serialMasked: string | null; usageSealText: string | null; sellerFirstName: string; sellerVerified: true; photoUrls: string[]; publishedAt: Date }`
  - `async searchListings(f: CatalogFilters): Promise<{ items: PublicListing[]; total: number }>` — sólo `PUBLISHED`, 24 por página, orden `publishedAt` desc; `make` sin distinguir mayúsculas.
  - `async getPublicListing(id: number): Promise<PublicListing | null>` — `null` si no está `PUBLISHED`.
  - `async recordView(listingId: number, userId: number): Promise<void>` — `upsert` sobre `[listingId, userId]` sumando `count`; no registra al propio vendedor; nunca tira error (lo loguea).
  - `sellerFirstName` = primera palabra de `User.name`, con mayúscula inicial; si no hay nombre, «Vendedor».
  - Fotos: `getSignedFileUrl(key, 3600)` de `photoKeys` del equipo, sin la foto del número de serie.

- [ ] **Step 1: Escribir las pruebas que fallan**, entre ellas:

```ts
it("el objeto público no trae datos del vendedor ni la serie completa", async () => {
  m.listingFindFirst.mockResolvedValue(listingConVendedor({ email: "v@x.com", phone: "+5493415550000", name: "Ana Pérez" }));
  const l = await getPublicListing(5);
  const json = JSON.stringify(l);
  for (const filtrado of ["v@x.com", "5550000", "Pérez", "ABC123456", "sellerId", "ownerId"]) expect(json).not.toContain(filtrado);
  expect(l?.sellerFirstName).toBe("Ana");
  expect(l?.serialMasked).toBe("••••3456");
});
it("una publicación pausada o en revisión no se muestra", async () => { /* findFirst con status PUBLISHED en el where */ });
it("filtros inválidos se ignoran", () => {
  expect(parseCatalogFilters({ kind: "AVION", minPrice: "-3", province: "Narnia", page: "0" })).toEqual({ page: 1 });
});
```

- [ ] **Step 2:** `pnpm --filter equipos test lib/catalogo` → Expected: FAIL.
- [ ] **Step 3:** Implementar `buscar.ts`. La consulta a la base hace `select` explícito: del vendedor sólo `name` y, del equipo, sólo `photoKeys` y `serialNormalized`.
- [ ] **Step 4:** Mismo comando → Expected: PASS.
- [ ] **Step 5:** Páginas: `/equipos` con filtros por formulario GET y paginación; `/equipos/[id]` con fotos, sello de identidad («Identidad verificada»), sello de uso, precio, datos, botón «Contactar al vendedor» (Task 6), «Reportar publicación» (Task 8), `recordView` si hay sesión, y `GuiaCompraSegura` con este texto fijo:
  «Antes de pagar: revisá el equipo en persona y probalo; comprobá que el número de serie del equipo coincida con el de la publicación; no pagues por adelantado a alguien que no conocés; si algo no te cierra, consultá la serie en el portal o escribinos. "Identidad verificada" significa que sabemos quién es el vendedor; no garantiza la operación.»
  `notFound()` si `getPublicListing` da `null`.
- [ ] **Step 6:** Commit `Portal de equipos 1b: catálogo público y ficha del equipo`.

### Task 6: Contacto e interesados

**Files:**
- Create: `apps/equipos/lib/contacto/contactar.ts`, `apps/equipos/app/equipos/[id]/contactar/actions.ts`
- Modify: `apps/equipos/app/equipos/[id]/page.tsx` (botón y datos revelados), `apps/equipos/app/mis-publicaciones/[id]/page.tsx` (sección «Interesados»), `apps/equipos/lib/correo.ts` (plantilla `nueva_consulta`)
- Test: `apps/equipos/lib/contacto/contactar.test.ts`

**Interfaces:**
- Produces:
  - `type ContactError = "PROPIA" | "NO_DISPONIBLE" | "LIMITE"` dentro de `class ContactoError extends Error { code }`.
  - `async contactSeller(buyer: { id: number; displayName: string | null }, listingId: number): Promise<{ sellerName: string; sellerEmail: string; sellerPhone: string | null; firstTime: boolean }>` — la publicación debe estar `PUBLISHED` (si no, `NO_DISPONIBLE`); si `buyer.id === sellerId` → `PROPIA`; si ya existe el contacto, devuelve los datos con `firstTime: false` **sin** mandar correo; si es nuevo y el comprador tiene ≥ 20 contactos en las últimas 24 h → `LIMITE` («Llegaste al máximo de contactos por hoy. Probá mañana.»); si no, crea el `GearListingContact` y manda `nueva_consulta` al vendedor con el nombre verificado del comprador, el equipo y el enlace a `/mis-publicaciones/[id]`. `sellerName` = nombre legal del DNI del vendedor (`IdentityVerification.legalName`); `sellerPhone` sólo si `phoneVerifiedAt` no es nulo.
  - `async contactedBefore(buyerId, listingId): Promise<boolean>` — para mostrar los datos revelados al volver a la ficha.
  - `async listInterested(sellerId: number, listingId: number): Promise<{ views: number; viewers: number; contacts: Array<{ name: string; at: Date }> }>` — `NO_ENCONTRADO` si la publicación no es del vendedor; `name` = nombre legal del comprador.
- La server action exige `requireLevel("identidad", "/equipos/<id>")` antes de llamar a `contactSeller`; sin sesión o sin identidad, el botón lleva a ingresar o a «Mi verificación».

- [ ] **Step 1: Escribir las pruebas que fallan**: propio vendedor → `PROPIA`; `PAUSED` e `IN_REVIEW` → `NO_DISPONIBLE`; segundo contacto → `firstTime: false` y `sendPortalEmail` no se llama; 20 contactos previos en 24 h → `LIMITE` y no se crea nada; teléfono sin verificar → `sellerPhone: null`; `listInterested` de una publicación ajena → `NO_ENCONTRADO`.
- [ ] **Step 2:** `pnpm --filter equipos test lib/contacto` → Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mismo comando → Expected: PASS.
- [ ] **Step 5:** Pantallas: en la ficha, tras contactar, mostrar nombre, correo y WhatsApp (`https://wa.me/<número sin +>`) del vendedor con la guía de compra segura al lado; en «Mis publicaciones», visitas, personas distintas y lista de consultas con fecha.
- [ ] **Step 6:** Commit `Portal de equipos 1b: contactar al vendedor y registro de interesados`.

### Task 7: Consulta de número de serie

**Files:**
- Create: `apps/equipos/lib/serie/consultar.ts`, `apps/equipos/app/consultar-serie/page.tsx`, `apps/equipos/app/consultar-serie/actions.ts`
- Modify: `apps/equipos/lib/correo.ts` (plantilla `consulta_serie_coincide_admin`, asunto «Consulta de serie con denuncia activa»)
- Test: `apps/equipos/lib/serie/consultar.test.ts`

**Interfaces:**
- Produces:
  - `type SerialLookupResult = { result: "SIN_DENUNCIA" | "CON_DENUNCIA" } | { error: "SERIE_INVALIDA" | "LIMITE" }`
  - `async lookupSerial(userId: number, raw: string): Promise<SerialLookupResult>` — `normalizeGearSerial(raw)` nulo → `SERIE_INVALIDA` sin registrar; ≥ 30 consultas del usuario en 24 h → `LIMITE` sin registrar; busca `StolenGearReport` con esa serie y `status: "ACTIVE"` (robo o pérdida); registra `GearSerialLookup` con `matchedReportId`; si coincide, avisa al admin con usuario, serie y número de denuncia en el cuerpo.
- Textos fijos de la página: SIN_DENUNCIA → «Este número de serie no figura con denuncias activas en el portal. Igual revisá el equipo en persona antes de comprarlo.»; CON_DENUNCIA → «Este número de serie figura con una denuncia activa. No lo compres y escribinos.»; SERIE_INVALIDA → «Escribí el número de serie completo (al menos 4 caracteres).»; LIMITE → «Llegaste al máximo de consultas por hoy. Probá mañana.»

- [ ] **Step 1: Escribir las pruebas que fallan**:

```ts
it.each(["0123-45", "12345", " 012345 "])("«%s» encuentra la denuncia de 12345", async (raw) => {
  m.reportFindFirst.mockResolvedValue({ id: 9 });
  expect(await lookupSerial(1, raw)).toEqual({ result: "CON_DENUNCIA" });
  expect(m.reportFindFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ serialNormalized: normalizeGearSerial("12345"), status: "ACTIVE" }) }));
});
it("el resultado no trae datos de la denuncia", async () => { /* Object.keys(res) toEqual ["result"] */ });
it("30 consultas en 24 h → LIMITE sin registrar", async () => { /* count 30 → lookupCreate no llamado */ });
it("serie inválida no se registra", async () => { /* "ab" → SERIE_INVALIDA */ });
```

- [ ] **Step 2:** `pnpm --filter equipos test lib/serie` → Expected: FAIL.
- [ ] **Step 3:** Implementar `consultar.ts` y la página con `requireLevel("identidad", "/consultar-serie")`.
- [ ] **Step 4:** Mismo comando → Expected: PASS.
- [ ] **Step 5:** Commit `Portal de equipos 1b: consulta de número de serie para usuarios verificados`.

### Task 8: Reportes, panel del administrador y cruce diario

**Files:**
- Create: `apps/equipos/lib/publicaciones/moderacion.ts`, `apps/equipos/app/admin/publicaciones/page.tsx`, `apps/equipos/app/api/admin/publicaciones/[id]/route.ts`, `apps/equipos/app/equipos/[id]/reportar/actions.ts`
- Modify: `apps/equipos/app/api/cron/cruce-inventario/route.ts` (llama también a `holdListingsWithActiveReports`), `apps/equipos/lib/correo.ts` (plantilla `reporte_publicacion_admin`)
- Test: `apps/equipos/lib/publicaciones/moderacion.test.ts`, `apps/equipos/app/api/admin/publicaciones/[id]/route.test.ts`

**Interfaces:**
- Produces:
  - `async flagListing(reporterId: number, listingId: number, reason: string): Promise<void>` — motivo de 10 a 500 caracteres (`DATO_INVALIDO`); un reporte por persona y publicación (el segundo no falla ni duplica); avisa al admin.
  - `async approveListing(adminId: number, listingId: number)` (`IN_REVIEW` → `PUBLISHED`, `publishedAt`, correo `publicacion_aprobada`) y `async rejectListing(adminId: number, listingId: number, note: string)` (`IN_REVIEW` → `CLOSED`, equipo → `IN_USE`, `reviewNote` += nota, correo `publicacion_rechazada`). Otro estado → error 409 en la ruta.
  - `async holdListingsWithActiveReports(): Promise<{ held: number }>` — publicaciones `PUBLISHED` o `PAUSED` cuya serie tiene una denuncia `ACTIVE` de otra persona → `IN_REVIEW` con `reviewNote: "Denuncia activa #<id>"` y un correo `publicacion_en_revision_admin` por publicación. No vuelve a avisar por publicaciones que ya están en `IN_REVIEW`.
  - Ruta `POST /api/admin/publicaciones/[id]` con cuerpo `{ accion: "aprobar" } | { accion: "rechazar", nota: string }`; 403 si no `isSuperAdmin`.
  - Panel `/admin/publicaciones` (sólo super admin, `notFound()` si no): en revisión con su `reviewNote`, reportes sin resolver, consultas de serie con coincidencia de los últimos 30 días, y conteos (publicadas, en revisión, contactos de los últimos 30 días).

- [ ] **Step 1: Escribir las pruebas que fallan**: el cron corre dos veces seguidas y manda un solo correo; `rejectListing` sobre una `PUBLISHED` → error; ruta sin super admin → 403; segundo reporte del mismo usuario no crea otro ni manda otro correo.
- [ ] **Step 2:** `pnpm --filter equipos test lib/publicaciones app/api/admin` → Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mismo comando → Expected: PASS.
- [ ] **Step 5:** Commit `Portal de equipos 1b: reportes, moderación de publicaciones y cruce diario`.

### Task 9: Recorrido completo, vista privada y publicación

**Files:**
- Modify: `docs/superpowers/plans/2026-11-25-portal-equipos-etapa-1a-pendientes.md` (estado de la 1b-1)

- [ ] **Step 1:** `npx vitest run`, `tsc` (12 GB) y `NODE_OPTIONS='--max-old-space-size=7168' pnpm --filter equipos build` en local; leer el código de salida real y borrar `apps/equipos/.next` al terminar. Expected: todo en verde.
- [ ] **Step 2:** Recorrido en el navegador contra la rama de prueba con dos cuentas verificadas por el simulador: el vendedor publica un lente; el comprador lo encuentra filtrando por marca, lo contacta y ve los datos; el vendedor ve al interesado; el comprador consulta una serie con denuncia y otra sin denuncia; el admin aprueba una publicación en revisión.
- [ ] **Step 3:** Publicar la vista privada: `vercel deploy --archive=tgz --target=preview` desde la raíz del worktree y mover el alias `equipos-dnx-vista.vercel.app` con `POST /v2/deployments/<id>/aliases`. **Antes**, conseguir credenciales R2 para Preview (token de Cloudflare con acceso sólo a `equipos-privado`): sin ellas no se pueden subir fotos y nada se puede publicar.
- [ ] **Step 4:** Abrir el PR de la 1b-1 contra `main` (en borrador hasta que la 1a esté fusionada). Migración a producción y fusión: sólo con el OK de Daniel, en el orden de la 1a (migración primero).
- [ ] **Step 5:** Commit del documento de pendientes.
