# Archivo — ComprameLaFoto monorepo stale (julio 2026)

**Fecha de archivo:** 2026-07-04  
**Tag pre-import:** `clf/monorepo-pre-legacy-import`

## Qué es esto

Copia de trabajo de ComprameLaFoto que vivía en `apps/compramelafoto` del monorepo DNX Suite **antes** de la migración desde el repositorio legacy de producción.

## Avisos importantes

- **Esta app no fue usada en producción.** No representa el estado del producto en Vercel ni en operación real.
- **Está desactualizada** respecto al código que corre hoy (~4 800 archivos vs ~1 370 en esta copia).
- **No es fuente de verdad** para funcionalidad, schema ni rutas.
- **La fuente de verdad** es el proyecto legacy en:

  ```
  /Users/danielcuart/Desktop/compramelafoto
  ```

## Uso permitido

Solo como **referencia puntual** para integración con el monorepo, por ejemplo:

- Patrones ya probados con `@repo/db`, `@repo/auth`, `@repo/design-system`
- `ComprameLaFotoDesignProvider`, menú fullscreen, `auth-bridge`
- Experimentos WIP (album packs, school-design) — **no** portar tal cual sin revisar legacy

## Qué no hacer

- No deployar desde esta carpeta
- No usar su `prisma/schema.prisma` como base del schema unificado
- No mezclar con el import del legacy sin seguir `docs/architecture/migration/05-import-map.md`

## Destino del import real

El código de producción se importará a `apps/compramelafoto/` (placeholder) según el plan de migración documentado en `docs/architecture/migration/`.
