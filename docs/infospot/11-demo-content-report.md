# Info Spot — Reporte de contenido DEMO (PASO 9)

**Fecha:** 2026-07-11  
**Base auditada:** staging (`packages/db` / Neon del `.env` local)  
**Acción:** no se borró nada automáticamente.

## Resumen

| Tipo | Total | DEMO | REAL | PUBLISHED + DEMO |
| --- | ---: | ---: | ---: | ---: |
| Artículos | 5 | 5 | 0 | 5 |
| Eventos | 8 | 8 | 0 | 8 |

Con el filtro público `status=PUBLISHED` + `contentTag=REAL`, **ningún DEMO sale al sitio** aunque siga `PUBLISHED` en DB.

## Artículos DEMO

| Título | Tipo | Slug | Estado | Imagen | Motivo | Acción recomendada |
| --- | --- | --- | --- | --- | --- | --- |
| Arranca Info Spot en la escena local | artículo | `arranca-info-spot-escena-local` | PUBLISHED / DEMO | sin portada | Seed demo | Archivar o despublicar; no marcar REAL |
| Agenda deportiva del fin de semana | artículo | `agenda-deportiva-fin-de-semana` | PUBLISHED / DEMO | sin portada | Seed demo | Archivar o despublicar |
| Cultura en la plaza: feria y música en vivo | artículo | `cultura-plaza-feria-musica` | PUBLISHED / DEMO | sin portada | Seed demo | Archivar o despublicar |
| Fotografía de eventos: tips… | artículo | `fotografia-eventos-tips` | PUBLISHED / DEMO | sin portada | Seed demo | Archivar o despublicar |
| Qué eventos mirar esta semana | artículo | `que-eventos-mirar-esta-semana` | PUBLISHED / DEMO | sin portada | Seed demo | Archivar o despublicar |

Autor de las 5: usuario real de seed (`Daniel Cuart` / director). No son autores ficticios inventados, pero el **contenido** es demo.

## Eventos DEMO

| Título | Tipo | Slug | Estado | Imagen | Motivo | Acción recomendada |
| --- | --- | --- | --- | --- | --- | --- |
| Clásico barrial: Atlético Norte vs Sur | evento | `demo-clasico-barrial-atletico` | PUBLISHED / DEMO | sin cover | Seed demo | Archivar / reemplazar por REAL |
| Feria de diseño independiente | evento | `demo-feria-diseno-independiente` | PUBLISHED / DEMO | sin cover | Seed demo | Archivar / reemplazar |
| Recital al aire libre: Noche de bandas | evento | `demo-recital-noche-bandas` | PUBLISHED / DEMO | sin cover | Seed demo | Archivar / reemplazar |
| Carrera 10K Costanera | evento | `demo-carrera-10k-costanera` | PUBLISHED / DEMO | sin cover | Seed demo | Archivar / reemplazar |
| Rally regional: etapa de montaña | evento | `demo-rally-etapa-montana` | PUBLISHED / DEMO | sin cover | Seed demo | Archivar / reemplazar |
| Workshop de fotografía de eventos | evento | `demo-workshop-fotografia-eventos` | PUBLISHED / DEMO | sin cover | Seed demo | Archivar / reemplazar |
| Torneo escolar de básquet | evento | `demo-torneo-escolar-basquet` | PUBLISHED / DEMO | sin cover | Seed demo + **pasado** | Archivar (no mostrar como próximo) |
| Muestra fotográfica: Miradas del barrio | evento | `demo-muestra-miradas-barrio` | PUBLISHED / DEMO | sin cover | Seed demo | Archivar / reemplazar |

## Stock editorial

| Recurso | Ubicación | Estado | Acción |
| --- | --- | --- | --- |
| `/public/editorial-stock/*.jpg` | assets locales | disponibles | No usar como cover anónimo en prod; solo si se identifica explícitamente |
| Fallback stock en cards | desactivado por defecto | OK | `forceEditorialStock=false`; sin cover → sin imagen |

## Settings institucionales (raw DB)

| Campo | Valor | Bloqueo |
| --- | --- | --- |
| contactEmail | null | **BLOCK** |
| pressEmail | null | **BLOCK** |
| publicUrl | null | **BLOCK** (si no hay `NEXT_PUBLIC_INFOSPOT_URL`) |
| baseCity | null | **BLOCK** |
| country | Argentina | OK |
| institutionalText | null | **BLOCK** (UI usa default hasta guardar) |
| seoDescription | presente | OK |
| defaultShareImageUrl | null | **BLOCK** (UI usa `/brand/og-default.png` hasta guardar) |
| redes | todas null | **WARN** |

## Contenido REAL cargado

**0 noticias REAL · 0 eventos REAL.**  
Listo el panel `/redaccion` + plantilla en `docs/infospot/12-editorial-load-template.md` para cargar las ~20 noticias reales.

## Re-auditoría

```bash
pnpm --filter @repo/db exec tsx scripts/infospot-demo-audit.ts
```
