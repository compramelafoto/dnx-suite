# Info Spot — Candidatos de contenido real (CLF)

**Fecha:** 2026-07-11  
**Fuente:** `@repo/db` (Neon staging `packages/db/.env`)  
**Script:** `pnpm --filter @repo/db exec tsx scripts/infospot-clf-candidates.ts`

## Resultado de la auditoría

| Métrica | Valor |
| --- | ---: |
| Eventos CLF totales | **0** |
| Álbumes | **0** |
| Fotos | **0** |
| Candidatos con fotos | **0** |

La base conectada tiene datos Info Spot (settings, categorías, DEMO) pero **no contiene eventos/álbumes/fotos de ComprameLaFoto**.

No se inventaron candidatos. No se publicó ni importó nada.

## Cómo re-auditar cuando haya datos CLF

```bash
pnpm --filter @repo/db exec tsx scripts/infospot-clf-candidates.ts
# o desde la UI Director:
# /redaccion/desde-clf
```

Criterios del listado (hasta 30):

- `archivedAt` null, no mergeados
- con álbumes no borrados y fotos `isRemoved=false`
- prioriza eventos ocurridos con más fotos
- reporta: eventId, nombre, fecha, ciudad, lugar, organizador, álbumes, fotos, fotógrafos, estado comercial aproximado, available/missing

## Columnas del reporte (cuando existan filas)

| Campo | Descripción |
| --- | --- |
| eventId | ID CLF |
| nombre | `Event.title` |
| fecha | `startsAt` |
| ciudad / lugar | `city` / `locationName` (no hay province en Event CLF) |
| organizador | creator name/email |
| albumCount / photoCount | counts |
| photographers | dueños de álbumes |
| commercialStatuses | AVAILABLE_OR_UNKNOWN / UNAVAILABLE |
| missing | campos faltantes |

## Acción editorial

1. Apuntar `DATABASE_URL` a un entorno con datos CLF reales (staging CLF / prod read-only).  
2. Re-ejecutar el script y pegar aquí la tabla de hasta 30 candidatos.  
3. En `/redaccion/desde-clf` (Director) crear borradores REAL uno a uno.  
4. Completar placeholders, fuente, fact-check y publicar manualmente.

## Plantillas generales creadas en paralelo

Ver script `scripts/infospot-seed-launch-templates.ts` — 8 borradores REAL con títulos `[PENDIENTE]` y checklist de fuentes, **sin hechos inventados**.
