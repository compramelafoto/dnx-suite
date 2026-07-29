# Validación cross-app Staging — identidad DNX

**Fecha:** 2026-07-29  
**Etapa:** 10B.6.3  

**Estado:**

```text
DNX UNIVERSAL ACCOUNT READY IN STAGING
```

---

## 1. Credencial / acceso Neon

| Chequeo | Resultado |
| ------- | --------- |
| `NEON_API_KEY` en env del proceso | Ausente |
| Auth efectiva | OAuth `neonctl` — válida |
| Org visible | Dnx (`org-bold-morning-27184918`) |
| DNX Staging Identity `fragrant-union-80829821` / `ep-round-fog…` / `neondb` | OK |
| FotoRank histórico `ep-empty-moon…` | **No** en org — clasificado `IDENTITY_ONLY_OR_DISPOSABLE` (ver discovery FR) |

No se usó Production.

---

## 2. Topología Staging (sanitizada)

| App / rol | Host | DB | Estado |
| --------- | ---- | -- | ------ |
| Clickatón Staging | `ep-round-fog-a4xgibtv-pooler…` | `neondb` | Identidad + dominio OK |
| Origen Clickatón (conservado) | `ep-divine-smoke…` | `clickaton_staging` | Intacta |
| ComprameLaFoto monorepo Preview | `ep-round-fog…` | `neondb` | Misma identidad |
| FotoRank Preview / Staging alias | `ep-round-fog…` | `neondb` | Identidad DNX; dominio FR tablas OK, contests=0 |
| FotoRank Production | `ep-dawn-dew…` | (prod) | **No tocada** |

---

## 3. Backups

| Nombre lógico | Branch Neon | Notas |
| ------------- | ----------- | ----- |
| `backup-before-identity-cutover` | `br-polished-night-…` | Pre-cutover identidad |
| `backup-before-clickaton-import` | `br-patient-breeze-…` | Pre-import Clickatón |
| `backup-before-fotorank-import` | `br-rough-base-a482gvuw` | Pre-trabajo FotoRank 10B.6.3 |

---

## 4. Cutover Clickatón (no re-ejecutado en 10B.6.3)

Batch: `cutover-2026-07-29T07:13:48.698Z`  
Integridad: Editions 6/6, Registrations 11/11, diffs críticos 0, orphans 0.  
Deploy Clickatón: `dpl_4XU5Xd9aCGgZGHBfEVnoS8LnKfLg` (etapa 10B.6.2).

---

## 5. FotoRank 10B.6.3

| Tema | Resultado |
| ---- | --------- |
| empty-moon | Sin import — `FOTORANK SOURCE DOMAIN EMPTY — NO IMPORT REQUIRED` |
| Schema/client drift jury/rules | Corregido (`packages/db` fuente única) |
| Runtime Preview | Fix `ERR_REQUIRE_ESM` (quitar `"type": "module"`) |
| Commit | `f308683` |
| Deploy | `dpl_DLpvW5PN5vjihaMvBYGGoXyyJbbQ` |
| Alias | `https://fotorank.staging.dnxsuite.com` |
| Health | `ok:true`, host `ep-round-fog-a4xgibtv-pooler`, contests=0, editions=6 |

Detalle: `docs/fotorank/FOTORANK_STAGING_DOMAIN_CUTOVER_REPORT.md`.

---

## 6. Fixtures 1–6 (DB identidad compartida)

Comando: `pnpm auth:cross-app:fixtures` (DB = round-fog).

```text
ALL FIXTURES PASS
```

| # | Caso | Resultado |
| - | ---- | --------- |
| 1 | Usuario histórico CLF monorepo | OK — mismo `User.id` |
| 2 | Registro Clickatón → password shared | OK |
| 3 | Registro FotoRank → login shared | OK |
| 4 | Reset password → mismo `User.id` cross-app | OK |
| 5 | Email+password + Google → un solo `User.id` | OK |
| 6 | Google-only → set password → login email | OK |

Mapeo solicitado etapa (A–F) cubierto por fixtures 1–6 anteriores.

---

## 7. Smoke dominio FotoRank Staging

Rutas principales (home, login, register, forgot, contests, jury, health, events, Google start): **HTTP 200** / redirect Google.  
Sin acciones destructivas; sin contests LIVE en Staging.

---

## 8. Auth-UI

Rollout `@repo/auth-ui` **aplazado** a:

`ETAPA 10B.7.1 — ROLLOUT AUTH-UI COMPRAMELAFOTO MONOREPO + CLICKATÓN + FOTORANK`

---

## 9. Controles de seguridad Staging

| Control | Estado |
| ------- | ------ |
| Production DBs | No modificadas |
| MP LIVE OAuth | No ejecutado |
| Re-cutover Clickatón | No |
| Credenciales en docs | Solo hosts sanitizados |

---

## 10. Criterios READY

| Criterio | Cumple |
| -------- | ------ |
| FotoRank Preview/Staging verde | Sí |
| FotoRank usa identidad DNX (`ep-round-fog`) | Sí |
| Contests existentes no perdidos | Sí (origen vacío / disposable; destino 0 esperado) |
| Users no duplicados (fixtures) | Sí |
| Forgot/reset cross-app | Sí |
| Google sin duplicar identidad | Sí |
| Jury/rules compilando + rutas jury 200 | Sí |
