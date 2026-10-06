# Tienda online — Etapa 3 (obras de concursos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una institución venda copias impresas y cuadros de obras de sus concursos de FotoRank, con permiso del autor, regalía y producción propia, sobre el carrito/cobro/envío/panel existentes.

**Architecture:** Tablas nuevas en el esquema compartido; lógica pura en `apps/fotoffice/lib/store/artworks/*`; una ruta firmada (HMAC) en FotoRank para vista previa con marca de agua y original; FOTOFFICE guarda las vistas previas en su R2; el carrito y `createStoreOrder`/`finalizePaidOrder` admiten renglones de obra; regalías en su propio libro.

**Tech Stack:** Next.js del repo (leer `node_modules/next/dist/docs/`), Prisma 6, Vitest, sharp (ya en FOTOFFICE y FotoRank).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-05-tienda-online-etapa-3-obras-design.md`

## Global Constraints

- Plata: centavos enteros en código, `Decimal(12,2)` en base, conversión con `apps/fotoffice/lib/membership/money.ts`. Regalía en bps (2000 = 20 %), `Math.round(base * bps / 10000)`, base = precio de la línea **sin envío**.
- Nunca catch de P2002 dentro de una transacción interactiva. Toda consulta de FOTOFFICE con `workspaceId`. Una obra sólo es accesible si su concurso pertenece a una organización **vinculada** al workspace.
- Logs sin datos personales; tokens guardados como hash; textos en español rioplatense.
- Migración `packages/db/prisma/migrations/20261005180000_store_artworks/migration.sql`, sólo aditiva; se aplica a mano antes del deploy.
- Secreto compartido `DNX_FOTORANK_LINK_SECRET` (mismo valor en FOTOFFICE y FotoRank). Enlaces firmados de 10 minutos. Base URL de FotoRank en FOTOFFICE: `FOTORANK_PUBLIC_BASE_URL` (si falta, `https://fotorank.com`).
- Permisos: vínculos, formatos, publicación y regalías exigen `requireStoreConfigurer`; ver/operar pedidos `requireStoreOperator`.
- Pruebas: `cd apps/<app> && npx vitest run <ruta>`; suite completa de FOTOFFICE (y de FotoRank si se la toca) + `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .` antes de cada commit final. Commits en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Esquema y migración
Modelos del spec §4 con tipos reales, relaciones (`Workspace` en cascada; `ContestOrganization`, `FotorankContest`, `FotorankContestEntry` con `onDelete: Restrict` o `SetNull` donde corresponda — nunca borrar datos de FotoRank por un borrado en FOTOFFICE; regalías → `StoreOrder` restrict), columnas nuevas en `StoreOrderItem`. `prisma validate` + `generate`; migración por `migrate diff` contra `origin/main`, sólo aditiva. Suite + typecheck. Commit "Tienda: esquema de obras de concursos".

### Task 2: Lógica pura de obras
`apps/fotoffice/lib/store/artworks/{resolution.ts,consent-basis.ts,royalty.ts,signing.ts,slug.ts}` + tests:
- `minLongSidePx(format: { widthCm; heightCm }, minDpi): number` y `eligibleFormats(original: { width; height }, formats, minDpi)`; `needsBorders(original, format): boolean` (proporción distinta en más de 2 %).
- `consentBasisFromRights(rights: { allowPrint: boolean; allowCommercial: boolean } | null): "RULES" | "EXPLICIT"`; `isSellable(consent: { basis; status } | null): boolean` (RULES+NOTIFIED, EXPLICIT+GRANTED); transiciones del autor: RULES NOTIFIED→WITHDRAWN; EXPLICIT PENDING→GRANTED|DECLINED; GRANTED→WITHDRAWN.
- `royaltyMinor(lineTotalMinor, bps)`.
- `signEntryImageUrl({ baseUrl, entryId, variant, expiresAt, secret })` / `verifyEntryImageSignature(params, secret, now)` — HMAC-SHA256 base64url sobre `entryId|variant|exp`, comparación en tiempo constante. **Mismo archivo copiado** en `apps/fotorank/app/lib/fotorank/external/entry-image-signing.ts` con los mismos tests (no hay paquete compartido para esto; mantener idénticos y un test en cada app con el mismo vector fijo).
- `artworkSlug(title, entryNumber, taken)`.
Commit "Tienda: reglas puras de obras".

### Task 3: Ruta firmada en FotoRank + cliente en FOTOFFICE
- FotoRank `app/api/fotorank/external/entry-image/route.ts`: verifica firma y vencimiento; `variant=preview` → toma JURY_PREVIEW (o ORIGINAL) activo de la obra con el storage provider existente, redimensiona a 1600 px lado mayor con sharp, marca de agua diagonal semitransparente con el texto del parámetro firmado `wm` (incluir `wm` en la firma) y devuelve JPEG; `variant=original` → bytes del ORIGINAL con `Content-Disposition: attachment; filename="<entryNumber>.jpg"`, `Cache-Control: private, no-store`. 404 genérico ante cualquier falla. Sin sesión. Tests de la ruta con storage falso.
- FOTOFFICE `lib/store/artworks/fotorank-client.ts`: `buildPreviewUrl(entryId, watermark)` y `buildOriginalUrl(entryId)` (firmados, 10 min), `fetchPreview(entryId, watermark): Promise<Buffer>` (timeout 15 s), y `storePreviewInR2(workspaceId, listingId, buffer)` usando el cliente R2 de FOTOFFICE y un prefijo nuevo `fotoffice/artwork-previews` en `r2-key-policy.ts`. Sin secreto → error tipado `ARTWORKS_NOT_CONFIGURED`.
Commit "Tienda: acceso firmado a imágenes de FotoRank".

### Task 4: Vínculo con organizaciones de FotoRank
`lib/store/artworks/links.ts`: `listLinkableOrganizations(userId, workspaceId)` (ACTIVE OWNER/ADMIN en FotoRank), `linkOrganization(...)` (exige además OWNER/ADMIN del workspace — usar `resolveWorkspaceRole`/`canManageWorkspaceSettings`), `unlinkOrganization`, `linkedOrganizationIds(workspaceId)`, `assertContestLinked(workspaceId, contestId)`. Página `app/(shell)/ventas/tienda/obras/page.tsx` (sección vínculos) + submenú "Obras". Tests. Commit "Tienda: vincular organizaciones de FotoRank".

### Task 5: Formatos y ajustes de impresión
`lib/store/artworks/format-form.ts` (+test), acciones y UI en `app/(shell)/ventas/tienda/obras/formatos/*`: alta/edición/baja (baja = desactivar si tiene pedidos), dpi mínimo (72–600). Validaciones: medidas 5–200 cm, precio > 0, costo ≥ 0 opcional, peso/embalaje opcionales (avisar que sin peso el envío usa el peso por defecto). Commit "Tienda: formatos de impresión".

### Task 6: Permisos de autores
`lib/store/artworks/consent.ts`: `requestConsents(workspaceId, contestId, entryIds, userId)` crea/actualiza `ArtworkConsent` (basis por las bases publicadas del concurso: leer la configuración versionada con `rights`), genera token (32 bytes, guarda sha256, vence 60 días) y manda correo con `sendAndLogEmail` (`templateKey` `store.artwork_consent_rules` / `store.artwork_consent_request`): obra (vista previa si ya existe; si no, sin imagen), institución, % de regalía, formatos y precios, enlace `/w/<slug>/obras/permiso/<token>`. Reenviar = token nuevo. `respondConsent(token, action)` (accept/decline/withdraw) con transiciones de Task 2; retirar/no aceptar despublica la obra (`ArtworkListing.status = WITHDRAWN`). Página pública `app/w/[workspaceSlug]/obras/permiso/[token]/page.tsx` + acción, funciona con la tienda cerrada. Tests. Commit "Tienda: permiso de los autores".

### Task 7: Elegir y publicar obras
`lib/store/artworks/catalog.ts` + UI `app/(shell)/ventas/tienda/obras/[contestId]/*`: listar concursos de organizaciones vinculadas; por concurso, obras CONFIRMED (no REJECTED/WITHDRAWN) con miniatura (enlace firmado preview), premio (desde `FotorankResultEntry` vía snapshot), estado del permiso y acciones "Avisar / pedir permiso", "Publicar", "Despublicar"; % de regalía del concurso (`ContestStoreSettings`). `publishArtwork` exige `isSellable`, trae vista previa (Task 3), la guarda en R2, arma título/autor/premio (spec O13) y slug. Tests. Commit "Tienda: elegir y publicar obras".

### Task 8: Tienda pública de obras
`app/w/[workspaceSlug]/tienda/(abierta)/obras/{page.tsx,[artworkSlug]/page.tsx}` + componentes: grilla filtrable por concurso, ficha con vista previa, autor, concurso, premio, formatos elegibles con precio, aviso de bordes, "Agregar al carrito". Reservar los slugs `obras` en `STORE_RESERVED_SLUGS`. Carrito: `CartLine` admite `{ kind: "artwork"; artworkListingId; printFormatId; ... }` (los existentes son `kind: "product"` por omisión al leer el storage viejo). `validateCartLines` valida las obras en el servidor. Tests. Commit "Tienda: obras en la vidriera".

### Task 9: Checkout y pedido con obras
`checkout-input.ts` líneas de obra; `createStoreOrder` valida obras (publicada, vinculada, vendible, formato activo y elegible, precio del formato), crea `StoreOrderItem` con snapshot (título, formato, royaltyBps del concurso, autor) sin reserva de stock; `quoteShipping` acepta ítems de obra usando peso/embalaje del formato. Tests. Commit "Tienda: pedidos con obras".

### Task 10: Acreditación, regalías y cancelación
`finalizePaidOrder` agrega renglón suelto por obra (costo del formato) y crea `ArtworkRoyalty` ACCRUED por línea; `changeOrderStatus(CANCELLED)` anula las ACCRUED y marca las PAID como "a recuperar" (evento). Tests. Commit "Tienda: regalías de obras".

### Task 11: Producción y pantalla de regalías
Detalle del pedido: por renglón de obra, formato, medidas, aviso de bordes y "Descargar original" (acción que verifica que el pedido esté pagado y sea del workspace, y redirige al enlace firmado). Pantalla `app/(shell)/ventas/tienda/obras/regalias/*`: mes (hora argentina), por autor nombre/email, cantidad, total; "Marcar pagado" con referencia; exportar CSV. Tests. Commit "Tienda: producción y regalías".

### Task 12: Verificación final
Suites de FOTOFFICE y FotoRank, typecheck de ambas, `pnpm --filter fotoffice build` y `pnpm --filter fotorank build` (con `DATABASE_URL` ficticia; si el build de FotoRank necesita base para prerender, documentarlo y confiar en el check de Vercel). No abrir PR.

---

## Agregado (pedido de Daniel, 2026-10-05): Andreani como proveedor de envío

Referencia: `apps/fotoffice/docs/integraciones/andreani-api.md` (separa lo oficial de lo inferido; validar con credenciales QA).

### Task 13: Cliente de Andreani y credenciales cifradas
`apps/fotoffice/lib/integrations/andreani/{client.ts,credentials.ts,errors.ts}` + tests, con el mismo diseño que `lib/integrations/correo-argentino/*`: ambiente QA (`https://apisqa.andreani.com`) / PROD (`https://apis.andreani.com`); `GET /login` con Basic → token en header `x-authorization-token` (24 h; caché por `env:usuario:sha256(clave)`, renovar 60 s antes; un reintento ante 401); `quote({ contract, clientCode, originBranch?, postalCodeDestination, packages: [{ weightKg, lengthCm, widthCm, heightCm, declaredValueMinor }] })` → `GET /v1/tarifas` con los parámetros `bultos[0][...]` de la referencia, devuelve `tarifaConIva.total` en centavos (rechaza ≤ 0 o no numérico); `branches({ postalCode })` → `GET /v2/sucursales?codigoPostal=&canal=B2C` (sólo las que `entregaEnvios`), id, nombre, dirección, CP. Errores tipados igual que MiCorreo (401 AUTH tras reintento; 400/402/404/409/403 BUSINESS; 429 RATE_LIMIT; red/timeout 5 s NETWORK). Credenciales en `WorkspaceIntegration` (provider `ANDREANI`, integrationKey `andreani`): `{ env, user, password, clientCode, contractHome, contractBranch?, originBranch? }` cifrado; al guardar se valida con un token nuevo y una cotización de prueba al CP de origen. Registro de integraciones con proveedor ANDREANI (las pantallas de Google siguen filtrando por GOOGLE). Commit "Tienda: cliente de Andreani y credenciales cifradas".

### Task 14: Andreani en el cotizador, la configuración y el checkout
`StoreShippingSettings.source` admite `ANDREANI` (columna texto, sin migración). `quoteShipping`: fuente ANDREANI → HOME con `contractHome`, BRANCH con `contractBranch` (si falta, BRANCH deshabilitado); peso en kg desde el paquete; valor declarado = subtotal de la línea (o 0); respaldo a la tabla igual que Correo; AUTH marca NEEDS_RECONSENT. Configuración: tarjeta "Andreani" en Ventas → Tienda → Envíos (formulario como Correo: ambiente, usuario, clave, código de cliente, contrato domicilio, contrato sucursal opcional, sucursal de origen opcional; Probar conexión; Desconectar) y opción de fuente "Andreani" (exige conexión ACTIVE al pasar a ella, como Correo). Checkout: para BRANCH con Andreani las sucursales se listan por **código postal** (no por provincia) — `listAgenciesAction` y la resolución en `createStoreOrder` despachan por fuente; despacho: enlace de seguimiento de Andreani `https://www.andreani.com/#!/informacionEnvio/<n>` (verificar en QA; si no, sólo número). Tests. Commit "Tienda: Andreani en envíos".
