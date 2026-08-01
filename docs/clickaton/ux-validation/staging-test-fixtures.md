# Fixtures de prueba staging — Imp. 03

**Fecha de creación:** 2026-08-01  
**Entorno:** Neon staging `ep-round-fog…` / proyecto Vercel `clickaton-staging`  
**Convención:** nombres con `TEST UX`; emails `@clickaton.staging.test`  
**Credenciales:** solo en `.local/clickaton-ux-staging/credentials.json` (gitignored). **No** en este documento.

## Mecanismo

```bash
CLICKATON_SEED_UX_STAGING=1 pnpm --filter clickaton seed:ux-staging-auth
```

Script: `apps/clickaton/scripts/seed-ux-staging-auth-fixtures.ts`  
Reutiliza edición piloto: `seed-pilot-edition-test` → slug `piloto-test-11b`.

## Edición

| Campo | Valor |
|-------|--------|
| Nombre | Clickatón Piloto TEST 11B |
| Slug | `piloto-test-11b` |
| ID sanitizado | `cmsa4srhh***` |
| Estado | Publicada; inscripción **abierta** |
| Precio | Gratis + entrada paga sandbox $1.000 ARS + pack TEST |
| Visibilidad | Staging; copy “Entorno de prueba: no se realiza un cobro real.” |
| Conservar | **Sí** — fixture QA recurrente |

## Perfiles de usuario

| Clave | Email (máscara) | Rol | Propósito | Conservar |
|-------|-----------------|-----|-----------|-----------|
| admin | `ux.admin@***` | SUPER_ADMIN | Panel admin completo | Sí |
| participantConfirmed | `ux.participant.confirmed@***` | USER | Mi cuenta con inscripción confirmada/pago aprobado en piloto | Sí |
| participantEmpty | `ux.participant.empty@***` | USER | Mi cuenta sin inscripción; funnel | Sí |
| noPermission | `ux.noperm@***` | USER | Acceso denegado a `/admin` | Sí |

Datos sintéticos: documento/teléfono/Instagram ficticios; consentimiento solo para UI (fixture técnico, no aceptación legal real).

## Relaciones

* Inscripción confirmada → edición piloto; estado CONFIRMED / pago APPROVED (vía seed de dominio existente).
* No se insertaron webhooks falsos ni ledger productivo.
* No se modificaron participantes reales ni ediciones operativas (AR2026 intacta).

## Limpieza

| Estrategia | Detalle |
|------------|---------|
| Preferida | Conservar fixtures etiquetados `TEST UX` para regresiones |
| Opcional | Borrar usuarios `*@clickaton.staging.test` y re-seed |
| Prohibido | Borrar ediciones smoke/`ed_smoke_*` ajenas o datos sin prefijo TEST UX |

Archivo local de IDs/credenciales: `.local/clickaton-ux-staging/` (no Git).

## Escenarios cubiertos vs pendientes

| Escenario | Cobertura |
|-----------|-----------|
| Visitante | N/A (sin login) |
| Participante sin inscripción | `participantEmpty` |
| Confirmado / pago aprobado | `participantConfirmed` |
| Admin general | `admin` |
| Sin permisos admin | `noPermission` |
| Pendiente de pago / acreditación / kit / entrega / revisión foto | **No** creados en Imp. 03 (no críticos para cierre PARTIAL) |
