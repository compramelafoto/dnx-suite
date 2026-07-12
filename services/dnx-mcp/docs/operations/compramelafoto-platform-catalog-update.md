# ComprameLaFoto — Actualización Platform Catalog (Vercel monorepo)

**Fecha:** 2026-07-07  
**Alcance:** solo `src/platforms/platforms/compramelafoto.ts`  
**Sin deploy · sin commit · sin consultas Git/Prisma/PostgreSQL/Vercel**

---

## Resumen

Se actualizó la definición de plataforma `compramelafoto` para que el pipeline de release apunte al **proyecto Vercel monorepo** y deje el proyecto legacy documentado como referencia, sin usarlo como target operativo.

| Campo                          | Antes                       | Después                       |
| ------------------------------ | --------------------------- | ----------------------------- |
| `vercelProject`                | `compramelafoto`            | **`compramelafoto-dnxsuite`** |
| `repository`                   | `dnx-studio/compramelafoto` | `compramelafoto/dnx-suite`    |
| `releasePolicy.allowedTargets` | `["production", "preview"]` | **`["preview"]`**             |
| Health endpoint name           | `api-health`                | `legacy-production-health`    |

---

## Proyectos Vercel

| Proyecto                      | Rol                               | Uso en release                                     |
| ----------------------------- | --------------------------------- | -------------------------------------------------- |
| **`compramelafoto-dnxsuite`** | Monorepo / staging                | ✅ **Target activo** — `vercelProject` del catalog |
| **`compramelafoto`**          | Legacy (repo standalone anterior) | ❌ **Solo referencia** — no staging, no release    |

El orquestador resuelve `platform.vercelProject` → invocaciones MCP Vercel (`vercel_status`, `vercel_prepare_staging`, etc.). Con este cambio, todas esas tools operan sobre **`compramelafoto-dnxsuite`**.

---

## Dominios

| Tipo                             | Dominios                                       | Política                                                       |
| -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| **Producción (legacy)**          | `compramelafoto.com`, `www.compramelafoto.com` | **NO TOCAR** — referencia en catalog; no son target de release |
| **Preview / staging (monorepo)** | `preview.compramelafoto.com`                   | Asociados al proyecto `compramelafoto-dnxsuite`                |

Los smoke tests y validaciones de staging usan `https://preview.compramelafoto.com` (y `/checkout`).

El health endpoint de producción (`compramelafoto.com/api/health`) se mantiene como **`legacy-production-health`** — monitoreo de referencia del sitio legacy, no del pipeline monorepo.

---

## Cambios en `releasePolicy`

```typescript
allowedTargets: ["preview"];
```

- **Preview/staging monorepo:** permitido.
- **Producción legacy:** excluida del pipeline hasta decisión explícita de cutover.

`requireStagingValidation` y `requireConfirmation` sin cambios.

---

## Archivos modificados

| Archivo                                     | Cambio                                                  |
| ------------------------------------------- | ------------------------------------------------------- |
| `src/platforms/platforms/compramelafoto.ts` | Definición de plataforma actualizada                    |
| `src/platforms/registry.test.ts`            | Expectativa `vercelProject` → `compramelafoto-dnxsuite` |

---

## Verificación

| Comando      | Resultado |
| ------------ | --------- |
| `pnpm check` | ✅ exit 0 |
| `pnpm build` | ✅ exit 0 |

---

## Próximos pasos (fuera de este cambio)

1. Dry-run real: `release_prepare` / `release_validate` con `platformId: "compramelafoto"` (dryRun).
2. Confirmar que Vercel API lista `compramelafoto-dnxsuite` y no invoca el proyecto legacy.
3. Commit del catalog cuando se apruebe.

---

## Restricciones respetadas

| Restricción                                   | Estado |
| --------------------------------------------- | ------ |
| No deploy                                     | ✅     |
| No commit                                     | ✅     |
| No modificar variables Vercel                 | ✅     |
| No tocar dominios en Vercel/DNS               | ✅     |
| No `release_prepare` / `release_validate`     | ✅     |
| No consultar Git / Prisma / PostgreSQL / logs | ✅     |

---

_Documento generado tras actualización del Platform Catalog. Sin operaciones en infraestructura._
