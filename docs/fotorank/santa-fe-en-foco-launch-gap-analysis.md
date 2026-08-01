# Santa Fe en Foco — Gap analysis (lanzamiento 1 ago 2026)

**Producto:** FotoRank (`apps/fotorank`)  
**Concurso objetivo:** “Santa Fe en Foco” — inscripciones **gratuitas** desde el **1 de agosto de 2026**  
**Fecha de auditoría:** 2026-07-28  
**Método:** revisión estática de código + schema Prisma + tests existentes. **No se ejecutó** el flujo end-to-end contra una base real ni se validó deploy.  
**Alcance:** FotoRank y paquetes compartidos estrictamente necesarios (`@repo/db`, `@repo/auth`, referencia a `@repo/payments` / Clickatón como patrón).  
**Restricción de esta etapa:** sin cambios funcionales, sin commit/push/deploy.

---

## 1. Resumen ejecutivo

FotoRank hoy es un **motor operativo de concursos + jurados + diplomas + oferta pública de inscripción (09B1)**.  
Puede **configurar** un concurso FREE con ventanas, categorías (`maxFiles`) y landing pública, y tiene un **módulo de jurados maduro**.

**No puede abrir inscripciones reales** el 1 de agosto sin construir el dominio de participante:

| Capacidad crítica | Estado |
|-------------------|--------|
| Configurar concurso FREE + fechas de inscripción | Parcial (schema + UI + API) |
| Inscribir participante (1 user / concurso) | **No existe** |
| Cargar 1 foto segura (privado + hash + EXIF + checklist) | **No existe** |
| Bases versionadas + aceptación auditable | **No existe** |
| Panel operativo de participaciones | **Stub** |
| Checkout DNX Payments | No cableado (aceptable para FREE si no se inventa orden) |
| Jurado anónimo evaluando obras | Parcial (omite `authorUserId`; depende de obras válidas) |

**Veredicto:** el núcleo de organizador/jurado existe; el **núcleo productivo de inscripción + obra** para Santa Fe en Foco **no está listo**. Es el bloqueador principal del 1/8.

---

## 2. Inventario técnico actual

### 2.1 App y paquetes

| Pieza | Ruta |
|-------|------|
| App | `apps/fotorank` |
| Schema | `packages/db/prisma/schema.prisma` (bloque FOTORANK ~7116–7929) |
| Auth suite | `packages/auth` + `apps/fotorank/app/lib/auth.ts` |
| Auth jurado | `apps/fotorank/app/lib/judge-auth.ts` |
| Public API v1 | `apps/fotorank/app/lib/public-api/v1/` · `apps/fotorank/app/api/public/v1/` |
| Entries domain | `apps/fotorank/app/lib/fotorank/fotorankContestEntryDomain.ts` |
| Contests actions | `apps/fotorank/app/actions/contests.ts` |
| Categories actions | `apps/fotorank/app/actions/contest-categories.ts` |
| Judges actions | `apps/fotorank/app/actions/judges.ts` |
| Auditoría auth previa | `apps/fotorank/AUDIT-FOTORANK.md` |
| Docs Clickatón↔FR | `docs/clickaton/FOTORANK_*.md` |
| Payments (no usado por FR) | `packages/payments` |
| Patrón FREE sin orden | `apps/clickaton/lib/registration/application/confirm-free-registration.ts` |

### 2.2 Modelos Prisma FotoRank (relevantes)

| Modelo | Rol | Notas |
|--------|-----|-------|
| `ContestOrganization` | Organizador | Sin fee en BPS |
| `ContestOrganizationMember` | Membresía + rol | Roles poco aplicados en UI |
| `FotorankProfile` | Perfil usuario en FR | |
| `FotorankContest` | Concurso | Incluye flags 09B1 de registration |
| `FotorankContestCategory` | Categoría | `maxFiles` (default 1) |
| `FotorankGlobalCategory` (+ alias/mappings) | Catálogo global | |
| `FotorankContestEntry` | Obra | Solo `imageUrl` + metadatos opcionales |
| `FotorankJudgeAccount` / `Profile` / `Session` | Jurado | Auth separada |
| `FotorankJudgeInvitation` / `DirectoryInvitation` | Invitaciones | |
| `FotorankJudgeAssignment` / `Vote` / `VoteHistory` / `AuditEvent` | Evaluación | |
| `FotorankDiplomaTemplate` / `DiplomaIssued` | Diplomas | Checksums de PDF/PNG, no de obras |

**No existen:** `FotorankRegistration`, bases versionadas de concurso, asset storage de obra, checklist técnico de obra, fee FR en BPS, snapshot financiero de inscripción FR.

### 2.3 Enums clave

- `FotorankRegistrationPricingMode`: **FREE | PAID** — **falta INVITATION_ONLY**
- `FotorankContestStatus`: DRAFT → ARCHIVED (con estados legacy intermedios)
- Fechas en `FotorankContest`: `registrationOpensAt/ClosesAt`, `startAt`, `submissionDeadline`, `judgingStartAt/EndAt`, `resultsAt`
- Checklist de setup UI (app): `NOT_STARTED | IN_PROGRESS | COMPLETE` — **no** es checklist de obra

### 2.4 Migraciones FotoRank

| Migración | Contenido |
|-----------|-----------|
| `20260422085720_init_baseline` | Núcleo Fotorank\* + ContestOrganization\* |
| `20260715150000_fotorank_public_event_channel` | `distributionChannel` |
| `20260715160000_fotorank_experience_type` | `experienceType` |
| `20260715180000_fotorank_public_registration_summary` | Campos registration\* 09B1 |

### 2.5 Rutas

**Públicas:** `/`, `/login`, `/concursos/[slug]`, `/concursos/[slug]/jurados`, `/jurados/publico/[publicSlug]`, `/diplomas/verificar/[token]`, `/jurado/login|register|registro`, `GET /api/public/v1/events[+slug]`, OAuth Google.

**Organizador:** `/dashboard`, `/concursos`, `/concursos/nuevo`, `/dashboard/concursos/[id]` (+ módulos), `/jurados/*`, `/participaciones` (**stub**), onboarding/settings.

**Jurado:** `/jurado/panel`, `/jurado/asignaciones/[id]/evaluar`, perfil/invitaciones.

**No existen:** `/concursos/[slug]/inscripcion`, rutas de carga de obra, área “mi participación”.

### 2.6 Autenticación

| Actor | Mecanismo | Cookie |
|-------|-----------|--------|
| Organizador | `User` + `UserSession` (`@repo/auth`) | `dnx_session` |
| Jurado | `FotorankJudgeAccount` + `FotorankJudgeSession` | `dnx_judge_session` |
| Participante | **No modelado** | — |

Gate panel: `requireAuth` + `hasAppAccess(FOTORANK)` + org activa. **Sin middleware.ts.** Roles org (`OWNER/ADMIN/EDITOR/JUDGE/VIEWER`) existen en BD pero casi no se aplican en UI.

### 2.7 Storage / EXIF / hash / validación de obras

| Capacidad | En obras FR | Dónde sí hay algo |
|-----------|-------------|-------------------|
| Storage privado (R2/S3) | No | CLF (`apps/compramelafoto/lib/r2-client.ts`); avatares/diplomas FR en disco local `public/uploads` |
| Derivados | No | CLF variants/watermark |
| EXIF | No | CLF `extract-exif-metadata.ts` (`exifr`; null si falta, no bloquea) |
| SHA-256 archivo obra | No | Tokens/sesión; checksums diplomas |
| Validación mime/size/dimensiones obra | No | Solo URL no vacía en `createFotorankContestEntry` |
| Duplicados exactos | No | — |

### 2.8 DNX Payments

- Schema y paquete `@repo/payments` maduros (Clickatón, snapshots, BPS).
- `apps/fotorank` **no depende** de `@repo/payments`.
- Public API: `checkoutUrl` **siempre `null`** (`registration.ts`).
- Economía UI en `rulesData` (`prizesRewards.ts`): comisión **15% hardcode** — no es fee real ni BPS.
- Clickatón FREE: confirma con `paymentStatus: NOT_REQUIRED` **sin orden ficticia** — patrón a reutilizar.

### 2.9 Tests existentes

| Tipo | Path | Cobertura |
|------|------|-----------|
| E2E Playwright | `apps/fotorank/e2e/*.spec.ts` | Admin resultados/jurados, evaluación, invite, public judges |
| Selfchecks Public API | `apps/fotorank/app/lib/public-api/v1/*.selfcheck.ts` | Serializers, registration state, routes, channel, experience |
| Payments | `packages/payments/**/*.test.ts` | Checkout Clickatón / webhooks / BPS — **no FR** |

**Ausente:** inscripción FREE, upload obra, EXIF, hash, checklist obra, bases/aceptación, panel participaciones, permisos por rol.

---

## 3. Matriz de requisitos

Leyenda:

- **EXISTE Y FUNCIONA** — código + modelo coherentes; falta solo prueba de aceptación en entorno real si se indica.
- **EXISTE PARCIAL** — hay piezas; no cubre el requisito completo o no está cableado end-to-end.
- **NO EXISTE** — sin modelo/flujo usable.
- **BLOQUEADO** — depende de otra pieza ausente o de decisión externa.
- **REQUIERE PRUEBA** — código sugiere soporte; no verificado en runtime.

---

### R01 — Concurso configurable

| Campo | Valor |
|-------|-------|
| **Clasificación** | EXISTE PARCIAL |
| **Evidencia** | Wizard `CreateContestWizard`, dashboard `/dashboard/concursos/[id]`, actions `contests.ts`, modelo `FotorankContest` |
| **Gap** | Configuración rica (datos, fechas, categorías, bases texto, publicación, premios). Falta config operativa de participante (obra, checklist, fee BPS, bases versionadas). Doble fuente economía: Prisma `registration*` vs `rulesData.premiosRecompensas.economy`. |
| **Riesgo** | Organizador cree que “publicado + FREE” = inscripciones abiertas. |

### R02 — Fechas separadas: inscripción / carga / evaluación / publicación

| Campo | Valor |
|-------|-------|
| **Clasificación** | EXISTE PARCIAL |
| **Evidencia** | `registrationOpensAt/ClosesAt`, `submissionDeadline`, `judgingStartAt/EndAt`, `resultsAt`; ventanas por assignment |
| **Gap** | No hay ventana explícita de **carga de obras** separada de inscripción. Landing pública usa `startAt`/`submissionDeadline`, no el bloque `registration*` de Public API. Sin timezone IANA. |
| **Riesgo** | CTA “abierto” desalineado con `registrationEnabled` / ventanas reales. |

### R03 — Modalidad FREE / PAID / INVITATION_ONLY

| Campo | Valor |
|-------|-------|
| **Clasificación** | EXISTE PARCIAL |
| **Evidencia** | Enum `FREE\|PAID`; UI Step3 + PublicacionModal; serializers Public API |
| **Gap** | `INVITATION_ONLY` ausente. PAID sin checkout. FREE sin confirmación de inscripción. |
| **Riesgo** | PAID visible públicamente con `checkoutUrl=null`. |

### R04 — Una inscripción por usuario

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE |
| **Evidencia** | No hay modelo `Fotorank*Registration`; `confirmedCount` hardcodeado `null` en loaders |
| **Gap** | Sin unique `(contestId, userId)`, sin estados de inscripción, sin cupo real |
| **Riesgo** | Imposible abrir inscripciones con integridad. |

### R05 — Una categoría por inscripción

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE |
| **Evidencia** | Entry apunta a `categoryId`, pero sin entidad inscripción que fije la categoría elegida una sola vez |
| **Gap** | Se puede crear N entries admin en N categorías sin regla de negocio |
| **Riesgo** | Para Santa Fe en Foco (1 categoría) el riesgo es bajo si se configura 1 categoría, pero no hay enforcement de “una categoría por participante”. |

### R06 — Cantidad de obras configurable por categoría

| Campo | Valor |
|-------|-------|
| **Clasificación** | EXISTE PARCIAL |
| **Evidencia** | `FotorankContestCategory.maxFiles`; UI wizard Step4; landing muestra límite |
| **Gap** | No hay enforcement al crear entries (ni unique/count por autor) |
| **Riesgo** | Configuración cosméticas frente a carga real. |

### R07 — Santa Fe en Foco: 1 categoría + 1 fotografía

| Campo | Valor |
|-------|-------|
| **Clasificación** | EXISTE PARCIAL (config) / BLOQUEADO (operación) |
| **Evidencia** | `maxFiles` default 1; se puede crear 1 categoría |
| **Gap** | Sin seed/concurso “Santa Fe en Foco” en repo. Sin flujo de carga. Sin enforcement 1 obra/participante. |
| **Riesgo** | Dependencia total del P0 de inscripción+upload. |

### R08 — Bases versionadas + aceptación auditable

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE |
| **Evidencia** | `rulesText`/`rulesData` mutables; `TermsDocument`/`TermsAcceptance` son de roles CLF/plataforma, no de concurso |
| **Gap** | Sin versión inmutable, hash de documento, IP/UA, aceptación ligada a inscripción |
| **Riesgo** | Disputa legal sin prueba de qué bases aceptó el participante. |

### R09 — Carga del original en almacenamiento privado

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE |
| **Evidencia** | Entry = `imageUrl` string; uploads locales solo avatares/diplomas en `public/uploads` |
| **Gap** | Sin keys privadas, sin signed URL, sin ACL |
| **Riesgo** | Originales públicos o URLs arbitrarias; no apto para producción de concurso. |

### R10 — Generación de derivados

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE |
| **Evidencia** | Pipeline en CLF (`generate-photo-variants.ts`); no usado por FR |
| **Gap** | Jurado/organizador verían URL cruda o nada |
| **Riesgo** | Exponer original al jurado si se reutiliza mal `imageUrl`. |

### R11 — Lectura de EXIF

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE (en FR) |
| **Evidencia** | `metadataJson` libre sin extractor; CLF tiene `extractExifMetadata` que **no falla** si falta EXIF |
| **Gap** | Reutilizar patrón CLF sin acoplar modelos `Photo` |
| **Riesgo** | Si se implementa mal, rechazo automático por falta de EXIF (prohibido por requisito). |

### R12 — Cálculo de SHA-256

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE |
| **Evidencia** | Sin campo hash en `FotorankContestEntry` |
| **Gap** | Hash del bytes del original al subir |
| **Riesgo** | Sin integridad ni base para duplicados. |

### R13 — Detección de duplicados exactos

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE |
| **Evidencia** | Sin índice/unique por hash |
| **Gap** | Dedupe por SHA-256 (mismo concurso o global — decidir) |
| **Riesgo** | Fraude / reenvíos. |

### R14 — Checklist automático PASS / WARNING / FAIL / NOT_AVAILABLE / REQUIRES_REVIEW

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE |
| **Evidencia** | Solo checklist de **setup de concurso** (`contestProgress.ts`) |
| **Gap** | Motor por obra: mime, size, dimensiones, EXIF opcional, hash, duplicado, etc. |
| **Riesgo** | Sin gate operativo; EXIF debe mapear a NOT_AVAILABLE/WARNING, nunca FAIL automático. |

### R15 — Reemplazo de fotografía antes del cierre

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE |
| **Evidencia** | Solo `createFotorankContestEntry`; sin update/replace de obra |
| **Gap** | Replace + invalidar derivados/hash/checklist; gate por ventana de carga |
| **Riesgo** | Participante atrapado con foto errónea. |

### R16 — Confirmación final de obra

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE |
| **Evidencia** | Sin estados de obra (DRAFT/CONFIRMED/…) |
| **Gap** | Confirmación explícita antes de evaluación |
| **Riesgo** | Obras borrador evaluadas por jurado. |

### R17 — Anonimización para jurados

| Campo | Valor |
|-------|-------|
| **Clasificación** | EXISTE PARCIAL |
| **Evidencia** | `rulesData.jurado.anonymousByDefault`; panel jurado omite `authorUserId` (`judges.ts` ~1331; README judges) |
| **Gap** | Soft guarantee; sin token anónimo persistido; otras APIs podrían filtrar autor; EXIF/GPS podrían re-identificar |
| **Riesgo** | Filtrado de identidad vía metadatos o listados admin compartidos. |

### R18 — Panel operativo del organizador

| Campo | Valor |
|-------|-------|
| **Clasificación** | EXISTE PARCIAL |
| **Evidencia** | `ContestDashboard` + módulos; `/participaciones` stub |
| **Gap** | Bandeja de inscripciones/obras, filtros, checklist, cupos, export básico |
| **Riesgo** | Organizador ciego ante el lanzamiento. |

### R19 — Fee configurable org/concurso en basis points

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE (en FR) / EXISTE PARCIAL (suite) |
| **Evidencia** | `DnxDistributionRule` / allocations en BPS; UI FR hardcodea 15% en `computeEconomySummary` |
| **Gap** | Campos fee en org/concurso FR + uso de `DnxEconomicAgreement` o snapshot propio |
| **Riesgo** | Números de negocio engañosos; para FREE del 1/8 no bloquea inscripción si se evita cobro. |

### R20 — Snapshot financiero de cada inscripción paga

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE (FR) / EXISTE Y FUNCIONA (DNX/Clickatón) |
| **Evidencia** | `DnxOrderDistributionSnapshot`, Clickatón checkout |
| **Gap** | Ligar inscripción PAID FR a DNX Payments; FREE **no** debe crear orden ficticia |
| **Riesgo** | Inventar órdenes FREE rompería reportes. |

### R21 — Reutilizar DNX Payments (sin checkout paralelo)

| Campo | Valor |
|-------|-------|
| **Clasificación** | EXISTE PARCIAL (infra) / BLOQUEADO (producto FR) |
| **Evidencia** | `packages/payments`; FR sin dependencia; `checkoutUrl=null` |
| **Gap** | Integración 09B2; para Santa Fe FREE del 1/8 se puede **diferir** el checkout si FREE confirma sin payments |
| **Riesgo** | Construir checkout propio en FR (prohibido). |

### R22 — Permisos por organizador

| Campo | Valor |
|-------|-------|
| **Clasificación** | EXISTE PARCIAL |
| **Evidencia** | `ContestOrganizationMember` + roles; `contest-permissions.ts` por **estado** de concurso; `hasAppAccess` |
| **Gap** | Roles org no applied uniformemente en UI/actions; sidebar fija “admin” |
| **Riesgo** | VIEWER/EDITOR con más poder del esperado. |

### R23 — Invitaciones y asignaciones de jurados

| Campo | Valor |
|-------|-------|
| **Clasificación** | EXISTE Y FUNCIONA (código + e2e) · REQUIERE PRUEBA en staging |
| **Evidencia** | Invitaciones email/token + directorio; assignments; e2e `judge-invite`, `judge-evaluacion` |
| **Gap** | No bloquea apertura de inscripciones FREE; sí evaluación posterior (P1) |
| **Riesgo** | Bajo para el 1/8; medio para fase evaluación. |

### R24 — Integración Instagram / votación pública / venta de obras

| Campo | Valor |
|-------|-------|
| **Clasificación** | NO EXISTE (fuera de alcance P0) |
| **Evidencia** | Campos Instagram en perfiles; sin sync/public voting/sales de obras FR |
| **Gap** | Explicitamente P2; no implementar ahora |

---

## 4. Flujo actual vs flujo requerido (Santa Fe en Foco)

### Actual

```text
Org configura concurso (FREE flags) → publica
Landing pública → CTA “Participar” → /login (organizador)
Admin puede crear FotorankContestEntry con imageUrl
Jurado evalúa entries con imageUrl no vacío
/participaciones = stub
```

### Requerido (mínimo 1/8)

```text
Org configura FREE + 1 categoría maxFiles=1 + bases versionadas + ventanas
Participante autentica (User suite o flujo participante)
Acepta bases (hash + audit)
Crea 1 inscripción FREE (sin orden DNX)
Sube 1 original a storage privado
Sistema: SHA-256, EXIF (no bloqueante), derivados, checklist
Participante confirma obra (o reemplaza antes del cierre)
Org ve bandeja operativa
(Jurado más adelante, sin identidad)
```

---

## 5. Bloqueadores para el 1 de agosto de 2026

1. **Sin entidad de inscripción** (FREE confirmable, 1 por usuario, cupo).
2. **Sin funnel público de inscripción** (landing CTA incorrecto; login de organizador).
3. **Sin pipeline de obra** (upload privado, hash, EXIF no bloqueante, derivados, checklist).
4. **Sin bases versionadas + aceptación**.
5. **Panel `/participaciones` no operativo**.
6. **Enforcement 1 categoría / 1 foto** solo configuracional, no garantizado.
7. **QA ausente** del camino feliz FREE.
8. **R19/R20/R21** no bloquean FREE si se confirma sin orden; sí bloquean cualquier PAID futuro.

---

## 6. Riesgos críticos

| # | Riesgo | Severidad |
|---|--------|-----------|
| 1 | Abrir landing con FREE “open” sin funnel → expectativa rota / reputacional | Crítica |
| 2 | Almacenar originales como URL pública o en `public/uploads` | Crítica |
| 3 | Rechazar obras sin EXIF | Alta (requisito de producto) |
| 4 | Filtrar identidad al jurado (API/EXIF/GPS/nombre archivo) | Alta |
| 5 | Crear órdenes DNX ficticias para FREE | Alta (contabilidad) |
| 6 | Doble fuente de pricing/economía | Media |
| 7 | Roles org no enforced | Media |
| 8 | Reutilizar modelos CLF `Photo` acoplando productos | Media |
| 9 | Cambiar `rulesText` post-aceptación sin versionado | Alta (legal) |
| 10 | Cupos `null` → overbooking si se habilita capacity | Media |

---

## 7. Reutilización recomendada (sin reescribir shared)

| Capacidad | Reutilizar | No hacer |
|-----------|------------|----------|
| Auth participante | `User` + `@repo/auth` (misma cookie suite) | Inventar tercer auth |
| FREE confirm | Patrón Clickatón `confirmFreeRegistration` / `NOT_REQUIRED` | Orden ficticia |
| PAID futuro | `@repo/payments` + snapshots BPS | Checkout paralelo |
| EXIF | Extraer lógica tipo CLF a helper compartido **o** módulo FR dedicado | Importar modelos `Photo` CLF |
| Storage | Adapter R2 privado (CLF client como referencia) | Disco `public/uploads` para obras |
| Bases | Nuevo modelo FR (inspirado en `TermsAcceptance`) | Forzar `TermsDocument` por `Role` CLF |

---

## 8. Clasificación consolidada (checklist de requisitos)

| ID | Requisito | Estado |
|----|-----------|--------|
| R01 | Concurso configurable | EXISTE PARCIAL |
| R02 | Fechas inscripción/carga/evaluación/publicación | EXISTE PARCIAL |
| R03 | FREE / PAID / INVITATION_ONLY | EXISTE PARCIAL |
| R04 | Una inscripción por usuario | NO EXISTE |
| R05 | Una categoría por inscripción | NO EXISTE |
| R06 | Obras configurables por categoría | EXISTE PARCIAL |
| R07 | SF en Foco: 1 cat + 1 foto | BLOQUEADO |
| R08 | Bases versionadas + aceptación | NO EXISTE |
| R09 | Original en storage privado | NO EXISTE |
| R10 | Derivados | NO EXISTE |
| R11 | EXIF | NO EXISTE |
| R12 | SHA-256 | NO EXISTE |
| R13 | Duplicados exactos | NO EXISTE |
| R14 | Checklist obra (PASS/WARNING/FAIL/…) | NO EXISTE |
| R15 | Reemplazo antes del cierre | NO EXISTE |
| R16 | Confirmación final de obra | NO EXISTE |
| R17 | Anonimización jurado | EXISTE PARCIAL |
| R18 | Panel operativo organizador | EXISTE PARCIAL |
| R19 | Fee BPS org/concurso | NO EXISTE |
| R20 | Snapshot financiero inscripción paga | NO EXISTE (FR) |
| R21 | Reutilizar DNX Payments | EXISTE PARCIAL / BLOQUEADO producto |
| R22 | Permisos organizador | EXISTE PARCIAL |
| R23 | Invitaciones/asignaciones jurado | EXISTE Y FUNCIONA · REQUIERE PRUEBA |
| R24 | Instagram / voto público / venta | NO EXISTE (P2) |

---

## 9. Archivos de referencia rápida

```
packages/db/prisma/schema.prisma
apps/fotorank/app/lib/fotorank/fotorankContestEntryDomain.ts
apps/fotorank/app/actions/fotorank-contest-entries.ts
apps/fotorank/app/actions/contests.ts
apps/fotorank/app/lib/public-api/v1/registration.ts
apps/fotorank/app/concursos/[slug]/ContestPublicLanding.tsx
apps/fotorank/app/(dashboard)/participaciones/page.tsx
apps/fotorank/app/lib/contest-permissions.ts
apps/fotorank/app/lib/fotorank/prizesRewards.ts
apps/fotorank/app/actions/judges.ts
apps/clickaton/lib/registration/application/confirm-free-registration.ts
packages/payments/
apps/compramelafoto/lib/photographic-equipment/extract-exif-metadata.ts
apps/compramelafoto/lib/r2-client.ts
```

---

## 10. Confirmaciones de auditoría

- No se asumió que el código “funciona” solo por existir: se marcaron **REQUIERE PRUEBA** / **EXISTE PARCIAL** donde falta E2E o runtime.
- No se modificó producción ni se hizo commit/push/deploy en esta etapa.
- No hay seed ni concurso “Santa Fe en Foco” en el repositorio al momento de la auditoría.
