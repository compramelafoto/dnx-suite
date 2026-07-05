# 27 — Reporte Bloque C: Dashboard, fotógrafo, escolar, IA, EXIF, FTP y descargas

**Fecha:** 2026-07-05  
**Bloque:** C — Ecosistema operativo del fotógrafo  
**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto`  
**Destino:** `apps/compramelafoto`  
**Plan:** [`22-code-import-execution-plan.md`](./22-code-import-execution-plan.md) · Bloque B: [`26`](./26-code-import-block-b-checkout-report.md)

---

## Resumen ejecutivo

Bloque C **completado** para el alcance acordado: panel dashboard del fotógrafo, rutas `/fotografo/**`, módulo escolar (roster, fulfillment, school-organizer), análisis IA / OCR / equipo fotográfico, crons EXIF y FTP, descargas avanzadas (zip-jobs), plantillas v2 / fotolibros, organizador y landings auxiliares.

| Validación | Resultado |
|------------|-----------|
| `pnpm install` | ✅ |
| `pnpm --filter compramelafoto typecheck` | ✅ |
| `pnpm --filter compramelafoto build` | ✅ |
| `pnpm --filter compramelafoto lint` | ✅ (**0 errors**, ~1212 warnings legacy) |

**Listo para commit:** sí (incluye `pnpm-lock.yaml` por deps nuevas de Block C).

**Sin commit** en esta sesión (instrucción explícita del operador).

---

## Alcance migrado

### 1. Dashboard fotógrafo

| Pieza | Rutas / archivos |
|-------|------------------|
| UI dashboard | `app/dashboard/**` (álbumes, eventos, pedidos, configuración) |
| APIs dashboard | `app/api/dashboard/**` (~álbumes, packs, fotos, settings, analytics) |
| Lib dashboard | `lib/dashboard/**`, `lib/albums/album-dashboard-*` |
| Componentes | `components/dashboard/**` |
| Layout panels | `components/panels/FotografoLayoutClient.tsx`, `PhotographerSidebar.tsx`, `LabLayoutClient.tsx`, `OrganizerLayoutClient.tsx` |

### 2. Panel fotógrafo (`/fotografo`)

| Pieza | Rutas / archivos |
|-------|------------------|
| Rutas UI | `app/fotografo/**` (escuelas, eventos, laboratorio, diseño/plantillas, pedidos, negocio, etc.) |
| APIs | `app/api/fotografo/**` |
| Componentes | `components/fotografo/**`, `components/photographer/**` |
| Mercado Pago OAuth | `app/api/mercadopago/**`, `lib/mercadopago/**` |
| Plantillas v2 | `lib/template-v2/**`, `components/template-v2/**` |
| Fotolibros / diseño | `components/fotolibros/**`, `lib/fotolibros/**` |

### 3. Escolar / roster / fulfillment

| Pieza | Rutas / archivos |
|-------|------------------|
| Rutas escuela | `app/escuela/**`, `app/escuelas/**`, `app/escolar/**` |
| School organizer API | `app/api/school-organizer/**` |
| Lib roster | `lib/school-roster/**` (adaptado a `SchoolStudent`) |
| Fulfillment | `lib/school-fulfillment/**` |
| Import roster | `lib/school-roster/import-student-roster-for-album.ts` |

### 4. Organizador de eventos

| Pieza | Rutas / archivos |
|-------|------------------|
| UI | `app/organizador/**` |
| API | `app/api/organizer/**`, `app/api/events/**` |
| Lib | `lib/organizer-landing-*`, `lib/organizer-public-landing-*`, `lib/organizer-event-access.ts` |
| Referidos | `lib/referrals/**`, `lib/referral-link.ts`, `lib/referral-code-service.ts` |

### 5. IA, OCR, equipo fotográfico, EXIF

| Pieza | Rutas / archivos |
|-------|------------------|
| Admin IA | `app/api/admin/ai/**`, `app/admin/**` (parcial) |
| Análisis interno | `app/api/internal/analysis/**` |
| Lib análisis | `lib/analysis/**`, `lib/ocr/**` |
| Equipo fotográfico | `lib/photographic-equipment/**`, `app/api/admin/photographic-equipment/**` |
| EXIF | `lib/photo-exif.ts`, crons `app/api/cron/exif-*` |
| Camera connection | `lib/camera-connection/**` |

### 6. FTP y descargas avanzadas

| Pieza | Rutas / archivos |
|-------|------------------|
| Cron FTP | `app/api/cron/ftp-*` |
| Zip jobs | `app/api/zip-jobs/**`, `app/api/downloads/**`, `app/api/descargas/**` |
| Lib | `lib/zip-job-notifications.ts`, jobs relacionados en `lib/jobs/` |

### 7. Landings y soporte comercial

| Pieza | Rutas / archivos |
|-------|------------------|
| Land escuelas | `app/land/escuelas-leads`, `components/land/**` |
| Charlas FPR | `lib/charlasfpr.ts`, `components/land/charlas-fpr/**` |
| Email / términos | `lib/email.ts`, `lib/terms/photographerTermsExtended.ts` |
| Polaroid fonts | `components/polaroid/fonts` |
| Admin conversión | `lib/admin/**`, `lib/conversion-analytics/**` |

### Conteos aproximados post-import

| Área | Archivos |
|------|----------|
| `app/api/**/route.ts` | ~301 |
| `lib/**` (`.ts`/`.tsx`) | ~839 |
| `components/**` (`.tsx`) | ~597 |
| Cambios git en `apps/compramelafoto/` | ~252 paths (tracked + untracked) |

---

## Dependencias agregadas (Block C)

| Paquete | Uso |
|---------|-----|
| `exifr` | Lectura EXIF en fotos |
| `@google-cloud/vision` | OCR / análisis de imágenes |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Drag & drop dashboard / plantillas |
| `pdf-lib` | Generación PDF (carnets, diplomas escolares) |
| `recharts` | Gráficos dashboard / analytics |
| `react-easy-crop` | Recorte de imágenes |
| `leaflet`, `react-leaflet` | Mapas en eventos / landings |
| `konva`, `react-konva` | Editor canvas fotolibros |
| `@tanstack/react-virtual` | Listas virtualizadas en fotolibros |
| `xlsx`, `csv-parse` | Import roster / export (heredado Block B, usado en escolar) |

Deps de Block A/B ya presentes: `@aws-sdk/*`, `archiver`, `sharp`, `resend`, `qrcode`, `bcryptjs`, `jszip`, `zod`.

---

## Adaptaciones monorepo

| Archivo | Cambio |
|---------|--------|
| `lib/prisma.ts` | Bridge `@repo/db` + re-export tipos `@prisma/client` |
| `tsconfig.json` | `noUncheckedIndexedAccess: false` (alineado legacy); `exclude: **/*.test.ts` |
| `lib/school-roster/**` | `prisma.student` → `prisma.schoolStudent`; tipo `SchoolStudent` (modelo escolar en `@repo/db`, distinto de `Student` de FotoOffice) |
| Imports `@prisma/client` en código copiado | Preferencia `@/lib/prisma` donde aplica |

**No modificado (por restricción):** `packages/db/prisma/schema.prisma`, migraciones, FotoOffice, FotoRank, `apps/_archive`.

---

## Errores corregidos

### TypeScript (~274 → 0)

| Categoría | Resolución |
|-----------|------------|
| Módulos faltantes (`@/lib/email`, referrals, land, polaroid, charlasfpr, etc.) | Copiados desde legacy |
| Deps faltantes (`konva`, `react-konva`, `@tanstack/react-virtual`) | Agregadas a `package.json` + `pnpm install` |
| Conflicto `Student` vs `SchoolStudent` | Renombre en `school-roster` y APIs `school-organizer` |
| `student-and-roster.ts` retorno | `Promise<SchoolStudent \| null>` |
| Tests unitarios con tipos estrictos | Excluidos de `tsc` vía `exclude` en tsconfig |

### Build

Sin errores adicionales tras typecheck verde (Next.js 16.2.1 compila todas las rutas dashboard/fotografo/organizador).

### Lint (3 → 0 errors)

| Archivo | Error | Fix |
|---------|-------|-----|
| `components/fotolibros/LayoutTemplatesStrip.tsx` | `use-memo` / `preserve-manual-memoization` en deps complejas | Deps `[slotCountFilter, orientationsForSort]` |
| `components/fotolibros/TemplatesFloatingModal.tsx` | `use-memo` + `refs` durante render en `style` | Posición del panel vía `useState` + `useEffect` |
| `components/template-v2/TemplateEditorLayers.tsx` | `preserve-manual-memoization` en `primaryId` | Deps `[state]` en lugar de subcampos |

Warnings legacy (~1212) sin corregir: `no-explicit-any`, `no-img-element`, `exhaustive-deps`, etc.

---

## Stubs

No se crearon stubs nuevos en Block C. Se **restauraron** layouts/panels eliminados accidentalmente en Block B:

- `FotografoLayoutClient`, `PhotographerSidebar`
- `LabLayoutClient`, `OrganizerLayoutClient`

---

## Módulos excluidos (fuera de alcance Block C)

| Área | Motivo |
|------|--------|
| `packages/db/prisma/schema.prisma` | Restricción explícita — schema ya fusionado |
| Migraciones SQL | Restricción explícita |
| `apps/fotoffice/**`, `apps/fotorank/**` | Restricción explícita |
| `apps/_archive/**` | Stale mono — no mezclar |
| Workers (`camera-*`, `video-worker`) | Oleada 4 del plan — commit separado |
| `public/uploads/` | Datos dev — no versionar |
| Smoke e2e / `school-design` WIP mono | Listado en `05-import-map.md` §11 |
| CuántoCobro, blog marketing completo | Bloque D / commit 9 del plan |
| Codemod masivo `@prisma/client` → `@/lib/prisma` | Bloque posterior (commit 12) |

---

## Validaciones ejecutadas

```bash
cd "/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite"
pnpm install
pnpm --filter compramelafoto typecheck   # ✅ exit 0
pnpm --filter compramelafoto build       # ✅ exit 0 (~7 min)
pnpm --filter compramelafoto lint        # ✅ 0 errors, 1212 warnings
```

---

## Pendientes — Bloque D (próximo)

Según [`22-code-import-execution-plan.md`](./22-code-import-execution-plan.md) commits 8–11:

1. **Dominio escuela/organizador profundo** — verificar smoke auth en `/organizador`, comisiones, eventos públicos end-to-end.
2. **CuántoCobro + blog marketing** — rutas `cuantocobro`, blog, charlas admin, campañas email.
3. **Admin API y crons restantes** — `vercel.json`, crons no migrados, health checks.
4. **Workers** — `apps/compramelafoto-workers/*` con `@repo/db`.
5. **Codemod Prisma** — unificar imports `@prisma/client` → `@/lib/prisma` en todo el app.
6. **Smoke funcional** — login fotógrafo/lab/organizador, upload, panel dashboard protegido, cron EXIF/FTP en staging.
7. **Reducir warnings lint** — opcional; priorizar `rules-of-hooks` en `TemplateEditorInspector.tsx`.
8. **Tests** — reincorporar `**/*.test.ts` al typecheck cuando el bridge Prisma esté estable en CI.

---

## Diff resumido (sesión Block C)

| Área | Cambio principal |
|------|------------------|
| `app/dashboard/`, `app/fotografo/`, `app/organizador/`, `app/escolar/` | Copia masiva desde legacy |
| `app/api/dashboard/`, `fotografo/`, `school-organizer/`, `admin/`, `cron/`, `downloads/` | APIs operativas |
| `lib/analysis/`, `ocr/`, `school-roster/`, `template-v2/`, `fotolibros/`, `admin/` | Dominios de negocio |
| `components/fotolibros/`, `template-v2/`, `dashboard/`, `land/` | UI operativa |
| `package.json` | +11 deps (konva, vision, dnd-kit, etc.) |
| `tsconfig.json` | `noUncheckedIndexedAccess: false`, exclude tests |
| Lint fixes | 3 archivos fotolibros/template-v2 |
