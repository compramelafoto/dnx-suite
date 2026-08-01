# FotoRank P0-01 — Informe de implementación

**Fecha:** 2026-07-28  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD al inicio:** `aa92de8`  
**Alcance:** inscripción nativa FREE, bases versionadas, fee BPS + snapshot, storage privado (infra), funnel mínimo.

---

## 0. Preflight y contradicciones docs ↔ código

| Hallazgo | Decisión |
|----------|----------|
| Gap analysis decía “no hay inscripción”; existe `FotorankContestParticipant` (roster sync Clickatón, migración `20260728070000`) | **No reutilizar.** Se creó `FotorankContestRegistration` para inscripción nativa FR. |
| `/participaciones` vivía bajo layout organizador (`hasAppAccess` + org obligatoria) | Movido a route group `(participant)` solo con `requireAuth`. |
| Login siempre redirigía a `/dashboard` | Soporte `?next=` seguro para volver al funnel. |
| `packages/db` `.env` apunta a Neon remoto; `migrate deploy` falló en migración ajena Clickatón (`ClickatonContactMessage` already exists) | **No se aplicó** la migración P0-01 en remoto. No tocar producción. |

---

## 1. Modelos creados o reutilizados

### Nuevos

| Modelo | Rol |
|--------|-----|
| `FotorankContestRegistration` | Inscripción participante (1 user × concurso) |
| `FotorankContestRulesVersion` | Bases versionadas inmutables al publicar |
| `FotorankContestEntryAsset` | Metadatos/key de assets privados (sin upload UI) |

### Enums nuevos

- `FotorankContestRegistrationStatus`: DRAFT, PENDING_PAYMENT, CONFIRMED, CANCELLED, DISQUALIFIED  
- `FotorankContestRegistrationPaymentStatus`: NOT_REQUIRED, PENDING, PAID, FAILED, REFUNDED  
- `FotorankFeeSource`: NONE, ORGANIZER_DEFAULT, CONTEST_OVERRIDE  
- `FotorankRulesVersionStatus`: DRAFT, PUBLISHED, ARCHIVED  
- `FotorankEntryAssetKind`: ORIGINAL, DERIVATIVE_WEB, THUMBNAIL, JUDGE_VIEW, PUBLIC  
- `FotorankRegistrationPricingMode` += `INVITATION_ONLY`

### Extendidos

- `ContestOrganization.platformFeeBps`  
- `FotorankContest`: `platformFeeBps`, `submissionOpensAt`, `timezone`, `allowRegistrationCancellation`  
- `FotorankContestEntry.assets` (relación)  
- `rulesText` conservado como **compat/espejo**; fuente legal = RulesVersion PUBLISHED

### Reutilizados (sin duplicar)

- Auth `User` + `@repo/auth` / cookie `dnx_session`  
- Campos 09B1 FREE/PAID en `FotorankContest`  
- Soft ref `paymentOrderId` → `DnxPaymentOrder` (sin FK)  
- Patrón FREE sin orden (Clickatón)  

---

## 2. Migraciones

| Migración | Contenido |
|-----------|-----------|
| `packages/db/prisma/migrations/20260728120000_fotorank_p0_01_registration_rules_fee_assets/` | Enums, fee BPS, rules versions, registrations, entry assets |

**Rollback (manual):** drop tables `FotorankContestEntryAsset`, `FotorankContestRegistration`, `FotorankContestRulesVersion`; drop new enums; drop columns fee/windows; remove `INVITATION_ONLY` del enum (complicado en PG — documentar restore backup).

**Aplicación:** solo en DB local limpia / staging explícito. **No aplicada** en Neon del `.env` actual (drift Clickatón previo).

---

## 3. Flujo FREE

1. Landing CTA → `/concursos/{slug}/inscripcion`  
2. Sin sesión → `/login?next=…/inscripcion`  
3. Validar ventana + categoría ACTIVE + bases PUBLISHED  
4. Snapshot financiero: precio 0, fee 0 bps, `feeSource=NONE`  
5. Status `CONFIRMED`, `paymentStatus=NOT_REQUIRED`, `paymentOrderId=null`  
6. **No** se crea `DnxPaymentOrder`  
7. Número de inscripción + aceptación (versión, IP, UA)

---

## 4. Preparación PAID

- `resolveFinancePolicy` calcula fee BPS (override concurso > org > 0)  
- Inscripción queda `PENDING_PAYMENT` / `paymentStatus=PENDING`  
- Snapshot de precio/fee/currency guardado  
- `checkoutUrl` permanece `null` hasta 09B2 (`@repo/payments`)  
- **No** se construyó checkout paralelo  
- Confirmación post-pago: pendiente de webhook DNX (siguiente etapa)

---

## 5. Bases versionadas

- `publishRulesVersion`: archiva PUBLISHED anterior, crea nueva, hashea SHA-256, espeja `rulesText`  
- Inscripción exige `rulesVersionId` = vigente  
- Placeholder `BORRADOR — REEMPLAZAR…` bloqueado en producción (`NODE_ENV`/`VERCEL_ENV`)  
- Seed local/staging usa placeholder con guard

---

## 6. Storage privado

- Adapter + keys: `fotorank/contests/{contestId}/registrations/{registrationId}/entries/{entryId}/{kind}`  
- Memory adapter para tests; bucket via `FOTORANK_PRIVATE_BUCKET`  
- ACL helper `canAccessEntryAsset` (participante dueño / org / system)  
- **Sin** URL pública permanente; **sin** upload UI aún

---

## 7. APIs

| Método | Path |
|--------|------|
| POST | `/api/fotorank/contests/[contestId]/registrations` |
| GET | `/api/fotorank/contests/[contestId]/registrations/me` |
| DELETE | `/api/fotorank/contests/[contestId]/registrations/me` |
| GET | `/api/fotorank/contests/[contestId]/rules/current` |

Servicios: `apps/fotorank/app/lib/fotorank/registration/*`

---

## 8. UI

| Superficie | Cambio |
|------------|--------|
| Landing | CTA → `/inscripcion` (no login organizador) |
| `/concursos/[slug]/inscripcion` | Categoría + bases + checkbox + confirm FREE |
| Login | `next` seguro + copy participante |
| `/participaciones` | Lista real (route group participant) |

---

## 9. Tests

| Test | Resultado |
|------|-----------|
| `registration.selfcheck.ts` (unit/domain) | **PASS** |
| `registration.integration.selfcheck.ts` | **SKIP / no ejecutado contra DB** (migración no aplicada en Neon; drift previo) |
| E2E `public-free-registration.spec.ts` | Escrito; **no ejecutado** (requiere migrate+seed local) |
| `pnpm check-types` (fotorank tsc) | **PASS** |
| `pnpm lint` (fotorank) | **FAIL por warnings preexistentes** (`--max-warnings 0`); sin errores nuevos de sintaxis |

---

## 10. Bloqueos

1. Drift de migraciones en DB remota del `.env` (Clickatón) impide `migrate deploy` seguro.  
2. Falta DB local limpia para integration/E2E verdes en esta máquina.  
3. Checkout PAID / webhooks DNX aún no cableados (esperado).  
4. UI admin para publicar bases no incluida (solo servicio + seed).  
5. Public API `confirmedCount` aún no cableado a contador real (pendiente menor).

---

## 11. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Aplicar migrate en Neon roto | No deploy; usar DB local |
| Placeholder bases en prod | Guard en `publishRulesVersion` + seed bloqueado |
| Participante sin AppAccess | Layout participant sin gate org |
| Doble dominio Participant vs Registration | Documentado; no mezclar |
| PAID visible sin checkout | PENDING_PAYMENT + checkoutUrl null |

---

## 12. Próximo paso recomendado

**P0-06 / continuación:** upload seguro de 1 fotografía → hash SHA-256 → EXIF no bloqueante → checklist → confirmación de obra; cablear `confirmedCount` en Public API; UI org “Publicar bases”; panel organizador de inscripciones.

Prompt sugerido: **FOTORANK — ETAPA P0-06 — UPLOAD PRIVADO, HASH, EXIF Y CHECKLIST DE OBRA**.

---

## Confirmación

- No se hizo commit, push ni deploy.  
- No se modificó producción.  
- No se tocaron cambios ajenos de Clickatón/InfoSpot salvo schema Prisma compartido (aditivo).  
- Documentos de auditoría previos conservados y plan actualizado.
