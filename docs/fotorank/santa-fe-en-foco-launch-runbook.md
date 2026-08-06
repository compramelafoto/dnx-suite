# Santa Fe en Foco — Launch runbook + rollback (P0-08b)

**RC:** `FOTORANK-SFEF-2026-RC1` (no desplegado)  
**Resultado actual:** **NO-GO** — ver `fotorank-p0-08b-ops-go-no-go-report.md`  
**Prohibido:** Neon prod · `db push` final · bucket `fotorank-uploads` · deploy producción sin GO

> **ADVERTENCIA PRODUCTIVA:** `origin/main` **no** es la fuente de FotoRank en producción.  
> Rama canónica: `release/fotorank-production`.  
> Política: `docs/fotorank/FOTORANK_PRODUCTION_BRANCH_POLICY.md`.  
> No desplegar FotoRank desde `main`.

---

## Valores operativos (staging local actual)

| Campo | Valor |
|-------|--------|
| Ambiente | `FOTORANK_APP_ENV=staging` |
| DB | `postgresql://…@localhost:5432/fotorank_staging_2026` |
| Bucket R2 staging | objetivo `fotorank-private-staging` — **aún no operativo** |
| Storage activo | `local` (fallback) / forzar `r2` sin creds → error explícito |
| Timezone propuesta | `America/Argentina/Cordoba` |
| Fechas oficiales | **PENDING HUMAN CONFIRMATION** (seed propone 1 ago–30 sep 2026) |
| Slug | `santa-fe-en-foco` |
| Versión bases | seed placeholder — **no válida para GO** |
| Categorías seed | general + celular + cámara |
| Email | Resend (`RESEND_API_KEY`) — **no configurado** |
| E2E skip seed | `FOTORANK_E2E_SKIP_DB_SEED=1` en staging pre-seedado |

---

## 0. Preflight

```bash
export FOTORANK_APP_ENV=staging
export DATABASE_URL='postgresql://USER@localhost:5432/fotorank_staging_2026'
export DIRECT_URL="$DATABASE_URL"
pnpm --filter fotorank run db:assert-safe
```

STOP si falla.

## 1–3. DB + migraciones + seed

```bash
pnpm --filter fotorank run db:migrate:isolated
pnpm --filter fotorank run db:seed:bootstrap-admin   # password scrypt 123456
pnpm --filter @repo/db run db:seed:santa-fe-en-foco
```

## 4. Bases oficiales

1. Admin → Bases → borrador con texto **oficial** (sin BORRADOR/REEMPLAZAR/TODO/PENDIENTE).  
2. Publicar → hash + fecha + responsable.  
3. `pnpm --filter fotorank run contest:validate-launch-config` debe dejar de reportar `rules_placeholder`.

## 5–6. Categorías y fechas

Confirmar con organizador (`pending-decisions.md`). Actualizar concurso (no hardcodear en dominio genérico).

## 7. R2 staging

```bash
export FOTORANK_PRIVATE_STORAGE_PROVIDER=r2
# FOTORANK_R2_* solo staging (bucket con "staging")
pnpm --filter fotorank run test:storage:r2-staging   # debe PASS, no SKIP
```

Cargar vars solo en Vercel **Preview** del proyecto `fotorank-dnxsuite`. Nunca Production en esta etapa.

## 8. Email staging

Configurar `RESEND_API_KEY` + `EMAIL_FROM` / `DNX_EMAIL_FROM` en Preview.  
Validar 5 templates con destinatarios fixture. Inscripción no debe fallar si email falla.

## 9. Smoke / validate

```bash
pnpm --filter fotorank run contest:validate-launch-config   # exit 0 requerido para GO
pnpm --filter fotorank run contest:verify-free
pnpm --filter fotorank run test:registration:integration
pnpm --filter fotorank run test:entries:integration
pnpm --filter fotorank run test:jury:integration
pnpm --filter fotorank run check-types
pnpm --filter fotorank run build
# E2E (DB staging, seed skip si ya seedado):
export FOTORANK_E2E_SKIP_DB_SEED=1
# opcional: abrir ventanas para prueba
pnpm --filter @repo/db exec tsx ../../apps/fotorank/scripts/open-sfef-windows-for-e2e.ts
pnpm --filter fotorank exec playwright test e2e/public-free-registration.spec.ts e2e/public-entry-upload.spec.ts e2e/jury-anonymous-panel.spec.ts
```

## 10. Abrir inscripciones (solo tras GO)

1. Bases oficiales publicadas  
2. R2 PASS  
3. Email staging OK o excepción documentada  
4. E2E críticos PASS  
5. `registrationEnabled=true` + ventanas oficiales  
6. Verificar primera inscripción FREE + primer upload + métricas

## Cierre de emergencia

| Acción | Cómo |
|--------|------|
| Cerrar inscripciones | `registrationEnabled=false` o `registrationClosesAt=now` |
| Cerrar uploads | `submissionDeadline=now` |
| Mensaje público | banner / shortDescription |
| R2 incidente | rotar keys; TTL corto; no exponer bucket |
| Mantener datos | no borrar obras/inscripciones |

## Rollback (resumen)

Login / inscripción / R2 / procesamiento / DB / assets / bases / fechas / apertura prematura:  
cerrar flags, conservar datos, mensaje amigable, revocar firmas, no tocar prod.  
Detalle en P0-08 runbook histórico + este archivo.

### Cron limpieza (futuro)

`test:release:orphan-assets` → listar → quarantine → delete TTL. Sin auto-delete prod en P0.
