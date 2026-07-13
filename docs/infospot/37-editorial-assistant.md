# 37 — Asistente Editorial

Wizard inteligente para preparar historias **antes** de escribir.

## Objetivo

El redactor no comienza en el editor TipTap. Primero organiza:

1. Qué quiere contar
2. Evento (si aplica)
3. Material editorial (coberturas)
4. Fotografías (portada / galería / insertables)
5. Datos mínimos del borrador
6. Resumen → Abrir editor

El editor solo sirve para escribir, insertar fotos, armar galerías y publicar.

## Arquitectura

| Pieza | Ubicación |
|-------|-----------|
| Ruta | `/redaccion/asistente` |
| Estado local | `localStorage` clave `infospot-editorial-assistant-v1` |
| Tipos / timeline / labels | `apps/infospot/lib/editorial-assistant/` |
| UI | `apps/infospot/components/redaccion/editorial-assistant/` |
| Commit a borrador | `commitEditorialAssistantAction` |
| Atajo legacy | `/redaccion/nueva?directo=1` (formulario vacío) |
| Default crear | `/redaccion/nueva` → redirect al asistente |

**Sin cambios de Prisma, workflow, permisos, sync CLF, ContentOrigin, distribución, geo ni producción.**

El artículo en DB se crea recién al **Abrir editor** o **Guardar para continuar después**.

## Timeline

Siempre visible (no “Paso X de Y”):

- Qué querés contar
- Evento
- Material editorial
- Fotografías
- Preparar borrador
- Editor

Según intención, se ocultan pasos irrelevantes (p. ej. noticia independiente salta evento/material/fotos).

## Flujos

### Completo (evento)

Intent → Evento → Material → Fotos → Borrador → Resumen → Editor

### Cobertura / galería

Intent → Material (prefiltrado) → Fotos → Borrador → Resumen → Editor

### Independiente

Intent → Borrador → Resumen → Editor

### Accesos rápidos

| Origen | Deep link |
|--------|-----------|
| Material → Crear historia | `/redaccion/asistente?intent=coverage&coverageId=…` |
| Evento (CLF id) | `/redaccion/asistente?intent=event&eventId=…` |
| Artículo → Agregar material | `/redaccion/asistente?mode=photos&articleId=…` |

## Material Editorial

Lenguaje periodístico: **coberturas fotográficas**, no “álbum”.

Agrupación visual:

1. Coberturas (selección múltiple)
2. Fotógrafos derivados
3. Resumen dinámico de fotografías disponibles

Datos: `listCoveragesForCenter` (SSR) + APIs existentes de fotos editoriales.

## Fotografías

Grid tipo Photos/Lightroom:

- Lazy loading + skeleton
- Zoom modal
- Selección múltiple con checkbox
- Roles: ★ Portada · ▣ Galería · ¶ Insertar
- Panel inferior fijo con contadores

Al commit: `selectEditorialPhoto` por cada foto (pipeline editorial-photos).

## Autosave

Cada cambio del wizard se persiste en `localStorage`.

Si hay trabajo pendiente al volver:

> Tenés un trabajo pendiente. · Continuar · Descartar

No se pierde evento, coberturas ni fotografías seleccionadas.

## Preparación del editor

`commitEditorialAssistantAction`:

1. Crea borrador (`createArticleFromCoverage` o `infoSpotArticle.create`)
2. Vincula evento / coberturas adicionales
3. Selecciona fotos con roles
4. Redirige a `/redaccion/noticias/{id}/editar?from=asistente`

El drawer derecho muestra `AssistantPreparedPanel` (evento, material, fotos, autor). SEO y publicación siguen en el panel existente del editor (no se repreguntan en el wizard).

## Decisiones UX

| Antes | Después |
|-------|---------|
| Abrir editor vacío | Preparar historia con asistente |
| Buscar álbum/evento a mano | Descubrir material agrupado |
| Muchos campos técnicos al crear | Solo título, bajada, autor, tipo |
| “Paso 3 de 6” | Timeline periodístico |
| Términos Article / Album / Sync | Historia / Cobertura / Material |

## Lenguaje

**No usar en UI:** Álbum, Sync, Article, Workflow, ContentOrigin.

**Sí:** Historia, Cobertura, Material Editorial, Fotografías, Evento.

## Responsive

Layout: timeline lateral en `lg+`; stack en móvil. Breakpoints objetivo: 390 / 768 / 1280 / 1440.

## Accesibilidad

- Timeline con `aria-current="step"`
- Listbox / option en eventos y fotos
- Diálogos con Escape (zoom)
- Focus visible en cards y botones
- Contadores con `aria-live`

## Tests

```bash
pnpm --filter infospot test:editorial-assistant
pnpm --filter infospot test:editorial-photos
pnpm --filter infospot test:editorial-workflow
```

## QA UX (comparativa)

| Métrica | Antes (estim.) | Después (objetivo) |
|---------|----------------|--------------------|
| Clics hasta escribir | 8–15 | 4–7 |
| Decisiones técnicas | Altas (slug, SEO, CLF…) | Bajas (tipo + título) |
| Tiempo a primer párrafo | Largo | Tras resumen |
| Carga cognitiva | Formulario admin | Asistente periodístico |

## Riesgos

- CLF readonly offline: eventos se arman desde coberturas locales.
- Dos pipelines de fotos (legacy picker vs editorial-photos): el wizard usa editorial-photos.
- `?directo=1` sigue disponible para power users.
