# `@repo/content`

Núcleo CMS compartido de DNX Suite (modelos Prisma `Blog*`, scope por `platform`).

## Arquitectura — Alternativa C

Helpers puros + funciones de repositorio Prisma que **exigen** `platform: ContentPlatform` y aceptan un `PrismaClient` inyectado.

- Sin plataforma por defecto en el paquete (cada app inyecta la suya).
- Sin dependencia circular con `@repo/auth`: lista local `CONTENT_PLATFORMS` alineada con los ids lowercase de apps DNX (`compramelafoto`, `clickaton`, `fotorank`, `fotoffice`).
- Info Spot **no** es destino de publicación del CMS; solo existe un contrato tipado futuro (`SubmitContentToInfoSpotInput`).
- No emite eventos de DNX Communications; solo tipos (`ContentEventType` / `ContentEventPayload`).

## Qué incluye

- Plataforma, errores de dominio, slugs, TipTap→HTML + sanitize, reading time
- Validación Zod de post/categoría/tag/autor (sin campo `platform` en payloads de cliente)
- Queries/persistencia scoped por plataforma
- Helpers SEO genéricos (sin branding hardcodeado)
- Contratos tipados: storage, eventos, Info Spot

## Qué no incluye

- Páginas Next.js, rutas API, componentes React, CSS/branding
- Guards/auth de app, cookies de vistas, newsletter / `BlogSubscriber`
- Implementación R2, variables de entorno
- Integración real con Info Spot o Communications
- `@repo/content-ui`
