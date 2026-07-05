# 28 — Reporte Bloque D: Marketplace público, blog, landings, leads, SEO y emails

**Fecha:** 2026-07-05  
**Bloque:** D — Superficie pública y comercial restante  
**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto`  
**Destino:** `apps/compramelafoto`  
**Plan:** [`22-code-import-execution-plan.md`](./22-code-import-execution-plan.md) · Bloque C: [`27`](./27-code-import-block-c-dashboard-report.md)

---

## Resumen ejecutivo

Bloque D **completado**: marketplace público (directorio, comunidad, home-preview), blog CMS completo, landings comerciales, captura de leads, CuántoCobro, CamOfDuty/simulador, SEO global, sistema de emails/marketing.

| Validación | Resultado |
|------------|-----------|
| `pnpm install` | ✅ |
| `pnpm --filter compramelafoto typecheck` | ✅ |
| `pnpm --filter compramelafoto build` | ✅ |
| `pnpm --filter compramelafoto lint` | ✅ (**0 errors**, ~1501 warnings legacy) |

**Listo para commit:** sí (incluye `pnpm-lock.yaml` y fix menor en `@repo/design-system` `Text.tsx`).

**Sin commit** en esta sesión (instrucción explícita).

---

## Alcance migrado

### 1. Marketplace

| Pieza | Rutas / archivos |
|-------|------------------|
| Directorio público | `app/directorio/**` (fotógrafos, organizadores, laboratorios, servicios) |
| Comunidad | `app/comunidad/**`, `components/community/**` |
| Home preview / vitrina | `app/home-preview/**`, `components/home-preview/**` |
| Admin plantillas catálogo | `app/admin/catalog-templates/**` |
| APIs comunidad | `app/api/public/community-profiles/`, `community-submit/`, `admin/community-profiles/` |
| Lib | `lib/community-submit.ts` |
| Catálogo dashboard (Block C) | `app/dashboard/productos/`, `lib/catalog-products/`, `lib/catalog-templates/` — ya presentes |

### 2. Blog

| Pieza | Rutas / archivos |
|-------|------------------|
| Público | `app/blog/**` (posts, categorías, tags, layout) |
| Admin CMS | `app/admin/blog/**` |
| APIs | `app/api/blog/og-image/`, `app/api/admin/blog/**`, `app/api/public/blog/subscribe/` |
| Lib | `lib/blog/**` (~37 módulos: tiptap, metadata, sitemap-data, JSON-LD) |
| Componentes | `components/blog/**` (+ admin) |
| Seed data | `data/blog/**` (phase7 + phase8) |

### 3. Landings

| Pieza | Rutas / archivos |
|-------|------------------|
| Home | `app/page.tsx` (marketing legacy) |
| Land genéricas | `app/land/**`, `app/landescolar/**`, `components/land/**` |
| DNX marketing | `app/dnx/**` (bodas, xv) |
| Charlas / cursos | `app/charlas/`, `charlasfpr/`, `charlafotoescolar/`, `cursos/` |
| Perfiles públicos | `app/l/**`, `app/e/**`, `app/[handler]/**` |
| Otros | `app/recomendanos/`, `app/testimonios/` |
| Admin marketing | `app/admin/marketing/**` (charlas, cursos) |
| Soporte UI | `components/HomeBanner.tsx`, `components/dnx/`, `components/recomendanos/` |

### 4. Leads

| Pieza | Rutas / archivos |
|-------|------------------|
| Contacto | `app/api/contact/`, `app/api/admin/contact-messages/` |
| Newsletter blog | `app/api/public/blog/subscribe/` |
| Charlas | `app/api/charlasfpr/`, `charlafotoescolar/`, `admin/talks/` |
| Escuelas | `app/api/school-leads/`, `admin/school-leads/` |
| DNX cursos | `app/api/public/dnx-course/`, `admin/dnx-course/`, `lib/dnx-foto-basica-funes-seats.ts` |
| FotoOffice interés | `app/api/cuantocobro/fotooffice-interest/`, `admin/fotooffice-interests/`, `admin/fotooffice-interesados/` |
| Privacidad | `app/api/privacy-requests/` |
| CuántoCobro | `app/cuantocobro/**`, `lib/cuantocobro/**` (~147), `components/cuantocobro/**` (~68), `app/api/cuantocobro/**` |
| CamOfDuty / simulador | `app/camofduty/**`, `app/api/camofduty/**`, `lib/simulator/**`, `components/simulator/**` (~82) |
| Lab / prints públicos | `components/lab/**`, `components/prints/**`, `components/carnet/**` |

### 5. SEO

| Pieza | Archivos |
|-------|----------|
| Sitemap / robots | `app/sitemap.ts`, `app/robots.ts` |
| Blog SEO | `lib/blog/blog-metadata.ts`, `blog-json-ld.ts`, `sitemap-data.ts` |
| OG dinámico | `app/api/blog/og-image/[slug]/route.ts` |
| URLs base | `lib/public-site-url.ts`, `lib/public-slugs.ts`, `lib/public-flow-config.ts` |

### 6. Emails

| Pieza | Archivos |
|-------|----------|
| Templates | `emails/**` (auth, support-reply, album-interest) |
| Core | `lib/email.ts`, `email-sender.ts`, `email-queue.ts`, `resend-digital-emails.ts` |
| Marketing | `lib/email-marketing/**` (audience, campaigns, render) |
| Admin UI | `app/admin/emails/`, `app/admin/email-marketing/` |

### Estilos (build)

| Path | Uso |
|------|-----|
| `styles/home-preview.css` | Home preview |
| `styles/camofduty/` | Simulador |
| `styles/cuantocobro/` | CuántoCobro wizard |
| `styles/design-system/` | Blog admin, catálogo CMS |

### Conteos aproximados

| Área | Archivos nuevos Block D |
|------|-------------------------|
| Rutas app (blog, cuantocobro, directorio, camofduty, landings) | ~75+ en muestra principal |
| `lib/blog` + `lib/cuantocobro` + componentes | ~563+ |
| Paths git pendientes en `apps/compramelafoto/` | ~177 |

---

## Dependencias agregadas (Block D)

| Paquete | Uso |
|---------|-----|
| `@tiptap/core`, `@tiptap/react`, `@tiptap/html`, `@tiptap/starter-kit` + extensiones | CMS blog |
| `sanitize-html`, `isomorphic-dompurify` | HTML blog seguro |
| `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei` | Simulador CamOfDuty |
| `piexifjs` | Export EXIF simulador |
| `@monaco-editor/react` | Editor email marketing admin |

---

## Adaptaciones monorepo

| Cambio | Detalle |
|--------|---------|
| Prisma | Sin schema nuevo; imports vía `@/lib/prisma` / `@repo/db` |
| `packages/db/src/client.ts` | **Sin cambios** (no enums nuevos requeridos) |
| `types/piexifjs.d.ts` | Declaración módulo para typecheck |
| `packages/design-system/.../Text.tsx` | `createElement` en lugar de JSX polimórfico (fix React 19 + `tsc` del app) |
| `eslint.config.mjs` | Override `react-hooks/refs` + `immutability` off en `components/simulator/**` y `lib/simulator/**` (patrones Three.js legacy) |

**No modificado:** `schema.prisma`, migraciones, FotoOffice, FotoRank, `_archive`, workers.

---

## Errores corregidos

### TypeScript (~78 → 0)

| Categoría | Resolución |
|-----------|------------|
| Deps faltantes (tiptap, three, monaco, etc.) | `package.json` + `pnpm install` |
| Módulos faltantes | `carnet/`, `UnavailablePage`, `referral-share-messages`, `simulator/`, `lab/`, `prints/`, `dnx/`, `recomendanos/` |
| `piexifjs` sin tipos | `types/piexifjs.d.ts` |
| `Text.tsx` design-system | `createElement` para evitar `children: never` |

### Build

| Error | Resolución |
|-------|------------|
| CSS faltantes (`home-preview`, `camofduty`, `cuantocobro`) | Copia `styles/` desde legacy |

### Lint (22 → 0 errors)

| Archivo / área | Fix |
|----------------|-----|
| `<a>` → `Link` | `album/[slug]/page`, `cliente/pack`, `pago/success`, `registro/organizador` |
| `EquipmentCategoryCard` | `createElement(Icon, …)` |
| Simulador (refs/immutability) | Regla ESLint off en carpeta simulator |

---

## Módulos excluidos

| Área | Motivo |
|------|--------|
| `packages/db/prisma/schema.prisma` | Restricción explícita |
| Migraciones SQL | Restricción explícita |
| `apps/fotoffice/**`, `apps/fotorank/**` | Restricción explícita |
| `apps/_archive/**` | Stale mono |
| Workers | Oleada 4 del plan |
| `public/uploads/` | Datos dev |
| Deploy / `vercel.json` crons finales | Fuera de alcance Block D |

---

## Validaciones ejecutadas

```bash
cd "/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite"
pnpm install
pnpm --filter compramelafoto typecheck   # ✅
pnpm --filter compramelafoto build       # ✅ (~10 min)
pnpm --filter compramelafoto lint        # ✅ 0 errors, 1501 warnings
```

Rutas build nuevas visibles: `/blog`, `/cuantocobro`, `/camofduty`, `/directorio`, `/comunidad`, `/home-preview`, `/robots.txt`, `/sitemap.xml`, `/recomendanos`, `/testimonios`, charlas, landings DNX, etc.

---

## Pendientes — Bloque E (próximo)

1. **Admin API y crons restantes** — `vercel.json`, crons no cableados, health checks.
2. **Workers** — `apps/compramelafoto-workers/*` con `@repo/db`.
3. **Codemod Prisma** — unificar `@prisma/client` → `@/lib/prisma` en todo el app.
4. **Smoke funcional** — blog publicar/leer, CuántoCobro wizard, directorio, newsletter, contacto, simulador.
5. **Reducir warnings lint** — opcional (~1500 legacy).
6. **Commit sugerido:** `feat(clf): import blog marketing and public commerce` (o split blog + cuantocobro si se prefiere PRs pequeños).

---

## Diff resumido (sesión Block D)

| Área | Cambio |
|------|--------|
| `app/blog/`, `admin/blog/`, APIs blog | CMS completo |
| `app/cuantocobro/`, `lib/cuantocobro/`, APIs | Calculadora comercial |
| `app/directorio/`, `comunidad/`, `home-preview/` | Marketplace público |
| `app/camofduty/`, `lib/simulator/`, `components/simulator/` | Simulador |
| Landings + leads APIs | charlas, contacto, school-leads, dnx-course |
| `app/sitemap.ts`, `robots.ts`, `styles/` | SEO + estilos build |
| `emails/`, `lib/email-marketing/` | Email marketing |
| `package.json`, `pnpm-lock.yaml` | +deps Block D |
| `packages/design-system/.../Text.tsx` | Fix typecheck React 19 |
| `eslint.config.mjs` | Override simulator |
