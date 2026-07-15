# 15 — Staging apply + credenciales sandbox (Etapa 05)

## Resultado staging

| Ítem | Estado |
|---|---|
| Host objetivo | Neon staging `ep-round-fog*` (no Production) |
| Migración payments | `20260715170000_dnx_payments_core_persistence` **applied** |
| Clasificación SQL | `SAFE_ADDITIVE` |
| `prisma migrate deploy` completo | **No ejecutado** |
| Motivo | Habría aplicado también 3 migraciones FotoRank ajenas pendientes |
| Método usado | SQL aditivo payments + `prisma migrate resolve --applied` |
| Tablas DNX Payments | 10/10 presentes |
| Smoke persistente | `PERSISTENCE_SMOKE_OK` (0 HTTP a MP; cleanup fixtures; audit retained) |
| Preflight MP | `MISSING_TEST_TOKEN` → Bloque A sigue `BLOCKED_BY_SANDBOX_CREDENTIALS` |
| Production | **No tocada** |

### Conteos staging (sanitizados)

| Métrica | Valor |
|---|---|
| Users | 3 |
| Orders legacy | 1 |
| PaymentSplit legacy | 0 |
| MercadoPagoOAuthState | 0 |
| DnxPaymentRecipient (post-cleanup) | 0 |
| DnxPaymentAuditEvent | ≥3 (evidencia smoke) |
| Migraciones aplicadas | 44 |
| Recuperación | Neon PITR / branch restore |

Migraciones FotoRank **siguen pendientes** en staging (no mezcladas en este apply):

- `20260715150000_fotorank_public_event_channel`
- `20260715160000_fotorank_experience_type`
- `20260715180000_fotorank_public_registration_summary`

## Smoke persistente (sin HTTP MP)

```bash
# Cargar DATABASE_URL/DIRECT_URL de staging (ep-round-fog) en el shell
pnpm --filter @repo/payments smoke:persistence-staging -- --confirm --cleanup
```

## Guía exacta — credenciales TEST Mercado Pago

### 1. Access Token TEST

1. Entrar a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers) con una **cuenta de prueba / aplicación de prueba**.
2. Abrir la aplicación → **Credenciales de prueba**.
3. Copiar **Access Token** que empiece por `TEST-`.
4. Guardar como `MERCADOPAGO_TEST_ACCESS_TOKEN` (local, gitignored).
5. **Rechazar** cualquier token `APP_USR-`.

### 2. Public Key TEST

1. En el mismo panel de credenciales de prueba.
2. Copiar Public Key `TEST-…` → `MERCADOPAGO_TEST_PUBLIC_KEY`.

### 3. Owner TEST (`user_id` numérico)

1. Usar el **vendedor de prueba** asociado a la aplicación TEST.
2. Obtener el `user_id` numérico del seller de prueba.
3. Guardar en `MERCADOPAGO_TEST_OWNER_USER_ID` (solo dígitos).

### 4. Partner TEST

1. Crear / usar un usuario de prueba del tipo `TESTUSER…@testuser.com`.
2. Guardar email exacto en `MERCADOPAGO_TEST_PARTNER_EMAIL`.
3. No usar emails reales.

### 5. Device ID TEST

1. Generar Device ID según documentación MP (SDK / fingerprint de prueba).
2. `MERCADOPAGO_TEST_DEVICE_ID`.
3. No loguear el valor completo en reportes.

### 6. Payment token TEST

1. En un HTML/local mínimo con **MercadoPago.js**.
2. Usar Public Key TEST + tarjeta de prueba oficial + payer TEST.
3. Obtener `token` en el browser.
4. Pegar temporalmente en `MERCADOPAGO_TEST_PAYMENT_TOKEN`.
5. **Nunca** enviar PAN/CVV al backend.
6. Si falta: `BLOCKED_BY_TEST_PAYMENT_TOKEN`.

### 7. Preflight

```bash
pnpm --filter @repo/payments smoke:mp-split-sandbox -- --dry-run
# cuando READY:
pnpm --filter @repo/payments smoke:mp-split-sandbox -- --confirm
```

### Checklist de seguridad

- [ ] Token `TEST-` (no `APP_USR-`)
- [ ] Partner `@testuser.com`
- [ ] Owner numérico de prueba
- [ ] Environment sandbox
- [ ] Sin `.env` en git
- [ ] Sin imprimir secretos
- [ ] Confirmación explícita antes de writes MP

## WAITING_MP_CONFIRMATION (sin resolver por inferencia)

- fee de procesamiento
- owner definitivo
- impuestos / retenciones
- settlements / payouts
- chargebacks post-retiro
