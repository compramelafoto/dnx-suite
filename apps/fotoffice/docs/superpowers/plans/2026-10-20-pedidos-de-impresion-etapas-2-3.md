# Pedidos de impresión — Etapas 2 (envío a domicilio) y 3 (desde galerías) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Sumar al pedido de impresión (etapa 1, en producción, PR 661) el envío a domicilio con costo por distancia y la posibilidad de pedir copias desde las galerías del cliente.

**Architecture:** Se generaliza el origen de las fotos con una "fuente" (`CARPETA` | `GALERIA`) que entrega la lista de fotos imprimibles, el cliente y el proyecto de origen; la pantalla del cliente y el cobro dejan de conocer el tipo de origen. El envío se cotiza con una función pura y el servidor lo recalcula desde las coordenadas. Columnas nuevas, todas opcionales, en `FotofficePrintOrder` y `FotofficePrintOrderItem`.

**Tech Stack:** igual que la etapa 1 (Next 16, Prisma, Vitest, sharp, R2, Mercado Pago). Distancia: `straightLineKm` de `@repo/cuanto-cobro-core` × `CUANTO_COBRO_ROUTE_FACTOR` (1,3). Direcciones: `GET /api/geocode?q=` (`PlaceDto`).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-20-pedidos-de-impresion-design.md` (§3 envío, §4 entrada desde galería, §7 etapas 2 y 3).

## Global Constraints

- Leer `apps/fotoffice/AGENTS.md` (Next 16 distinto).
- Columnas nuevas **opcionales** y aplicadas en la base ANTES de fusionar (una columna faltante rompe todo el modelo).
- Envío: costo = `shippingBaseArs + shippingPerKmArs × km`, `km = round1(straightLineKm(estudio, destino) × 1.3)` (sólo ida). Si `km > shippingMaxKm` → no se ofrece envío. Sin ubicación del estudio (perfil de precios `studioLatitude/Longitude`) el envío no se puede encender. El servidor recalcula; nunca usa un monto del navegador.
- Mercado Pago cobra el **total** (copias + envío). Caja registra el total.
- Galerías: imprimibles = las fotos cuyo original el cliente puede descargar hoy (misma regla que `idsDeOriginales` en `lib/galerias/publico.ts`: ENTREGA → todas las listas; SELECCION/VENTA → pagadas + incluidas si la selección ya se envió; `downloadMode` VISTA/NINGUNA → ninguna), sólo `mediaType FOTO`.
- Textos en español rioplatense (vos). Montos en centavos enteros internamente.
- Pruebas: `pnpm exec vitest run --config vitest.config.ts <archivo>` desde `apps/fotoffice`. tsc lo verifica CI.

## Review Focus

- Envío manipulado desde el navegador (monto o km) → el servidor recalcula desde lat/lon y sus propios ajustes (Task 2).
- Dirección fuera de radio o sin coordenadas → sólo retiro, sin cobrar envío (Task 2).
- Cliente de galería que intenta imprimir fotos no compradas → rechazado por el servidor (Task 3).
- Galería despublicada o enlace revocado → no se puede pedir (Task 3).
- Pedido con envío: el estudio ve la dirección en el trabajo y en el seguimiento; el laboratorio no la recibe (Task 2).

---

### Task 1: Columnas nuevas y "fuente" de fotos

**Files:** `packages/db/prisma/schema.prisma`; migración `packages/db/prisma/migrations/20261128120000_fotoffice_impresion_envio_galerias/migration.sql`; `apps/fotoffice/lib/impresiones/fuentes-servidor.ts` (+test).

- [ ] Agregar a `FotofficePrintOrder`: `galeriaId String?`, `shippingAddress String?`, `shippingLat Float?`, `shippingLon Float?`, `shippingKm Float?`, `@@index([galeriaId])`. A `FotofficePrintOrderItem`: `galeriaFotoId String?`. Sin relaciones nuevas (texto, como `archivoId`). Migración sólo con `ALTER TABLE … ADD COLUMN` + `CREATE INDEX`.
- [ ] En `fuentes-servidor.ts` exportar:
  - `type FuenteTipo = "CARPETA" | "GALERIA"`
  - `type FotoImprimible = { id: string; nombre: string; key: string; width: number | null; height: number | null; mini: string }` (`mini` = URL de miniatura para el navegador)
  - `type Fuente = { tipo: FuenteTipo; proyectoOrigenId: string | null; galeriaId: string | null; clientId: string | null; nombre: string | null; email: string | null; telefono: string | null; fotos: FotoImprimible[] }`
  - `resolverFuente(workspaceId: string, slug: string, tipo: FuenteTipo, token: unknown): Promise<Fuente | null>`. CARPETA usa la lógica actual (`proyectoDeTokenCliente` + `fotosAptas`, `mini` = `/api/w/${slug}/archivos/${token}/mini/${id}`, datos del cliente desde `Client`). GALERIA se implementa en Task 3 (por ahora devuelve null).
- [ ] Pruebas: CARPETA arma fotos con `mini` correcto; token inválido → null; GALERIA → null (provisorio).
- [ ] Commit.

### Task 2: Envío a domicilio

**Files:** `lib/impresiones/envio.ts` (+test, puro); `lib/impresiones/configuracion-servidor.ts`; `app/workspace/configuracion/impresiones/*`; `lib/impresiones/pago-servidor.ts` (+test); pantalla del cliente `app/w/[workspaceSlug]/archivos/[token]/imprimir/*` → mover a componente compartido `components/impresiones/pedido-cliente.tsx` que recibe la `Fuente`; `components/impresiones/buscar-direccion.tsx`; seguimiento y resumen del trabajo (mostrar dirección).

- [ ] `envio.ts` puro: `cotizarEnvio(a: { estudio: {lat:number; lon:number} | null; destino: {lat:number; lon:number} | null; baseCents: number; porKmCents: number; maxKm: number | null }): { ok: true; km: number; cents: number } | { ok: false; motivo: "SIN_ESTUDIO" | "SIN_DESTINO" | "FUERA_DE_RADIO" }`. km = `Math.round(straightLineKm(...) * CUANTO_COBRO_ROUTE_FACTOR * 10) / 10`; cents = `baseCents + Math.round(km * porKmCents)`. Pruebas: Rosario centro → Funes (~16 km línea recta), fuera de radio, sin estudio, sin destino, redondeos.
- [ ] Configuración: `ofertaPublica` devuelve además `envio: { baseCents; porKmCents; maxKm; estudio: {lat;lon} } | null` (null si `shippingEnabled` false o sin ubicación en `extrasDelWorkspace(workspaceId)`). `guardarAjustes` acepta `shippingEnabled`, `shippingBaseArs`, `shippingPerKmArs`, `shippingMaxKm` (con `parsearMontoAr`); rechaza encender sin ubicación del estudio con «Cargá la ubicación de tu estudio en Configuración → Precios para ofrecer envíos.». La pantalla muestra los campos y propone `travelPerKm` del perfil como precio por km si está vacío.
- [ ] `iniciarPagoImpresion(workspaceId, slug, tipo, token, datos)`: `datos.entrega = { tipo: "RETIRO" } | { tipo: "ENVIO"; direccion: string; lat: number; lon: number }`. Con ENVIO: recalcula con `cotizarEnvio`; si no `ok`, error «Esa dirección está fuera de la zona de envío. Elegí retirar en el local.»; guarda `delivery: "ENVIO"`, `shippingArs`, `shippingAddress` (≤ 300 caracteres), `shippingLat/Lon`, `shippingKm`; `totalArs = subtotal + envío`; MP `amountMinor` = total. Pruebas: monto de envío del navegador ignorado; fuera de radio rechazado; total = copias + envío; RETIRO sin cambios.
- [ ] `buscar-direccion.tsx` ("use client"): input con espera de 500 ms que llama `/api/geocode?q=` (≥3 letras), lista hasta 5 resultados (`displayName`), al elegir devuelve `{ direccion, lat, lon }` por `onElegir`; muestra el costo con la misma `cotizarEnvio` sólo informativo. Errores 429/502 → «No pudimos buscar la dirección. Probá de nuevo en un momento.».
- [ ] Paso 3 de la pantalla: «Retiro en el local (gratis)» / «Envío a domicilio» (sólo si `oferta.envio`); con envío, buscador + costo + km; total actualizado.
- [ ] Seguimiento: si `delivery === "ENVIO"`, mostrar «Envío a: <dirección>». Resumen del trabajo (`pedido-del-trabajo.tsx`): entrega y dirección con enlace a mapa (`enlaceDeMapa` de `lib/geocode/lugar.ts`). Correo de confirmación al cliente: «Te lo enviamos a <dirección>» en vez de «listas para retirar». El correo al laboratorio NO cambia.
- [ ] Commit(s).

### Task 3: Pedir desde galerías

**Files:** `lib/galerias/publico.ts` (exportar la regla de originales); `lib/impresiones/fuentes-servidor.ts` (GALERIA); `app/w/[workspaceSlug]/galeria/[token]/imprimir/{page.tsx,actions.ts}`; botón en `components/galeria-publica/galeria-cliente.tsx` y `galeria-entrega.tsx`; `app/w/[workspaceSlug]/galeria/[token]/page.tsx` (pasar si hay oferta y fotos imprimibles).

- [ ] Exportar desde `lib/galerias/publico.ts` una función `idsImprimibles(workspaceId: string, resultadoToken)` (o exportar `idsDeOriginales`) sin cambiar su comportamiento para descargas.
- [ ] `resolverFuente(..., "GALERIA", token)`: `resolverTokenGaleria` → si no ok → null; fotos = `FotofficeGaleriaFoto` de la galería con id en imprimibles, `mediaType FOTO`, `status` lista; `key = originalKey`, `width/height` de la foto, `mini` = URL firmada de `thumbKey` (o `viewKey`) con `urlsDeLecturaPorLote`; `proyectoOrigenId = galeria.proyectoId`; `clientId = galeriaCliente.clientId`; nombre/email/teléfono del `galeriaCliente`. Si no hay fotos → null.
- [ ] `iniciarPagoImpresion` con GALERIA: `source: "GALERIA"`, `galeriaId`, ítems con `galeriaFotoId = id`, `archivoId = null`, `sourceKey = originalKey`. El cron ya lee por `sourceKey` (mismo bucket).
- [ ] Página `/w/[slug]/galeria/[token]/imprimir`: misma pantalla compartida con la fuente de galería; acción `iniciarPagoImpresionGaleriaAction`.
- [ ] Botón «Pedir copias impresas» en el encabezado de la galería del cliente (ambas vistas) cuando `ofertaPublica` no es null y hay ≥1 foto imprimible.
- [ ] Pruebas: foto no comprada rechazada; galería despublicada/revocada → null; ENTREGA → todas; VISTA → ninguna (sin botón); ítems con `galeriaFotoId`.
- [ ] Commit(s).

### Task 4: Salida

- [ ] Pruebas de `lib/impresiones`, `lib/galerias`, `lib/carpetas`; CI verde.
- [ ] Aplicar `20261128120000_fotoffice_impresion_envio_galerias` en FOTOFFICE (Neon `divine-hall-10689679`, rama `br-old-rain-adwthzng`) y registrarla con su sha256, antes de fusionar.
- [ ] PR, fusionar, verificar rutas en producción (`/w/<slug>/galeria/<token>/imprimir` inexistente → 404).
