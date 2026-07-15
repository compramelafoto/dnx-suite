# Clickaton — arquitectura de acceso a datos públicos

## 1. Páginas

Las rutas públicas (`/maratones`, `/maratones/[slug]`) consumen **solo** el servicio:

`@/data/public-marathons`

No importan fixtures ni conocen FotoRank/Prisma.

## 2. Servicio público

`data/public-marathons/service.ts`

- `listPublicMarathons()` — catálogo anunciado (sin demos)
- `getPublicMarathonBySlug(slug)` — ficha routable (incluye demo técnica)
- `listRoutableMarathonSlugs()` — SSG
- ofertas / capabilities / results / gallery — preparados; fuente local devuelve `null`

Sustitución futura: `setPublicMarathonDataSource(fotorankSource)`.

## 3. Fuente local

`data/public-marathons/local-source.ts` + fixture `content/fixtures/demo-marathon.ts`

Flujo por ítem: `clone → normalize → sanitize → visibility filter`.

## 4. Futuro adaptador FotoRank

Misma interfaz `PublicMarathonDataSource`.

Responsabilidades del adaptador:

1. Fetch / client HTTP hacia API pública de FotoRank (aún no existe; recomendada en Etapa 07: `/api/public/v1/...` en `apps/fotorank`).
2. Mapear DTO → contratos Clickaton (`PublicMarathon`, satélites).
3. Delegar normalización y sanitizado compartidos.
4. Propagar errores tipados (`NotFound`, `PayloadInvalid`, `SourceUnavailable`).
5. Nunca mezclar datos autenticados en respuestas públicas.
6. **No** importar Prisma ni `@repo/db` desde Clickaton.

Hallazgos de código real: [FOTORANK_REAL_INTEGRATION_AUDIT.md](./FOTORANK_REAL_INTEGRATION_AUDIT.md) · mapeo [FOTORANK_FIELD_MAPPING.md](./FOTORANK_FIELD_MAPPING.md).

Arquitectura recomendada (Etapa 07): Route Handlers públicos en FotoRank + adaptador HTTP en Clickaton. Alternativa: paquete `@repo/fotorank-public` (mayor acoplamiento de versión).

**Etapa 08A (hecha en FotoRank):** contratos + serializers + loaders en `apps/fotorank/app/lib/public-api/v1/` (`FotorankPublicEventV1`). Aún sin HTTP ni adaptador Clickaton.

No crear stub Clickaton hasta Etapa 08D.

## 5. Contratos

Ver [FOTORANK_INTEGRATION_CONTRACT.md](./FOTORANK_INTEGRATION_CONTRACT.md).

Estructural: `PublicMarathon` · Satélites: `types/public/*`.

## 6. Normalización

`normalizePublicMarathon`:

- valida estados/formatos/dispositivos conocidos;
- garantiza arrays;
- valida fechas ISO;
- no inventa copy, ciudades ni precios;
- lanza `PublicMarathonPayloadError` si el payload es inválido.

## 7. Filtrado de seguridad

`sanitizePublicMarathon` (servidor, antes de UI):

- consignas: solo liberadas (`lib/challenges.ts`);
- cronograma: solo ítems públicos (`isScheduleItemPublic`);
- sin emails/notas internas en el contrato público.

La UI puede volver a filtrar de forma idempotente; la seguridad no depende de eso.

## 8. Caching futuro (sin implementar)

Detalle ampliado en la auditoría Etapa 07 §19.

| Recurso | Idea |
|---------|------|
| Listado | `revalidate` periódico o tag `marathons:list` (60–300s) |
| Ficha | tag `marathon:{slug}` |
| Offer / cupos | TTL corto (15–60s) |
| Consignas liberadas | invalidación inmediata; TTL corto; revalidar en `releaseAt` |
| Resultados / galería | invalidar al publicar / retractar |
| Datos personalizados | **nunca** en caché pública compartida |

## 9. Datos públicos versus autenticados

Público (esta capa): ficha, listado, oferta anónima, resultados/galería publicados.

Autenticados (fuera de alcance): elegibilidad, mi inscripción, pago, QR, equipo, mis fotos → DNX Identity + endpoints protegidos FotoRank.

## 10. Migración fixture → API

1. Mantener `PublicMarathonDataSource`.
2. Implementar `fotorankPublicMarathonDataSource`.
3. Mapear DTO → `normalizePublicMarathon` → `sanitizePublicMarathon`.
4. Registrar la fuente en el servicio (env / flag).
5. Retirar fixture del build de producción cuando existan ediciones reales.
6. Conservar demo solo en desarrollo si aporta valor.

## Visibilidad

`getPublicMarathonVisibility`:

| Flag | Demo | Draft | Cancelled | Resto público |
|------|------|-------|-----------|---------------|
| listed | no | no | no | sí |
| routable | sí | no | no | sí |
| indexable | no | no | no | sí (cuando el sitio deje noindex global) |
