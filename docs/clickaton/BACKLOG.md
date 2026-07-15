# Clickaton — backlog (sin implementar)

Pendientes registrados en Etapa 01. **No definir porcentajes ni reglas económicas todavía.**

## A. Integración con FotoRank

Auditoría Etapa 07: [FOTORANK_REAL_INTEGRATION_AUDIT.md](./FOTORANK_REAL_INTEGRATION_AUDIT.md) · mapeo [FOTORANK_FIELD_MAPPING.md](./FOTORANK_FIELD_MAPPING.md).

### Plan post-auditoría

- ~~**08A** Serializers / DTO públicos seguros (FR)~~ → `apps/fotorank/app/lib/public-api/v1/`
- ~~**08B** Route Handlers públicos v1 (listado + detalle)~~ → `GET /api/public/v1/events` · `GET /api/public/v1/events/[slug]` (ruta genérica `events`, no `marathons`)
- ~~**08C** Endpoint ficha pública v1~~ → absorbido en 08B (mismo detalle por slug)
- **08D** Adaptador HTTP `PublicMarathonDataSource` en Clickaton (server-to-server; sin CORS navegador)
- **08E** Caché e invalidación (tags; hoy solo `Cache-Control` corto en FR)
- **09** Sesión Identity + eligibility
- **10** Inscripción real
- **11** Pagos (DNX Payments / MP)
- **12** Área del participante
- **13** Consignas + release server-side
- **14** Resultados + galería públicos
- **15** GPS/EXIF + sedes

### Capacidad producto (sigue pendiente)

- Catálogo de maratones reales
- Página pública de evento (datos vivos)
- Inscripciones
- Pagos
- Participantes
- Cuenta del participante
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

Documentado como pendiente para la preventa (no implementar en esta etapa):

- Catálogo
- Variantes
- Talles
- Colores
- Personalización con nombres
- Previsualización
- Carrito
- Pedidos
- Integración con Dreamful / Tiendanube
- Exportación operativa a Google Sheets
- Costos de producción
- Comisiones de Mercado Pago
- Distribución de margen entre Daniel, Rodir y Tammy
- Liquidaciones mediante DNX Payments

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
- Eventos / maratones reales desde FotoRank
- Inscripción real
- Programa real de sedes (postulación y acompañamiento)
- Propuesta comercial de sponsors (sin planes inventados todavía)
- Aprobación del relato de origen y presentación de socios
- Canales de contacto y redes oficiales
- Páginas legales (términos / privacidad)
- Tienda y merchandising para preventa
- Galería / resultados / ranking públicos (payload real)
- Blog / CMS editorial
- Adaptador API FotoRank que implemente `PublicMarathonDataSource`
- Consumo UI de `PublicRegistrationOffer` / `RegistrationEligibility` / results / gallery
- Suite de tests unitarios en Clickaton (hoy sin infra de test)
- URL canónica de inscripción + Identity

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
