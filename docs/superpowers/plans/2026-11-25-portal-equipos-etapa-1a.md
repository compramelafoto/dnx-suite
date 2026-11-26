# Portal de equipos verificados — Etapa 1a: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la etapa 1a del portal: verificación de identidad (correo, teléfono, DNI+selfie+RENAPER vía proveedor), inventario de equipo precargado desde CLF, denuncias de robo/pérdida, sello de verificado en CLF e informe para aseguradoras.

**Architecture:** App Next.js nueva `apps/equipos` (nombre de carpeta provisorio hasta definir la marca) en el monorepo, con el mismo login (`@repo/auth`) y la misma base que CLF (`@repo/db`, rama Neon de producción de CLF). Toda la lógica de dominio vive en funciones puras con tests en `apps/equipos/lib/**`; la serie y la lectura de EXIF se mueven a un paquete nuevo `packages/gear` que comparten CLF y el portal. Las denuncias reutilizan `StolenGearReport` y el panel de administración de denuncias que ya existe en CLF.

**Tech Stack:** Next 16.2.1, React 19.2.4, Prisma (`@repo/db`), `@repo/auth` + `@repo/auth-guards` + `@repo/auth-ui`, Resend, `pdf-lib` 1.17.1 + `qrcode`, R2 (S3), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-portal-equipos-usados-verificados-design.md`

## Global Constraints

- **Trabajar desde `origin/main` en un worktree nuevo**: el `main` local está ~3.700 commits atrás. Borrar el worktree al terminar (el disco se llena con worktrees viejos).
- Base compartida con CLF producción (Neon `compramelafoto`, rama `production`, `br-autumn-rain-ad18wq7y`). **Cambios de esquema sólo aditivos**: tablas nuevas, columnas opcionales, valores nuevos de enum. Nada se borra ni se renombra.
- Desarrollo y pruebas contra una **rama Neon creada desde producción**. La migración a producción se aplica **sólo con el OK explícito de Daniel** (Task 13).
- Migración: carpeta `packages/db/prisma/migrations/20270308090000_portal_equipos_etapa_1a/` (convención `YYYYMMDDHHMMSS_snake_case`, timestamp redondo posterior al último existente; si ya hay uno mayor en `origin/main`, usar el siguiente `...090000`).
- **No se guardan imágenes del DNI ni de la cara.** Del DNI sólo: hash con pimienta (`IDENTITY_DNI_PEPPER`) y últimos 3 dígitos.
- El nombre visible del usuario verificado sale del DNI y no se edita.
- Todo texto de pantalla, correo y mensaje de commit **en español**. Montos de dinero en **pesos enteros** (no centavos) con referencia en dólares; fechas y horas en hora argentina.
- Avisos de la etapa 1a **sólo por correo**. WhatsApp sólo recibe el código de verificación (mensaje iniciado por el usuario).
- Dependencias nuevas: mismas versiones que ya usa `apps/compramelafoto/package.json` o `apps/subilafoto/package.json`; no subir versiones compartidas.
- Textos de «verificado» dicen *identidad verificada* — nunca «operación garantizada».

## Review Focus

1. **Mismo DNI, segunda cuenta**: el segundo intento queda `REJECTED` con motivo `DNI_YA_USADO`; la primera cuenta no cambia. → test en Task 4.
2. **Webhook del proveedor falso o repetido**: firma inválida → 401 sin tocar la base; `providerRef` desconocido → 200 sin cambios; el mismo resultado dos veces → idempotente. → test en Task 5.
3. **Código de teléfono desde otro número, vencido o reutilizado**: no verifica. → test en Task 6.
4. **Serie escrita distinto** («0123-45», «012345», « 012345 »): el inventario, la denuncia y el cruce la tratan como la misma. → test en Task 9.
5. **Informe ya emitido**: si después se vende o edita un equipo, o se revoca la verificación del titular, la página del QR sigue mostrando lo emitido y marca «el titular ya no está verificado». → test en Task 11.

---

### Task 1: Rama Neon de prueba y esqueleto de la app

**Files:**
- Create: `apps/equipos/` copiando la estructura de `apps/subilafoto` (`package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `proxy.ts`, `app/layout.tsx`, `app/page.tsx`), sin su código de negocio.
- Create: `apps/equipos/.env.example` (sin valores): `DATABASE_URL`, `COOKIE_DOMAIN`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `IDENTITY_PROVIDER`, `IDENTITY_DNI_PEPPER`, `IDENTITY_WEBHOOK_SECRET`, `WHATSAPP_VERIFY_NUMBER`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `R2_*` (mismos nombres que CLF), `CRON_SECRET`.
- Modify: `.github/workflows/chequeos.yml` — agregar paso `pnpm --filter equipos test`.

**Interfaces:**
- Produces: paquete `equipos` con script `"test": "vitest run --config vitest.config.ts"` y `"build": "next build --webpack"`.

- [ ] **Step 1:** Crear rama Neon `equipos-etapa-1a` desde `production` del proyecto `compramelafoto` (MCP de Neon) y poner su cadena en `apps/equipos/.env.local` (no se commitea).
- [ ] **Step 2:** Crear el esqueleto copiando de `apps/subilafoto` lo listado arriba; `app/page.tsx` muestra sólo el título provisorio «Equipos verificados».
- [ ] **Step 3:** Run: `pnpm install && pnpm --filter equipos build` → Expected: build OK.
- [ ] **Step 4:** Run: `pnpm --filter equipos test` → Expected: «No test files found» sin error (`passWithNoTests: true` en `vitest.config.ts`).
- [ ] **Step 5:** Commit: `git commit -m "Portal de equipos: esqueleto de la app"`

### Task 2: Paquete compartido `packages/gear` (serie y EXIF)

**Files:**
- Create: `packages/gear/package.json` (`@repo/gear`, `"test": "tsx --test src/*.test.ts"`), `packages/gear/src/serial.ts`, `packages/gear/src/exif.ts`, `packages/gear/src/index.ts`
- Move: contenido de `apps/compramelafoto/lib/stolen-gear/serial.ts` → `packages/gear/src/serial.ts`; contenido de `apps/compramelafoto/lib/photographic-equipment/extract-exif-metadata.ts` → `packages/gear/src/exif.ts`
- Modify: esos dos archivos de CLF pasan a ser `export * from "@repo/gear/serial"` / `export * from "@repo/gear/exif"` (CLF no cambia ningún import).
- Move test: `serial.test.ts` → `packages/gear/src/serial.test.ts`; Create: `packages/gear/src/exif.test.ts`

**Interfaces:**
- Produces: `normalizeGearSerial(raw: string | number | null | undefined): string | null`, `makesLookCompatible(a: string, b: string): boolean`, `MIN_SERIAL_LENGTH`, `extractExifMetadata(buffer: Buffer): Promise<ExtractedExifMetadata | null>`, y nueva `extractGearSerials(meta: ExtractedExifMetadata): { make: string | null; model: string | null; bodySerial: string | null; lensSerial: string | null }` (series ya normalizadas; la del lente sale de `rawExifSummary.LensSerialNumber`, misma lógica que `pickSerials` en `record-sightings.ts`, que pasa a usar esta función).

- [ ] **Step 1:** Test `extractGearSerials` en `exif.test.ts`: `{ make: "Canon", model: "EOS R6", serialNumber: "0123-45", rawExifSummary: { LensSerialNumber: " 98 76 54 " } }` → `{ make: "Canon", model: "EOS R6", bodySerial: "012345", lensSerial: "987654" }`; sin serie → ambos `null`.
- [ ] **Step 2:** Run: `pnpm --filter @repo/gear test` → Expected: FAIL (`extractGearSerials` no existe).
- [ ] **Step 3:** Mover archivos, implementar `extractGearSerials`, hacer que `record-sightings.ts` la use.
- [ ] **Step 4:** Run: `pnpm --filter @repo/gear test && pnpm --filter compramelafoto test:equipos-robados && pnpm --filter compramelafoto exec tsc --noEmit -p tsconfig.json` → Expected: PASS y sin errores de tipos.
- [ ] **Step 5:** Commit: `git commit -m "Mover número de serie y EXIF a @repo/gear"`

### Task 3: Esquema de la etapa 1a

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20270308090000_portal_equipos_etapa_1a/migration.sql`

**Interfaces (Produces, nombres exactos):**
- `enum IdentityVerificationStatus { PENDING IN_REVIEW APPROVED REJECTED }`
- `model IdentityVerification { id Int @id @default(autoincrement()); userId Int @unique; status IdentityVerificationStatus @default(PENDING); provider String; providerRef String? @unique; documentHash String? @unique; documentLast3 String?; legalName String?; consentAt DateTime; approvedAt DateTime?; rejectionReason String?; reviewedById Int?; reverifyRequiredAt DateTime?; createdAt; updatedAt }`
- `model PhoneVerification { id; userId Int @unique; phone String; code String; codeExpiresAt DateTime; verifiedAt DateTime?; createdAt; updatedAt }`
- `enum GearItemKind { BODY LENS FLASH TRIPOD BAG FILTER DRONE OTHER }`, `enum GearItemStatus { IN_USE FOR_SALE SOLD STOLEN LOST RECOVERED }`, `enum GearItemSource { CLF_SIGHTING MANUAL }`
- `model GearItem { id; ownerId Int; kind GearItemKind; make String; model String; serialRaw String?; serialNormalized String?; status GearItemStatus @default(IN_USE); source GearItemSource; sightingId Int? @unique; purchaseDate DateTime?; purchaseProofKey String?; purchaseProofMime String?; declaredValueArs Int?; declaredValueUsd Int?; photoKeys String[]; notes String?; createdAt; updatedAt; @@index([ownerId]); @@index([serialNormalized]) }`
- `enum GearItemEventType { CREATED CONFIRMED_FROM_CLF UPDATED STATUS_CHANGED REPORTED RECOVERED PROOF_ADDED }`, `model GearItemEvent { id; gearItemId Int; type GearItemEventType; detail Json?; createdAt }`
- `model GearSightingDismissal { id; userId Int; sightingId Int; createdAt; @@unique([userId, sightingId]) }`
- `model GearOwnerSettings { id; userId Int @unique; policyRenewalDate DateTime?; lastRenewalReminderAt DateTime? }`
- `model InsuranceReport { id; ownerId Int; code String @unique; contentHash String; snapshot Json; totalArs Int; totalUsd Int; createdAt }`
- `StolenGearReport`: agregar `incident StolenGearIncident @default(THEFT)` con `enum StolenGearIncident { THEFT LOST }`, `gearItemId Int?`, y `invoiceKey String?` / `invoiceMime String?` (pasan a opcionales).

- [ ] **Step 1:** Escribir los modelos y relaciones (`User` recibe las relaciones inversas).
- [ ] **Step 2:** Generar el SQL con `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel packages/db/prisma/schema.prisma --script` contra la rama de prueba, revisar que **sólo** haya `CREATE`, `ADD COLUMN`, `ADD VALUE` y `DROP NOT NULL` (nada de `DROP TABLE/COLUMN`), y guardarlo como `migration.sql`.
- [ ] **Step 3:** Aplicar en la rama de prueba (`prisma migrate deploy`) y `pnpm --filter @repo/db exec prisma generate`.
- [ ] **Step 4:** Run: typecheck de `compramelafoto` → Expected: errores sólo donde se lee `invoiceKey` como no nulo; corregirlos en `app/admin/equipos-robados/page.tsx` y `app/api/admin/equipos-robados/denuncias/[id]/archivo/route.ts` (sin comprobante: «Sin comprobante (pérdida)» y 404 respectivamente).
- [ ] **Step 5:** Run: typecheck de `compramelafoto` y `equipos` → Expected: sin errores.
- [ ] **Step 6:** Commit: `git commit -m "Esquema de la etapa 1a del portal de equipos"`

### Task 4: Lógica de verificación de identidad

**Files:**
- Create: `apps/equipos/lib/identidad/dni.ts`, `apps/equipos/lib/identidad/resultado.ts`, `apps/equipos/lib/identidad/nivel.ts` y sus `*.test.ts`

**Interfaces:**
- Produces:
  - `normalizeDni(raw: string): string | null` — sólo dígitos, 7 u 8; si no, `null`.
  - `hashDni(dni: string, pepper: string): string` — HMAC-SHA256 hex.
  - `type ProviderResult = { providerRef: string; outcome: "approved" | "rejected" | "review"; documentNumber?: string; legalName?: string; reason?: string }`
  - `decideVerification(result: ProviderResult, ctx: { userId: number; hashOwnerUserId: number | null; pepper: string }): { status: IdentityVerificationStatus; documentHash: string | null; documentLast3: string | null; legalName: string | null; rejectionReason: string | null }`
  - `type VerificationLevel = "registrado" | "telefono" | "identidad"`; `computeLevel(input: { emailVerifiedAt: Date | null; phoneVerifiedAt: Date | null; identity: { status: IdentityVerificationStatus; reverifyRequiredAt: Date | null } | null }): VerificationLevel | "sin_correo"`

- [ ] **Step 1:** Tests:
  - `normalizeDni("30.123.456") === "30123456"`, `normalizeDni("12") === null`.
  - `decideVerification` aprobado con DNI cuyo hash es de **otro** usuario → `{ status: "REJECTED", rejectionReason: "DNI_YA_USADO" }` (Review Focus 1); mismo usuario → `APPROVED`, `documentLast3: "456"`.
  - aprobado sin `documentNumber` o sin `legalName` → `IN_REVIEW`; `"review"` → `IN_REVIEW`; `"rejected"` → `REJECTED` con `reason`.
  - `computeLevel` con identidad `APPROVED` pero `reverifyRequiredAt` puesto → `"telefono"`.
- [ ] **Step 2:** Run: `pnpm --filter equipos test lib/identidad` → FAIL.
- [ ] **Step 3:** Implementar en los archivos indicados.
- [ ] **Step 4:** Run: mismo comando → PASS.
- [ ] **Step 5:** Commit: `git commit -m "Reglas de verificación de identidad"`

### Task 5: Capa de proveedor, proveedor simulado y webhook

**Files:**
- Create: `apps/equipos/lib/identidad/proveedor.ts`, `apps/equipos/lib/identidad/proveedor-simulado.ts`, `apps/equipos/lib/identidad/aplicar-resultado.ts`
- Create: `apps/equipos/lib/correo.ts` (+ `correo.test.ts`) — ver su interfaz abajo; las tareas siguientes usan esta misma función.
- Create: `apps/equipos/app/api/identidad/iniciar/route.ts`, `apps/equipos/app/api/identidad/webhook/route.ts`, `apps/equipos/app/verificacion/simulador/page.tsx`
- Test: `apps/equipos/app/api/identidad/webhook/route.test.ts`, `apps/equipos/lib/identidad/aplicar-resultado.test.ts`

**Interfaces:**
- Consumes: `decideVerification`, `ProviderResult` (Task 4).
- Produces:
  - `interface IdentityProvider { name: string; startSession(input: { userId: number; returnUrl: string }): Promise<{ redirectUrl: string; providerRef: string }>; parseWebhook(rawBody: string, headers: Headers): Promise<ProviderResult | null> }` — `null` = firma inválida.
  - `getIdentityProvider(): IdentityProvider` — según `IDENTITY_PROVIDER`; `"simulado"` lanza error si `NODE_ENV === "production"`.
  - `applyProviderResult(result: ProviderResult): Promise<"applied" | "unknown_ref" | "already_final">` — busca por `providerRef`, calcula con `decideVerification`, guarda; si queda `APPROVED`/`REJECTED` envía correo con `sendPortalEmail`; si queda `IN_REVIEW` avisa a `ADMIN_EMAIL`.
  - `sendPortalEmail(to: string, template: "verificacion_aprobada" | "verificacion_rechazada" | "verificacion_en_revision_admin" | "denuncia_recibida" | "coincidencia_inventario_admin" | "conflicto_serie_admin" | "recordatorio_poliza", data: Record<string, string>): Promise<{ success: boolean }>` con Resend, como `apps/compramelafoto/lib/email.ts`. Los correos al admin no llevan datos personales en el asunto. Test: cada plantilla produce asunto y cuerpo en español sin `undefined`.
- El simulado firma con `IDENTITY_WEBHOOK_SECRET` (HMAC-SHA256 en header `x-signature`) y su página deja elegir aprobado/rechazado/revisión y el DNI.
- `iniciar` exige nivel `"telefono"` y registra `consentAt` (el formulario previo muestra el consentimiento biométrico; texto basado en `apps/compramelafoto/app/consentimiento-biometrico/page.tsx`).

- [ ] **Step 1:** Tests (Review Focus 2): firma inválida → 401 y sin escrituras; `providerRef` desconocido → 200 y `"unknown_ref"`; mismo resultado dos veces → la segunda `"already_final"`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `git commit -m "Proveedor de identidad: capa, simulador y webhook"`

### Task 6: Verificación del teléfono por WhatsApp

**Files:**
- Create: `apps/equipos/lib/telefono/codigo.ts` (+ test), `apps/equipos/lib/whatsapp/webhook.ts` (adaptado de `apps/fotoffice/lib/bandeja/webhook`: `firmaValida`, `leerWebhook`), `apps/equipos/app/api/webhooks/whatsapp/route.ts` (+ `route.test.ts`), `apps/equipos/app/cuenta/telefono/page.tsx`

**Interfaces:**
- Produces:
  - `generatePhoneCode(): string` — `"EQ-"` + 6 dígitos.
  - `buildWhatsappLink(number: string, code: string): string` — `https://wa.me/<number>?text=<código url-encoded>`.
  - `extractCode(text: string): string | null` — encuentra `EQ-\d{6}` en cualquier parte.
  - `matchPhoneVerification(input: { fromPhone: string; text: string; now: Date; pending: { phone: string; code: string; codeExpiresAt: Date; verifiedAt: Date | null } }): boolean`
- El código vence a los 15 minutos. El webhook marca `verifiedAt` sólo si coincide número (comparar con `formatPhone` de CLF portado), código y vigencia; responde 200 siempre que la firma sea válida.
- Cambiar el teléfono ya verificado borra `verifiedAt` y pone `IdentityVerification.reverifyRequiredAt = now`.

- [ ] **Step 1:** Tests (Review Focus 3): código correcto desde otro número → `false`; vencido → `false`; ya verificado → `false`; correcto → `true`; texto «hola EQ-123456 gracias» → `extractCode` devuelve `"EQ-123456"`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit: `git commit -m "Verificación del teléfono por WhatsApp"`

### Task 7: Registro, ingreso y pantalla «Mi verificación»

**Files:**
- Create: `apps/equipos/app/login/page.tsx`, `apps/equipos/app/crear-cuenta/page.tsx` + `actions.ts`, `apps/equipos/app/api/auth/*` (mismo set que `apps/muestras`), `apps/equipos/lib/sesion.ts` (copia de `apps/muestras/lib/sesion.ts`), `apps/equipos/lib/guards.ts` (+ test), `apps/equipos/app/cuenta/verificacion/page.tsx`
- Create: `packages/auth-ui/src/brand/equipos.ts` (marca provisoria)

**Interfaces:**
- Consumes: `computeLevel` (Task 4).
- Produces: `getPortalUser(): Promise<(CurrentUser & { level: VerificationLevel | "sin_correo" }) | null>` y `requireLevel(level: VerificationLevel): Promise<...>` (redirige a `/cuenta/verificacion`).
- Crear cuenta pregunta «¿Sos fotógrafo?»: sí → `role = PHOTOGRAPHER`, no → `CUSTOMER` (con `registerDnxAccount` y luego `prisma.user.update`). Un usuario CLF existente entra con su cuenta, sin cambiar su rol.
- «Mi verificación» muestra los tres pasos con su estado y el botón del siguiente.
- Con identidad aprobada, el portal muestra siempre `IdentityVerification.legalName` como nombre del usuario (no `User.name`) y no ofrece editarlo.
- **Cambio de correo**: en el lugar donde `@repo/auth` / CLF actualizan `User.email` (buscar con `git grep -n "email:" -- packages/auth/src apps/compramelafoto/app/api` las escrituras a `user.update`), poner `IdentityVerification.reverifyRequiredAt = now` si existe una verificación. Test: después de cambiar el correo, `computeLevel` devuelve `"telefono"`.

- [ ] **Step 1:** Test de `requireLevel`: usuario `"telefono"` pidiendo `"identidad"` → redirige; `"identidad"` → pasa.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS, y en el navegador (preview) crear cuenta en la rama de prueba, verificar correo, teléfono (simulando el webhook) e identidad (simulador) hasta ver «Identidad verificada».
- [ ] **Step 5:** Commit: `git commit -m "Registro, ingreso y pantalla de verificación"`

### Task 8: Panel de verificaciones en revisión

**Files:**
- Create: `apps/equipos/app/admin/verificaciones/page.tsx`, `apps/equipos/app/api/admin/verificaciones/[id]/route.ts` (+ test)

**Interfaces:**
- Acceso sólo `isSuperAdmin(user)`. Lista `IN_REVIEW` con nombre de la cuenta, fecha, motivo del proveedor y enlace a la sesión del proveedor (`providerRef`). Acciones: aprobar (exige cargar DNI y nombre según DNI → pasa por `decideVerification` para respetar «una cuenta por DNI») o rechazar con motivo. Guarda `reviewedById`. Enlace a `/admin/equipos-robados` de CLF para denuncias.

- [ ] **Step 1:** Test: aprobar a mano con un DNI ya usado por otro → 409 y sigue `IN_REVIEW`; usuario no admin → 403.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit: `git commit -m "Panel de verificaciones en revisión"`

### Task 9: Inventario «Mi equipo»

**Files:**
- Create: `apps/equipos/lib/inventario/sugerencias.ts`, `apps/equipos/lib/inventario/equipos.ts` (+ tests), `apps/equipos/lib/archivos.ts` (R2, adaptado de `apps/compramelafoto/lib/r2-client.ts` + `lib/stolen-gear/files.ts`, prefijo `equipos/`), `apps/equipos/app/mi-equipo/page.tsx`, `apps/equipos/app/mi-equipo/[id]/page.tsx`, `apps/equipos/app/mi-equipo/actions.ts`

**Interfaces:**
- Consumes: `normalizeGearSerial` (Task 2), `requireLevel("identidad")` (Task 7).
- Produces:
  - `listSightingSuggestions(userId: number): Promise<Array<{ sightingId: number; kind: "BODY" | "LENS"; make: string; model: string; serialRaw: string; firstSeenAt: Date; lastSeenAt: Date; photosCount: number }>>` — de `GearSerialSighting` con `photographerId = userId`, excluyendo los ya en `GearItem.sightingId` y en `GearSightingDismissal`.
  - `confirmSighting(userId, sightingId): Promise<GearItem>` (evento `CONFIRMED_FROM_CLF`), `dismissSighting(userId, sightingId): Promise<void>`
  - `createManualItem(userId, input: { kind; make; model; serialRaw?; purchaseDate?; declaredValueArs?; declaredValueUsd?; notes? }): Promise<GearItem>` (evento `CREATED`; normaliza serie)
  - `updateItem(userId, itemId, patch)`, `attachItemPhoto(userId, itemId, file: File)` (agrega a `photoKeys`, máx. 6, jpeg/png/webp), `attachPurchaseProof(userId, itemId, file: File)` (evento `PROOF_ADDED`; mismas reglas de tipo y tamaño que CLF: jpeg/png/webp/pdf, 4 MB)
  - `listItemHistory(userId, itemId): Promise<GearItemEvent[]>`
- Si la serie de un equipo nuevo ya existe en el inventario de **otro** usuario: se crea igual y se avisa a `ADMIN_EMAIL` (sin datos personales en el asunto).
- Todo se filtra por `ownerId`: un usuario nunca lee ni edita equipos ajenos.

- [ ] **Step 1:** Tests: sugerencias excluyen confirmadas y descartadas; `createManualItem` con `" 0123-45 "` guarda `serialNormalized: "012345"` (Review Focus 4); `updateItem` sobre un equipo ajeno → error `NO_ENCONTRADO`.
- [ ] **Step 2–4:** FAIL → implementar → PASS; ver la pantalla en el preview con un usuario de la rama de prueba que tenga series en `GearSerialSighting`.
- [ ] **Step 5:** Commit: `git commit -m "Inventario de equipo precargado desde CLF"`

### Task 10: Denuncia de robo o pérdida desde el inventario

**Files:**
- Create: `apps/equipos/lib/inventario/denuncias.ts` (+ test), `apps/equipos/app/mi-equipo/[id]/denunciar/page.tsx`, `apps/equipos/app/api/cron/cruce-inventario/route.ts`, `apps/equipos/vercel.json`

**Interfaces:**
- Consumes: `GearItem` (Task 9), `StolenGearReport` (Task 3).
- Produces:
  - `reportIncident(userId, itemId, input: { incident: "THEFT" | "LOST"; occurredAt: Date; place?: string; description?: string; policeReportNumber?: string; invoice?: File; policeReport?: File }): Promise<{ reportId: number | null }>`
    - `BODY`/`LENS` con serie → crea `StolenGearReport` (`PENDING_REVIEW`, `gearItemId`, `incident`); `THEFT` sin comprobante (ni adjunto ni `purchaseProofKey` del equipo) → error `FALTA_COMPROBANTE`. Si el equipo ya tiene comprobante, se reutiliza su clave.
    - Otros tipos o sin serie → sólo cambia el estado, `reportId: null`.
    - Estado del equipo `STOLEN`/`LOST`, evento `REPORTED`.
  - `markRecovered(userId, itemId)` → estado `RECOVERED`, `StolenGearReport.status = RECOVERED` + `recoveredAt`, evento `RECOVERED`.
  - `findInventoryMatches(): Promise<Array<{ reportId: number; gearItemId: number }>>` — denuncias `ACTIVE` contra `GearItem` de **otros** dueños con la misma `serialNormalized`.
- Cron diario (`vercel.json`, 12:30 UTC, protegido con `CRON_SECRET`): corre `findInventoryMatches` y envía a `ADMIN_EMAIL` sólo las nuevas (recordar las avisadas en `GearItemEvent` del ítem coincidente con `detail: { matchReportId }`). El denunciante nunca ve coincidencias.

- [ ] **Step 1:** Tests: robo sin comprobante → `FALTA_COMPROBANTE`; pérdida sin comprobante → crea denuncia con `invoiceKey: null`; trípode → sin denuncia y estado `STOLEN`; `findInventoryMatches` ignora el propio inventario del denunciante.
- [ ] **Step 2–4:** FAIL → implementar → PASS; comprobar en el preview de CLF (`/admin/equipos-robados`) que la denuncia de pérdida sin comprobante se ve bien.
- [ ] **Step 5:** Commit: `git commit -m "Denuncias de robo y pérdida desde el inventario"`

### Task 11: Informe para aseguradoras

**Files:**
- Create: `apps/equipos/lib/informe/snapshot.ts`, `apps/equipos/lib/informe/pdf.ts` (+ tests), `apps/equipos/app/mi-equipo/informe/page.tsx` + `actions.ts`, `apps/equipos/app/informe/[code]/page.tsx` (pública), `apps/equipos/app/api/informe/[code]/pdf/route.ts`, `apps/equipos/app/api/cron/recordatorio-poliza/route.ts`

**Interfaces:**
- Produces:
  - `type ReportSnapshot = { issuedAt: string; holder: { legalName: string; documentLast3: string }; items: Array<{ kind; make; model; serialRaw: string | null; status; purchaseDate: string | null; hasPurchaseProof: boolean; seal: { photosCount: number; since: string } | null; valueArs: number; valueUsd: number }>; totalArs: number; totalUsd: number }`
  - `buildSnapshot(input): ReportSnapshot` — pura; el sello sale del `GearSerialSighting` vinculado.
  - `hashSnapshot(s: ReportSnapshot): string` — SHA-256 del JSON con claves ordenadas.
  - `createInsuranceReport(userId, itemIds: number[]): Promise<{ code: string }>` — exige nivel `"identidad"`; `code` = 16 bytes aleatorios en base64url.
  - `buildInsuranceReportPdf(s: ReportSnapshot, verifyUrl: string): Promise<Uint8Array>` — pdf-lib + qrcode (patrón de `apps/compramelafoto/lib/instructivos/cartel-qr-pdf.ts`); DNI como `**.***.<últimos 3>`; montos en pesos con separador de miles y en dólares.
  - `/mi-equipo/informe` lista los informes ya emitidos (fecha, total, enlace al PDF) además de permitir generar uno nuevo eligiendo equipos.
  - Página `/informe/[code]`: muestra el snapshot guardado, la fecha, el hash y el estado **actual** de la verificación del titular («Titular con identidad verificada» / «El titular ya no está verificado»).
- Valores: el fotógrafo carga `declaredValueArs` y `declaredValueUsd` por equipo; un equipo sin valor no se puede incluir. *(Decisión del plan: no se usa cotización automática del dólar.)*
- Recordatorio: el fotógrafo guarda `policyRenewalDate`; cron diario envía correo 30 días antes del aniversario si `lastRenewalReminderAt` es nulo o de hace más de 300 días.

- [ ] **Step 1:** Tests (Review Focus 5): `hashSnapshot` igual para el mismo contenido con claves en otro orden; tras vender/editar el equipo, la página del código muestra el snapshot original; con la verificación pasada a `REJECTED`, muestra «El titular ya no está verificado»; el PDF generado tiene 1+ páginas y contiene el texto `**.***.456`.
- [ ] **Step 2–4:** FAIL → implementar → PASS; generar un informe en el preview y escanear el QR.
- [ ] **Step 5:** Commit: `git commit -m "Informe de equipamiento para aseguradoras con QR"`

### Task 12: Sello «Fotógrafo verificado» en CLF

**Files:**
- Modify: `apps/compramelafoto/components/photographer/PhotographerPublicPage.tsx` (junto al nombre, ~línea 395) y `apps/compramelafoto/app/[handler]/page.tsx` (cargar la verificación)

**Interfaces:**
- Sello en CLF: si el usuario tiene `IdentityVerification.status = APPROVED` sin `reverifyRequiredAt` y `role = PHOTOGRAPHER` → «Fotógrafo verificado»; otro rol → nada en el perfil de CLF.

- Extraer la regla a una función pura `isVerifiedPhotographer(user: { role: Role }, identity: { status: IdentityVerificationStatus; reverifyRequiredAt: Date | null } | null): boolean` en `packages/gear/src/verificado.ts` para poder testearla.

- [ ] **Step 1:** Tests de `isVerifiedPhotographer`: aprobado + `PHOTOGRAPHER` → `true`; aprobado + `CUSTOMER` → `false`; aprobado con `reverifyRequiredAt` → `false`; `IN_REVIEW` → `false`.
- [ ] **Step 2–4:** FAIL → implementar → PASS; ver el sello en el preview de CLF con el usuario verificado de la rama de prueba.
- [ ] **Step 5:** Commit: `git commit -m "Sello de Fotógrafo verificado en el perfil de CLF"`

### Task 13: Paso a producción (requiere OK de Daniel)

- [ ] **Step 1:** Run: `pnpm --filter equipos test && pnpm --filter @repo/gear test && pnpm --filter compramelafoto test:equipos-robados`, typecheck y `build` de `equipos` y `compramelafoto` → todo OK.
- [ ] **Step 2:** Abrir PR con título y descripción en español; esperar CI.
- [ ] **Step 3:** **Pedir OK a Daniel** para aplicar la migración a la rama `production` de CLF; aplicarla a mano y registrarla como hace el proyecto para CLF.
- [ ] **Step 4:** Proyecto de Vercel nuevo para `equipos` (sólo esa app), variables de entorno, crons; dominio cuando haya nombre. Proveedor de identidad real y número de WhatsApp quedan pendientes de Daniel: hasta entonces la app no se abre al público.
- [ ] **Step 5:** Borrar la rama Neon de prueba y el worktree.
