# ComprameLaFoto — Seed mínimo de staging

**Fecha:** 2026-07-09  
**Monorepo:** `dnx-suite` → `apps/compramelafoto/scripts/staging/seed-minimal.ts`  
**Base objetivo:** Neon staging de `compramelafoto-dnxsuite` (preview)  
**Restricciones:** no producción, no DNS, no deploy, no modificar schema

---

## Objetivo

Poblar la base **staging** con datos mínimos e idempotentes para pruebas manuales de:

| Flujo               | Qué habilita                                             |
| ------------------- | -------------------------------------------------------- |
| Login               | Usuario fotógrafo + admin con password bcrypt            |
| Dashboard fotógrafo | `PhotographerSalesSettings`, perfil y álbum propio       |
| Home con álbumes    | 1 álbum público visible en `/api/public/albums`          |
| Galería pública     | 3 fotos placeholder con `previewUrl` HTTPS               |
| Blog controlado     | 1 post `PUBLISHED` con `noIndex: true` (opcional omitir) |
| Checkout básico     | Venta digital activa (términos + precio); sin MP real    |

---

## Archivo del script

```
dnx-suite/apps/compramelafoto/scripts/staging/seed-minimal.ts
```

- Usa `@repo/db` (`prisma` compartido del monorepo).
- Idempotente: `upsert` por email/slug; fotos por `originalKey` estable.
- Guardas de seguridad antes de escribir.

---

## Datos que crea o asegura

### Usuarios

| Email                            | Rol            | Notas                      |
| -------------------------------- | -------------- | -------------------------- |
| `fotografo.staging@clf.dnx.test` | `PHOTOGRAPHER` | Cuenta principal de prueba |
| `admin.staging@clf.dnx.test`     | `ADMIN`        | Acceso panel admin         |

**Password por defecto (solo staging):** `StagingClf2026!`  
Override opcional: `CLF_STAGING_SEED_PASSWORD` (no commitear).

Ambos usuarios reciben `emailVerifiedAt` para evitar bloqueos de verificación.

### Perfil comercial fotógrafo

- `PhotographerSalesSettings`: digital habilitado, impresiones off.
- `defaultDigitalPhotoPrice`: 5000 (centavos ARS).
- `publicPageHandler`: `staging-clf-fotografo`.
- `isPublicPageEnabled` + `enableAlbumsPage`: true.

### AppConfig (id=1)

- `minDigitalPhotoPrice`: 5000
- `platformCommissionPercent`: 10
- `maintenanceMode`: false

### Álbum público

| Campo                              | Valor                         |
| ---------------------------------- | ----------------------------- |
| `publicSlug`                       | `staging-clf-demo-album`      |
| `title`                            | Álbum demo staging CLF        |
| `isPublic` / `isHidden` / `isTest` | true / false / false          |
| `enableDigitalPhotos`              | true                          |
| `enablePrintedPhotos`              | false                         |
| `digitalPhotoPriceCents`           | 5000                          |
| `termsVersion`                     | `2026-01-26` (alineado a app) |
| `expiresAt`                        | +2 años                       |

### Fotos (×3)

Placeholders HTTPS (`placehold.co`), keys simuladas bajo `staging/clf-minimal-v1/photo-0N.jpg`.  
No sube archivos a R2; sirven para listado y flujo de carrito/checkout digital.

La primera foto se asigna como `coverPhotoId`.

### Blog (opcional)

| Campo     | Valor                     |
| --------- | ------------------------- |
| `slug`    | `staging-clf-bienvenida`  |
| `status`  | `PUBLISHED`               |
| `noIndex` | true (controlado, no SEO) |
| Categoría | `staging-clf`             |
| Autor     | `staging-clf-equipo`      |

Omitir blog: `CLF_STAGING_SEED_SKIP_BLOG=1`.

---

## Guardas de seguridad

El script **aborta** si:

1. `ALLOW_CLF_STAGING_MINIMAL_SEED` ≠ `1`
2. `VERCEL_ENV=production`
3. `DATABASE_URL` ausente o con patrones de host producción (`prod`, `production`, etc.)

**No ejecutar** con URLs de la base productiva legacy ni del branch main de Neon prod.

---

## Cómo ejecutarlo manualmente (staging)

### 1. Obtener URLs de staging

Copiar `DATABASE_URL` y `DIRECT_URL` desde:

- Vercel → proyecto `compramelafoto-dnxsuite` → Environment Variables → **Preview**, o
- `dnx-mcp/.env.local` (Neon staging, p. ej. host `ep-round-fog-a4xgibtv`)

### 2. Prerequisitos

- Migraciones staging aplicadas (incl. blog gap `20260706190000_add_clf_blog_marketing_gap`).
- `pnpm install` en la raíz del monorepo.
- Cliente Prisma generado: `pnpm --filter @repo/db run db:generate`

### 3. Comando (desde monorepo)

```bash
cd "/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite/apps/compramelafoto"

# Exportar credenciales staging (no commitear):
export DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"
export DIRECT_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"
export ALLOW_CLF_STAGING_MINIMAL_SEED=1

# El script no carga .env automáticamente; las variables deben estar en el shell.

# Opcional:
# export CLF_STAGING_SEED_PASSWORD="tu-password-staging"
# export CLF_STAGING_SEED_SKIP_BLOG=1
# export NEXT_PUBLIC_APP_URL="https://compramelafoto-dnxsuite-….vercel.app"

pnpm exec tsx scripts/staging/seed-minimal.ts
```

### 4. Salida esperada

Al finalizar imprime en **terminal local**:

- emails fotógrafo y admin
- password en claro
- URLs de galería, API home y blog

No guardar esa salida en commits ni en tickets públicos.

---

## Verificación manual post-seed

| Check           | URL / acción                                                                |
| --------------- | --------------------------------------------------------------------------- |
| Login fotógrafo | `/login` con `fotografo.staging@clf.dnx.test`                               |
| Dashboard       | `/fotografo` tras login                                                     |
| Home álbumes    | `/` o `GET /api/public/albums` → 1 álbum                                    |
| Galería         | `/a/staging-clf-demo-album`                                                 |
| Blog            | `/blog` y `/blog/staging-clf-bienvenida`                                    |
| Checkout        | Agregar digital al carrito → crear pedido (MP sandbox o sin completar pago) |

---

## Re-ejecución

Seguro ejecutar de nuevo: actualiza usuarios, álbum, fotos existentes y post de blog sin duplicar filas (claves estables por email/slug/`originalKey`).

---

## Relacionado

- [`compramelafoto-staging-database-setup.md`](./compramelafoto-staging-database-setup.md)
- [`compramelafoto-blog-migration-staging-apply.md`](./compramelafoto-blog-migration-staging-apply.md)
- [`compramelafoto-preview-runtime-diagnostic.md`](./compramelafoto-preview-runtime-diagnostic.md)
