# Clickaton — Etapa 07 — Auditoría de integración real con FotoRank

**Fecha:** 2026-07-14  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Alcance:** solo lectura + documentación. Sin endpoints, sin Prisma, sin cambios funcionales en FotoRank ni Clickaton.

**Fuentes auditadas:**

- `apps/fotorank` (App Router Next 16.2)
- `packages/db/prisma/schema.prisma` (modelos `Fotorank*`)
- `packages/auth`
- Contratos Clickaton: `docs/clickaton/*`, `apps/clickaton/types/*`, `apps/clickaton/data/public-marathons/*`

---

## 1. Resumen ejecutivo

FotoRank es un **motor operativo parcial de concursos**: organizaciones, concursos, categorías (globales + de concurso), jurados, votos, diplomas y una **landing pública por slug**. No es aún un motor de **maratón fotográfico** con inscripción pública, pagos, consignas programadas, GPS/EXIF ni multi-sede.

Clickaton está **adelantado en contratos tipados y capa de acceso** (`PublicMarathonDataSource`, normalize/sanitize/visibility) y **atrasado en datos reales** (fixture local).

| Pregunta | Respuesta corta |
|----------|-----------------|
| ¿Se puede conectar Clickaton mañana a datos reales? | **No** sin capa nueva en FotoRank (DTO públicos + dominio maratón). |
| ¿Qué se reutiliza ya? | `FotorankContest` + org + categorías + jurados públicos + bases/fechas gruesas. |
| ¿Qué falta crítico? | Maratón tipado, inscripción, pagos, consignas, cupos, timezone, sedes, resultados/galería públicos. |
| ¿Exponer Prisma a Clickaton? | **No.** Solo DTOs públicos versionados. |

**Arquitectura recomendada:** FotoRank expone **Route Handlers públicos** (BFF de lectura) que serializan DTOs seguros; Clickaton implementa el adaptador `PublicMarathonDataSource`. Alternativa: paquete `@repo/fotorank-public` con loaders compartidos (mayor acoplamiento de deploy).

---

## 2. Estado real de FotoRank

| Dimensión | Estado |
|-----------|--------|
| Framework | Next.js **16.2**, React 19, **App Router** |
| DB | Prisma en `@repo/db` — sin schema local en `apps/fotorank` |
| Auth organizador | DNX Identity (`@repo/auth`) + cookie sesión |
| Auth jurado | Sesión **separada** (`FotorankJudgeSession`, no Identity) |
| APIs HTTP | Solo OAuth Google + descarga diplomas (3 routes) |
| Lógica de dominio | Server Actions + loaders `app/lib/fotorank/*` + Prisma directo |
| Landing pública | `/concursos/[slug]` vía `getPublicContestLandingBySlug` |
| Inscripción pública | **Ausente** (placeholder dashboard + entry admin) |
| Pagos | Simulación FREE/PAID en JSON `rulesData` — sin gateway |
| Consignas | **Ausentes** en Prisma y código FR |
| GPS/EXIF en obras FR | **Ausente** (`PhotoExifMetadata` es CLF) |

---

## 3. Modelos existentes (Prisma `Fotorank*`)

Ubicación: `packages/db/prisma/schema.prisma`.

| Modelo | Uso | Mapeable a Clickaton | Notas |
|--------|-----|----------------------|-------|
| `FotorankContest` | Activo | Parcial → `PublicMarathon` | No hay tipo MARATHON |
| `ContestOrganization` | Activo | Parcial → `PublicOrganizer` | Sin sede/venue tipada |
| `ContestOrganizationMember` | Activo | Privado | Roles OWNER/ADMIN/EDITOR/JUDGE/VIEWER |
| `FotorankContestCategory` | Activo | Parcial → `PublicCategory` | `maxFiles`; sin cupo participantes |
| `FotorankGlobalCategory` (+ alias/mapeos) | Activo | Interno / catálogo | No exponer catálogo crudo |
| `FotorankContestEntry` | Parcial | Futuro obra/galería | Sin status inscripción; creación admin |
| `FotorankJudgeAccount/Profile/Assignment/Invitation…` | Activo | Parcial → `PublicJuryMember` | Solo perfiles públicos |
| `FotorankJudgeVote` (+ history) | Activo | Interno | Ranking calculado en código |
| `FotorankDiplomaTemplate/Issued` | Activo | Futuro certificado | No es galería de evento |
| Economía en `rulesData` JSON | Activo (UI) | Parcial → offer | Simulación, no cobro |

**No existen:** Marathon, Challenge/Consigna, Registration, PaymentIntent FR, Venue/Sede, Gallery de evento, Ranking persistido, RulesVersion con hash de aceptación, ValidationResult GPS/EXIF sobre `FotorankContestEntry`.

---

## 4. Flujo de eventos / competencias

### Respuestas explícitas

| # | Pregunta | Hallazgo |
|---|----------|----------|
| 1 | ¿Entidad general de evento? | Sí: **`FotorankContest`** |
| 2 | ¿Tipo `MARATHON`? | **No** |
| 3 | ¿Consignas asociadas? | **No** modelo |
| 4 | ¿Liberación por horario? | **No** |
| 5 | ¿Apertura/cierre captura? | **No** separado; solo fechas gruesas |
| 6 | ¿Apertura/cierre carga? | Solapado con `submissionDeadline` (copy = “cierre inscripción”) |
| 7 | ¿Timezone? | **No** en modelo; formateo `es-AR` sin TZ fija |
| 8 | ¿Estados públicos expresivos? | Parcial: `status` + `visibility`; no ciclo maratón Clickaton |
| 9 | ¿Draft → archivo? | Parcial: DRAFT…PUBLISHED/CLOSED/ARCHIVED; sin `registration_open` / `in_progress` / `judging` nativos |
| 10 | ¿Marcar públicos? | Sí: `visibility: PUBLIC` + status PUBLISHED/ACTIVE |

### Ventanas FotoRank vs Clickaton

| FotoRank | Semántica actual | Clickaton |
|----------|------------------|-----------|
| `startAt` | Inicio | `startAt` + windows |
| `submissionDeadline` | Cierre inscripción (también usado como carga) | `registration` / `upload` separados |
| `judgingStartAt` / `judgingEndAt` | Juzgamiento | `judging` |
| `resultsAt` | Resultados | `results` + `ResultsStatus` |
| — | — | `capture`, `check_in`, `challenges` |

---

## 5. Flujo de inscripción

| Pieza | Estado FR |
|-------|-----------|
| Rutas públicas de alta | No |
| Server Action participante | No |
| Cupos vivos | No (`maxFiles` ≠ cupo personas) |
| Categoría al inscribirse | No |
| Aceptación de bases versionada | No |
| Modalidad grupal | No |
| Waitlist / QR / check-in | No |
| Entry | `createFotorankContestEntry` — **org admin**, comentario: no reemplaza inscripción pública |

### Contratos Clickaton

| Contrato | Estado vs FR |
|----------|--------------|
| `PublicRegistrationOffer` | **AUSENTE** (solo simulación economía JSON) |
| `RegistrationEligibility` | **AUSENTE** — requiere Identity |
| `ParticipantRegistrationSummary` | **AUSENTE** |
| `PublicCapacity` | **AUSENTE** (requiere cálculo + modelo) |
| `PublicCategoryCapacity` | **AUSENTE** |
| `PublicMarathonCapabilities` | **REQUIERE CÁLCULO** a partir de status/fechas/flags futuros |

---

## 6. Flujo de pagos

| Tema | Hallazgo |
|------|----------|
| Gateway FR | **Ninguno** |
| Mercado Pago en FR | No cableado |
| DNX Payments | No hay paquete/uso en FR para concursos |
| FREE/PAID | `rulesData.premiosRecompensas.economy.entryMode` — **simulación** + contador manual |
| Webhooks / idempotencia | N/A en dominio concurso |

**Recomendación:** Clickaton consume solo `PublicRegistrationOffer` (precios publicados). Cobro, webhooks y conciliación quedan en **FotoRank + DNX Payments** (o BFF autenticado). Nunca secretos ni tokens en Clickaton.

---

## 7. Consignas (crítico)

**Estado actual en FotoRank:** inexistentes. Riesgo de filtrado **hoy = nulo** (no hay datos).

Clickaton ya tiene defensa en profundidad: `lib/challenges.ts` + `sanitizePublicMarathon` (servidor).

### Riesgos futuros (cuando existan en FR)

| Riesgo | Severidad | Mitigación (diseño, no implementar) |
|--------|-----------|-------------------------------------|
| Incluir consignas no liberadas en DTO público | **Crítico** | Filtrar en serializador FR **antes** de JSON |
| Confiar solo en CSS/UI | **Crítico** | Nunca; filtro servidor obligatorio |
| Cachear payload con consignas programadas | **Alto** | Tags + TTL corto; no CDN sin revalidación |
| Logs con texto de consigna | **Medio** | Redactar en observabilidad |
| Lectura por ID/URL interna | **Alto** | Auth + ownership; no IDs predecibles en público |
| Metadata/OG con texto | **Medio** | Excluir de metadata |

---

## 8. GPS / EXIF

| Capacidad | FR | Notas |
|-----------|----|-------|
| Lat/lng en obra concurso | No | `FotorankContestEntry.metadataJson` sin contrato |
| EXIF pipeline | No en FR | CLF: `PhotoExifMetadata` sobre `Photo` |
| Geofence / tolerancia | No | — |
| `PublicValidationRule` | Solo tipado Clickaton | Mostrar reglas públicas; ocultar antifraude interno |

**Público:** explicación de política (`PublicValidationPolicy` / reglas).  
**Privado:** scores de fraude, distancias exactas, decisión automática, PII dispositivo.

---

## 9. Juzgamiento y resultados

**Existe (interno):** asignaciones, métodos de score, votos, historial, agregación (`judgeResultsForCategory.ts`), UI dashboard resultados.

**No existe (público):** `PublicMarathonResults`, flag de publicación, versionado de ranking, menciones/premios adjudicados como recurso público.

| Tema | Recomendación |
|------|---------------|
| Payload público | Solo tras estado `published` (+ opcional `partial`) |
| Ocultar | `authorUserId`, comentarios internos, scores crudos de jurados si política lo exige |
| Invalidación | Evento “publicar resultados” / “retractar” |

---

## 10. Galería y obras

| Tema | Estado |
|------|--------|
| Galería pública de evento | No |
| Entry con `imageUrl` | Sí (ops) |
| Consentimiento / crédito / compra CLF | No en FR |
| “Gallery” en UI FR | Plantillas de diplomas — no obras |

Contratos Clickaton `PublicMarathonGallery` / `PublicGalleryImage` → **AUSENTES** en fuente real.

---

## 11. Organizadores y sedes

| Concepto Clickaton | FR |
|--------------------|-----|
| Organizador | `ContestOrganization` |
| Sede / ciudad de edición | Solo campos org o copy; **sin** `PublicVenue` |
| Multi-sede / red | No |
| Director País/Provincia/Ciudad | No (roles org genéricos) |
| Liquidaciones / comisiones | Economía simulada en JSON |

Público: nombre, logo, ciudad/país, web.  
Privado: emails, teléfonos internos, finanzas, permisos.

---

## 12. Auth y permisos

| Actor | Mecanismo |
|-------|-----------|
| Organizador | DNX Identity + `hasAppAccess(..., "FOTORANK")` + rol en org |
| Jurado | Cookie `dnx_judge_session` distinta |
| Participante público | **No** hay flujo FR de participante |

### Implicaciones Clickaton

1. **Públicos:** listado, ficha, offer publicada, results/gallery publicados, notices.  
2. **Sesión:** eligibility, mi inscripción, upload, QR.  
3. SSO percibido: compartir Identity cookie entre dominios (misma family) — **parcialmente** preparado (logout limpia cookie CLF); falta producto Clickaton + scopes.  
4. Datos personalizados: **nunca** en caché CDN anónima.

---

## 13. APIs y servicios existentes

| Superficie | Auth | Reutilizable | Recomendación |
|------------|------|--------------|---------------|
| `GET /api/auth/google*` | OAuth | Bajo | No usar para maratones |
| `GET /api/diplomas/.../file` | Sesión org | No | Interno |
| `getPublicContestLandingBySlug` | Público (query) | **Sí como base de mapper** | Envolver en DTO + route handler |
| `listPublicHomeContests` | Público | Parcial listado | Idem |
| Server Actions concursos/jurados/entries | Org/juez | Interno | No convertir en API pública sin rediseño |
| Prisma desde páginas | — | Acoplamiento alto | Evitar desde Clickaton |

**Regla:** una Server Action privada **no** se convierte automáticamente en API pública.

---

## 14. Matriz de compatibilidad (resumen)

Ver detalle campo a campo en [FOTORANK_FIELD_MAPPING.md](./FOTORANK_FIELD_MAPPING.md).

Leyenda: EXISTE · PARCIAL · AUSENTE · LEGACY · REQUIERE CÁLCULO · REQUIERE AUTENTICACIÓN · NO DE PODER EXPONERSE → **NO DEBE EXPONERSE**

| Necesidad | Contrato | Estado |
|-----------|----------|--------|
| Listado | `PublicMarathon[]` | PARCIAL (contest landing list) |
| Ficha | `PublicMarathon` | PARCIAL |
| Estado ciclo maratón | `MarathonStatus` | AUSENTE / REQUIERE CÁLCULO |
| Territorio | city/province/country/venue | PARCIAL |
| Fechas + timezone | schedule windows | PARCIAL / AUSENTE TZ |
| Inscripción | offer / eligibility | AUSENTE |
| Precios | offer | PARCIAL (simulado) |
| Cupos | capacity | AUSENTE |
| Categorías | `PublicCategory` | PARCIAL |
| Bases | rules / rules version | PARCIAL |
| Cronograma | schedule items/windows | PARCIAL |
| Consignas | `PublicChallenge` | AUSENTE |
| Validaciones | validation policy/rules | AUSENTE (copy manual) |
| Jurado | `PublicJuryMember` | PARCIAL (perfiles públicos) |
| Sponsors | `PublicSponsor` | PARCIAL (texto) |
| Premios | `PublicPrize` | PARCIAL (JSON/summary) |
| Resultados | `PublicMarathonResults` | AUSENTE (interno sí) |
| Galería | gallery | AUSENTE |
| Organizador / sede | organizer / venue | PARCIAL / AUSENTE |
| Avisos | notices | AUSENTE |
| Capabilities | capabilities | REQUIERE CÁLCULO |
| Elegibilidad / mi inscripción | eligibility / summary | REQUIERE AUTENTICACIÓN |

---

## 15. Gaps (priorizados)

### P0 — bloquean maratón real

1. Modelo o extensión de concurso para **maratón** (o `eventKind`)  
2. **Inscripción** participante + Identity  
3. **Consignas** con release server-side  
4. **DTO públicos** + endpoints (no Prisma crudo)  
5. **Timezone** + ventanas registration/capture/upload  

### P1 — lanzamiento comercial

6. Pagos reales (DNX Payments / MP)  
7. Cupos y waitlist  
8. Resultados públicos  
9. Galería + consentimiento  

### P2 — red / escala

10. Sedes multi-ciudad y roles territoriales  
11. GPS/EXIF antifraude  
12. Certificados / CLF compra  

---

## 16. Riesgos

| Riesgo | Nivel | Nota |
|--------|-------|------|
| Acoplar Clickaton a Prisma FR | Alto | Rompe deploys independientes |
| Exponer `rulesData` completo | Alto | Puede contener economía/jurado interno |
| UNLISTED no servido en landing actual | Medio | Enum existe; path público filtra solo PUBLIC |
| Legacy status ACTIVE/SETUP | Medio | Mapear en serializador |
| Jurado Identity ≠ participante | Medio | Tres identidades (org/juez/participante) |
| Consignas futuras en caché | Crítico | Diseñar serialización segura desde día 1 |
| Simular precios como reales | Alto | Offer solo con flag “publicado” |

---

## 17. Arquitectura recomendada

### Opciones evaluadas

| Opción | Veredicto |
|--------|-----------|
| A. Clickaton → servicios internos compartidos / Prisma | Rechazada: acoplamiento + seguridad |
| B. FotoRank Route Handlers públicos | **Principal** |
| C. Paquete dominio compartido | Complemento (mappers/DTO types) |
| D. API service separado | Overkill hoy (Vercel monorepo) |
| E. BFF específico Clickaton | Alternativa si FR no debe conocer Clickaton |
| F. Server Actions cruzadas entre apps | **No viable** en deploys separados |

### Principal: **B + C ligero**

```
Clickaton (pages)
  → PublicMarathonService
  → FotorankPublicMarathonSource (HTTP)
       → apps/fotorank/app/api/public/v1/...
            → serializers (sanitize consignas, strip PII)
            → Prisma / domain loaders
```

**Alternativa:** E (BFF en Clickaton server que llama loaders vía paquete `@repo/fotorank-public` sin HTTP) — menor latencia, mayor acoplamiento de versión de package.

### Criterios

Seguridad, versionado, caché por tag, deploys independientes, testabilidad, latencia aceptable en Vercel, camino a app móvil (HTTP versionado).

---

## 18. Versionado

| Mecánica | Uso |
|----------|-----|
| **Versión en ruta** `/api/public/v1/...` | **Sí** — contrato estable |
| Header `Accept-Version` | Opcional secundario |
| Campos opcionales | Evolución no breaking |
| Breaking | `v2` nuevo; Clickaton pinnea v1 |

Nunca romper campos requeridos de `PublicMarathon` sin major.

---

## 19. Caché e invalidación

| Recurso | Caché | Invalidación |
|---------|-------|--------------|
| Listado | ISR/tag `marathons:list` · 60–300s | publish / unpublish / featured |
| Ficha | tag `marathon:{slug}` · 60–300s | update editorial / status |
| Offer / cupos | TTL corto (15–60s) o on-demand | inscripción / pago |
| Consignas | TTL corto; **revalidar en releaseAt** | cron o evento release |
| Resultados / galería | tag hasta retract | publish results |
| Eligibility / mi inscripción | **Sin caché pública** | — |

**Nunca cachear públicamente:** eligibility, registration summary, payloads con consignas no liberadas, PII.

---

## 20. Observabilidad

Registrar (futuro):

- latencia y status de `/api/public/v1/*`
- `slug` not found / not public
- payload inválido / incompatibilidad de versión
- intentos de consignas filtradas (conteo, no texto)
- auth failures en endpoints protegidos
- inconsistencia status↔fechas

---

## 21. Plan de implementación por etapas

| Etapa | Objetivo | App | Dependencias | Riesgo | Criterio de aceptación |
|-------|----------|-----|--------------|--------|------------------------|
| **08A** ✅ | Serializers + DTO públicos seguros (sin HTTP) | fotorank `app/lib/public-api/v1` | Etapa 07 | Medio | Contrato V1 sin PII/`rulesData`; selfcheck OK |
| **08B** ✅ | `GET /api/public/v1/events` + `/events/[slug]` | fotorank | 08A | Medio | Envelope V1; loaders 08A; sin CORS abierto; sin PII |
| **08C** ✅ | Ficha por slug (absorbido en 08B) | fotorank | 08A | Medio | Mismo detalle; ruta genérica `events` (no `marathons`) |
| **08D** | Adaptador `FotorankPublicMarathonSource` | clickaton | 08B | Medio | Toggle env; fetch server-to-server; fallback local |
| **08E** | Caché tags + revalidate | ambos | 08D | Medio | Invalidación al publicar |
| **09** | Identity + eligibility endpoints | fotorank + clickaton | Identity | Alto | Sesión; sin cache público |
| **10** | Inscripción real | fotorank | 09 + modelo registration | Alto | Alta + category + bases |
| **11** | Pagos | fotorank + payments | 10 | Alto | FREE/PAID real; webhooks |
| **12** | Área participante | clickaton + fotorank | 10–11 | Alto | Summary + QR stub |
| **13** | Consignas + release | fotorank | 08A | Crítico | Imposible leer antes de release |
| **14** | Resultados + galería públicos | fotorank + clickaton | scoring existente | Medio | Payload published only |
| **15** | GPS/EXIF + sedes | fotorank | 10 | Alto | Reglas públicas vs antifraude |

Estado post-08B: serializers + HTTP listado/detalle en FotoRank. **Integración real Clickaton pendiente (08D).** Sin CORS abierto; sin fetch desde Clickaton.

---

## 22. Fuera de alcance (confirmado en 07; actualizado)

Sin adaptador Clickaton, Prisma/migrations desde Clickaton, auth, pagos, UI, deploy, env de URL FR en Clickaton, webhooks. 08A/08B **sí** entregaron capa segura + HTTP en FotoRank.

---

## 23. Referencias de código

- Public API V1: `apps/fotorank/app/lib/public-api/v1/` · HTTP `apps/fotorank/app/api/public/v1/`
- Landing: `apps/fotorank/app/lib/fotorank/publicContestLanding.ts`
- Entries: `apps/fotorank/app/actions/fotorank-contest-entries.ts`, `fotorankContestEntryDomain.ts`
- Economía: `apps/fotorank/app/lib/fotorank/prizesRewards.ts`
- Schema: `packages/db/prisma/schema.prisma` (`FotorankContest`, enums status/visibility)
- Clickaton acceso: `apps/clickaton/data/public-marathons/*`
- Consignas Clickaton: `apps/clickaton/lib/challenges.ts`
