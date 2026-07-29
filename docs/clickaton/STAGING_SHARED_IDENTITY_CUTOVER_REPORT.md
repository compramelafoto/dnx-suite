# Informe — Cutover Clickatón a identidad DNX compartida

**Fecha actualización:** 2026-07-29 (etapa **10B.6.2**)  
**Estado final:**

```text
FOTORANK DOMAIN MIGRATION BLOCKED
```

Nomenclatura: **ComprameLaFoto monorepo** (suite) vs **ComprameLaFoto legacy** (histórico). Destino de identidad = DNX Suite Staging (`ep-round-fog…`).

Clickatón Staging ya corre contra la DB de identidad compartida (6 ediciones). El éxito estricto `DNX UNIVERSAL ACCOUNT READY IN STAGING` **no** se declara porque FotoRank Preview no tiene dominio migrado ni deploy verde sobre esa identidad.

---

## 1. Credencial Neon

| Chequeo | Resultado |
| ------- | --------- |
| `NEON_API_KEY` en shell del proceso | Ausente |
| Auth Neon válida | **Sí** vía sesión OAuth `neonctl` (`dnxfotografia@gmail.com`, org `org-bold-morning-27184918`) |
| Proyecto Clickatón Staging `plain-sky-50672248` | Acceso OK |
| Proyecto DNX Staging Identity `fragrant-union-80829821` (`ep-round-fog…`) | Acceso OK |
| Endpoint `ep-empty-moon…` (FotoRank histórico) | **No** existe en la org Neon Dnx |

No se imprimió ni persistió ningún secret. Connection strings solo en proceso + `packages/db/.env.cutover.local` (gitignored, mode `0600`).

---

## 2. Recursos Neon (sanitizados)

| Rol | Project ID | Name | Branch | Endpoint | Database |
| --- | ---------- | ---- | ------ | -------- | -------- |
| Origen Clickatón | `plain-sky-50672248` | clickaton-staging | `br-lucky-dust-avvqom7b` (primary) | `ep-divine-smoke-av8hmt7s…` | `clickaton_staging` |
| Destino identidad | `fragrant-union-80829821` | dnx-suite-staging | `br-noisy-flower-a4ovb3yc` (primary, nombre histórico `production` en Neon) | `ep-round-fog-a4xgibtv…` | `neondb` |
| Backup origen | mismo proyecto | — | `br-polished-night-avzrcfq6` / `backup-before-identity-cutover` | `ep-winter-unit-avgjepw8…` | `clickaton_staging` |
| Backup destino | mismo proyecto | — | `br-patient-breeze-a4zmb4pl` / `backup-before-clickaton-import` | `ep-purple-dawn-a4hlfobu…` | `neondb` |

`source != destination` confirmado (hosts distintos). Production (`dawn-dew` / clickaton-production) **no** tocada.

---

## 3. Backups verificables

| Backup lógico | Branch | Created (UTC) | Verificación |
| ------------- | ------ | ------------- | ------------ |
| `backup-before-identity-cutover` | `br-polished-night-avzrcfq6` | 2026-07-29T07:10:05Z | Editions=6, Users=7, Registrations=11, migrations=85 |
| `backup-before-clickaton-import` | `br-patient-breeze-a4zmb4pl` | 2026-07-29T07:10:06Z | Users=3, UserSession=40, migrations≈44, **sin** tablas Clickatón |

Origen intacto post-cutover (no se borró divine-smoke).

---

## 4. Connection strings

Cargadas en proceso desde `packages/db/.env.cutover.local`:

- `CLICKATON_SOURCE_DATABASE_URL` / `CLICKATON_SOURCE_DIRECT_URL` → divine-smoke / `clickaton_staging`
- `DNX_IDENTITY_DATABASE_URL` / `DNX_IDENTITY_DIRECT_URL` → round-fog / `neondb`

SQL connectivity OK antes y después del cutover.

---

## 5–7. Auditoría destino + `prisma migrate deploy`

- Pre-cutover destino: Users=3, Sessions=40, ~45 migraciones, sin dominio Clickatón.
- Ejecutado **solo** `prisma migrate deploy` (nunca `db push`).
- Post-deploy destino: **89** migraciones aplicadas; tablas Clickatón creadas e importadas.
- Nota: migraciones WIP FotoRank (`FotorankJury*`, rules-config, results) dejaron tablas en DB **sin** modelos equivalentes completos en `schema.prisma` actual → deriva schema/cliente (bloquea build FotoRank).

---

## 8–10. Dry-run / reconciliación / cutover

| Paso | Resultado |
| ---- | --------- |
| Dry-run CLI `pnpm clickaton:staging:identity-cutover` | Limpio (sin `MANUAL_REVIEW`) |
| Phase 1 execute | 7 users → `CREATE_CANONICAL_USER`; mapa `ClickatonLegacyUserMap` |
| Batch ID | `cutover-2026-07-29T07:13:48.698Z` (7 filas) |
| Phase 2 dominio | `packages/db/scripts/staging-identity-cutover-phase2.py` (remap FKs User) |
| Admins Daniel/Tammy/Rodrigo en origen Staging | **No** estaban (solo users de test) |
| Roles CLF / FotoRank | No alterados |

Origen **no** borrado.

---

## 11. Integridad origen ↔ destino

| Entidad | Origen | Destino | Diferencia |
| ------- | -----: | ------: | ---------: |
| ClickatonEdition | 6 | 6 | 0 |
| ClickatonVenue | 6 | 6 | 0 |
| ClickatonTicketType | 6 | 6 | 0 |
| ClickatonRegistration | 11 | 11 | 0 |
| ClickatonRegistrationPricePhase | 0 | 0 | 0 |
| ClickatonProduct / Variant | 0 / 0 | 0 / 0 | 0 |
| DnxPromotion | 0 | 0 | 0 |
| Timeline / Prompt / FotoRankSync / Outbox / Finance / Accreditation | 0… | 0… | 0 |
| ClickatonParticipantCredential | 1 | 1 | 0 |
| User | 7 | 14+ | + (seeds CLF + canónicos + fixtures) |

Validaciones:

- FK huérfanas Registration→User: **0**
- `ClickatonLegacyUserMap`: **7**, unresolved: **0**
- Duplicados email: **0**
- Diferencias críticas de dominio Clickatón: **0**

Health vivo Clickatón Staging:

- `ok: true`
- `databaseHostHint: ep-round-fog-a4xgibtv-pooler`
- `publishedEditions: 6`

---

## 12. FotoRank

| Ítem | Estado |
| ---- | ------ |
| Host histórico `ep-empty-moon…` | **Inaccesible** en org Neon Dnx (no hay project/endpoint) |
| Backup Neon FotoRank Preview | **No** — sin proyecto API |
| `DATABASE_URL` Preview branch `migration-legacy-clf-to-monorepo` | Encrypted (actualizado en sesión cutover; pull vacío por tipo sensitive) |
| Contests en round-fog | **0** (sin import de dominio empty-moon) |
| Tablas Fotorank* en round-fog | 46 (incl. WIP jury/results/rules no alineadas al client) |
| Deploy Preview | **ERROR** (`dpl_NP1rBWQ5DJ34Y2YfGUFkFPNaDENq`) — TS/Prisma drift jury/rules |
| Production FotoRank / `fotorank.com` | **No** modificada |

Bloqueo: no se puede alinear runtime FotoRank a identidad compartida sin (a) recuperar empty-moon o (b) aceptar dominio vacío + arreglar build/schema.

---

## 13. Variables Vercel

| App | Cambio | Production |
| --- | ------ | ---------- |
| Clickatón Staging (`clickaton-staging`) | `DATABASE_URL` / `DIRECT_URL` → round-fog | N/A (este proyecto **es** Staging; prod Clickatón es otro proyecto) |
| FotoRank Preview (branch) | `DATABASE_URL` / `DIRECT_URL` Encrypted branch override | **Sin cambios** |
| `maratonfotografica.com` Production | — | **No tocado** |

Controles Staging Clickatón (env):

- Mercado Pago: `MERCADOPAGO_CREDENTIALS_SOURCE=credenciales_de_prueba` (LIVE off)
- Inscripciones / social publisher LIVE: se mantienen cerrados / off (sin apertura en esta etapa)

---

## 14. Deploys / checks

| Ítem | Evidencia |
| ---- | --------- |
| Clickatón Staging READY | `dpl_4XU5Xd9aCGgZGHBfEVnoS8LnKfLg` → `https://clickaton-staging.vercel.app` |
| Health DB | round-fog + 6 ediciones |
| FotoRank Preview | ERROR (ver §12) |
| Fixtures | `pnpm auth:cross-app:fixtures` → **ALL FIXTURES PASS** |
| Auth UI rollout | **No** (pendiente READY) |

---

## 15. Fixtures cross-app 1–6

Ejecutados contra `DNX_STAGING_IDENTITY_DATABASE` (`ep-round-fog…`):

| # | Caso | Resultado |
| - | ---- | --------- |
| 1 | Histórico ComprameLaFoto monorepo (seed) | PASS (`userId` 1) |
| 2 | Registro Clickatón | PASS |
| 3 | Registro FotoRank | PASS |
| 4 | Forgot/reset cross-app | PASS (mismo `User.id`) |
| 5 | Google + email existente | PASS (un solo id) |
| 6 | Google-only + password | PASS (un solo id) |

---

## 16. Guest registration

Sin cambios de decisión: `docs/clickaton/CLICKATON_GUEST_REGISTRATION_IDENTITY_FLOW.md`.

---

## 17. Auth UI (`@repo/auth-ui`)

Sin rollout hasta `DNX UNIVERSAL ACCOUNT READY IN STAGING`.

---

## 18. Mercado Pago

- Sin OAuth LIVE.
- Tammy **no** estaba en origen Staging cutover; no hay duplicado forzado.
- `DnxPaymentAccount` puede vincular User canónico cuando exista en esta DB.

---

## 19. Rollback

| Capa | Plan |
| ---- | ---- |
| App Clickatón | Apuntar de nuevo a divine-smoke + redeploy |
| DB destino | Restaurar desde branch `backup-before-clickaton-import` / no borrar Users con actividad multi-app |
| DB origen | Sigue intacta en divine-smoke + branch `backup-before-identity-cutover` |
| FotoRank | No hay cutover de dominio aplicado; Production intacta |

---

## 20. Veredicto

```text
FOTORANK DOMAIN MIGRATION BLOCKED
```

**Listo en Staging para Clickatón + ComprameLaFoto monorepo (identidad compartida + 6 ediciones + fixtures).**  
**Bloqueado para READY universal:** FotoRank sin backup/import de `ep-empty-moon…`, Preview deploy rojo, schema/client drift en módulos jury/rules.
