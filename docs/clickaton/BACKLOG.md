# Clickaton — backlog (sin implementar)

Pendientes registrados en Etapa 01. **No definir porcentajes ni reglas económicas todavía.**

## A. Integración con FotoRank

Auditoría Etapa 07: [FOTORANK_REAL_INTEGRATION_AUDIT.md](./FOTORANK_REAL_INTEGRATION_AUDIT.md) · mapeo [FOTORANK_FIELD_MAPPING.md](./FOTORANK_FIELD_MAPPING.md).

### Plan post-auditoría

- ~~**08A** Serializers / DTO públicos seguros (FR)~~ → `apps/fotorank/app/lib/public-api/v1/`
- ~~**08B** Route Handlers públicos v1 (listado + detalle)~~ → `GET /api/public/v1/events` · `GET /api/public/v1/events/[slug]` (ruta genérica `events`, no `marathons`)
- ~~**08C** Endpoint ficha pública v1~~ → absorbido en 08B (mismo detalle por slug)
- ~~**08D** Adaptador HTTP `PublicMarathonDataSource` en Clickaton (server-to-server; sin CORS navegador)~~ → `data/public-marathons/*` + [`FOTORANK_PUBLIC_INTEGRATION.md`](./FOTORANK_PUBLIC_INTEGRATION.md)
- **08E** Caché e invalidación (tags; hoy `revalidate=60` + Cache-Control FR)
- **09A** Tipo de experiencia (`CONTEST`/`MARATHON`) + consolidación canal Clickatón (`MARATHON`+`CLICKATON`) + contratos públicos free/paid (sin cobros) → migraciones canal + experienceType · [`FOTORANK_PUBLIC_INTEGRATION.md`](./FOTORANK_PUBLIC_INTEGRATION.md) · [`STAGE_09_PAID_REGISTRATION_AND_MERCHANDISING.md`](./STAGE_09_PAID_REGISTRATION_AND_MERCHANDISING.md)
- **09B** Checkout transaccional: admin cobro, órdenes, productos/variantes/stock, MP, webhook, idempotencia
- **09C** Split, collector organizador, comisiones por línea, devoluciones, conciliación, panel económico
- **10** Sesión Identity + eligibility (acoplado al handoff 09A / checkout 09B)
- **11** Área del participante
- **12** Consignas + release server-side
- **13** Resultados + galería públicos
- **14** GPS/EXIF + sedes

### Capacidad producto (sigue pendiente)

- Catálogo de maratones reales (canal Clickatón)
- Página pública de evento (datos vivos)
- Inscripciones free/paid (09A contratos → 09B checkout)
- Merchandising opcional en checkout (09B)
- Pagos / split (09B–09C)
- Participantes + cuenta del participante
- Consignas
- GPS y EXIF
- Jurados (público)
- Ranking
- Resultados

## B. Preventa

- Campaña de lanzamiento
- Inscripción a primera edición
- Lista de espera
- Cupones o beneficios fundadores
- Mercado Pago
- Confirmaciones y emails

## C. Merchandising

Alcance producto alineado a Etapa 09 ([STAGE_09…](./STAGE_09_PAID_REGISTRATION_AND_MERCHANDISING.md)):

- **09A** Contratos públicos (`hasOptionalMerchandise`, precios, checkoutUrl) — sin catálogo operativo
- **09B** Catálogo evento/global, variantes (talle/color/pack…), stock + reserva, checkout unificado con inscripción, fulfillment v1 = retiro en acreditación
- **09C** Comisiones por línea, liquidaciones, reportes

Pendientes adicionales (no bloquean 09B):

- Personalización con nombres / previsualización
- Envíos a domicilio (zonas, transportistas, tracking)
- Integración con Dreamful / Tiendanube (opcional)
- Exportación operativa a Google Sheets
- Costos de producción internos

## D. Comunidad

- Perfiles
- Insignias
- Ranking
- Galería georreferenciada
- Hall de la Fama
- Historias
- Contenido pedagógico

## E. Red de sedes

- Organizadores regionales
- Permisos por ciudad
- Sponsors locales
- Check-in
- Liquidaciones y comisiones
- Manual operativo

## F. Panel admin Clickatón

- ~~**10A** Auditoría panel + menú MVP~~
- ~~**10B** Shell `/admin`, auth DNX, empty states, integraciones informativas~~ → [ADMIN_PANEL.md](./ADMIN_PANEL.md)
- **10C** Modelo y CRUD mínimo de ediciones y sedes
- **10D** Inscripciones operativas (acreditación / QR / check-in / kit) + lectura Payments
- **10E** Sponsors (CRM básico, sin portal)
- Migrar allowlist admin → `appAccess` `CLICKATON` cuando WorkspaceAppAccess vuelva al schema
- DNX Communications / email marketing — **Etapa 2** (fuera del MVP)

## Branding / producto

- ~~Manual de marca + lámina de logo en `/public/brand/`~~ (Etapa 01 DS V1)
- ~~Tokens alineados al Manual (`#FFC400`, Bebas Neue, Montserrat)~~
- ~~Logo / Wordmark oficiales en chrome~~
- Entregar SVG vectoriales definitivos del estudio (reemplazar PNG de lámina)
- Favicon vectorial definitivo (hoy: isotipo + SVG provisional de reloj)
- Iconografía definitiva (set propio, no Material)
- Componentes restantes del DS (inputs, modal, tabs, toast, tables, commerce cards)
- Fotografías reales de ediciones (sin stock externo)
- Confirmar dominio público y URL canónica → **hecho:** `https://maratonfotografica.com`
- Activar indexación (robots) en lanzamiento (hoy: noindex)
- Definir slogan definitivo y perfiles / redes sociales
- Newsletter funcional
- Contacto funcional (sin captura ficticia)
- CMS editorial (opcional)
- Imágenes Open Graph oficiales

## Home pública / producto (post Etapa 03–05)

- ~~Ficha pública `/maratones/[slug]` (Etapa 05)~~ → demo en `/maratones/demo`
- Eventos / maratones reales desde FotoRank (canal `clickaton`)
- Inscripción free/paid + handoff (09A) → checkout real (09B)
- Programa real de sedes (postulación y acompañamiento)
- Propuesta comercial de sponsors (sin planes inventados todavía)
- Aprobación del relato de origen y presentación de socios
- Canales de contacto y redes oficiales
- Páginas legales (términos / privacidad)
- Merchandising opcional en checkout (09B); tienda standalone opcional después
- Galería / resultados / ranking públicos (payload real)
- Blog / CMS editorial
- Consumo UI de `PublicRegistrationOffer` / `PublicRegistrationSummary` / eligibility / results / gallery
- Suite de tests unitarios en Clickaton (hoy sin infra de test)
- URL canónica de inscripción / checkout + Identity

## Design System (post-MVP)

Documentado en [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md). Pendientes sin implementar:

- Componentes de formularios (input, select, checkbox, etc.)
- Componentes de eventos / EventCard definitiva
- Componentes de inscripción
- Componentes de tienda / merchandising
- Componentes de ranking
- Modal, drawer, tabs, toast y demás UI especulativa
- Motion avanzado (scroll observers, parallax)
- Storybook — solo si el volumen futuro lo justifica
- Extracción a package compartido — solo si hay reutilización externa real
