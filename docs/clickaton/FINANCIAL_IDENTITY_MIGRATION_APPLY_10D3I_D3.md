# CLICKATÓN — ETAPA 10D3I-D3 — APLICACIÓN DE MIGRACIONES FINANCIAL IDENTITY EN STAGING

**Fecha:** 2026-07-22  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD base:** `5fa8a67`  
**Veredicto:** **APLICADO EN STAGING CONFIRMADO — LEGACY_ONLY**

## Staging confirmado

| Campo | Valor |
|---|---|
| Neon project | `clickaton-staging` (`plain-sky-506722*`) |
| Branch | `clickaton-staging` (`br-lucky-dust-avvqom*`) |
| Host sanitizado | `ep-divine-smoke-av8hmt7s*` |
| Database | `clickaton_staging` |
| Región | `aws-us-east-1` (endpoint `c-11`) |

**No usados:** `ep-dawn-dew*`, `ep-falling-darkness*`, `ep-round-fog*`, database vacía `neondb` del mismo proyecto.

## Fingerprint pre-migrate (read-only)

- `_prisma_migrations`: 61
- Última: `20260718220000_clickaton_registrations_credentials_checkin_kits`
- Presente: `20260715170000_dnx_payments_core_persistence`
- Ausentes: 10D3I-C / 10D3I-D
- Tablas: `User`/`Lab`/`DnxPaymentIntent`/`ClickatonRegistration` sí; FI no
- Baseline: 1 user, 0 labs, 0 `User.mpAccessToken`, FI rows N/A

## Punto de restauración

| Campo | Valor |
|---|---|
| Neon branch | `pre-10d3i-financial-identity` |
| ID sanitizado | `br-floral-lab-avzdvsbz*` |
| Parent | `clickaton-staging` (`br-lucky-dust-avvqom7b*`) |
| Creado | `2026-07-23T01:01:05Z` |

## Migraciones aplicadas

`prisma migrate deploy` (no `db push`) con `DATABASE_URL`/`DIRECT_URL` forzados a `ep-divine-smoke-av8hmt7s*` / `clickaton_staging`.

| Migración | Resultado |
|---|---|
| `20260722030000_clickaton_contact_messages` | APLICADA (precursora pendiente en la cadena; solo aditiva) |
| `20260722220000_add_financial_identity_and_economic_agreements` | APLICADA |
| `20260722230000_add_encrypted_credentials_and_legacy_mp_fields` | APLICADA |

Duración deploy ≈ 10.3 s.  
Post: `Database schema is up to date!` (64/64).

## Validación post

- Tablas FI creadas (identity, account, credential, agreement, participants, versions, rules, snapshots, grants, recipient links).
- `ClickatonContactMessage` creada.
- Enums `Dnx*` FI presentes.
- Índices y FKs `Dnx*` presentes.
- Columnas D: `organizationRef`, `legacySource`, `tokenFingerprint`, `connectedAt`.
- Filas FI/account/credential/agreement/grant: **0** (sin backfill automático).
- `User.mp*` / `Lab.mp*` columnas intactas; conteos token sin cambio (0).
- Runtime: **LEGACY_ONLY** (sin cambios Vercel / flags).

## No ejecutado (explícito)

- Backfill real / dry-run remoto de tokens
- `PREFER_FINANCIAL_IDENTITY` / `FINANCIAL_IDENTITY_ONLY`
- OAuth / pagos / Orders 1:N
- Acuerdos, grants, porcentajes, socios
- Migración Rodrigo
- Push / producción

## Nota operativa

Prisma local `.env` apunta a `ep-dawn-dew*` — **no** usar ese `.env` para migrate. Siempre forzar env process a `ep-divine-smoke*` + DB `clickaton_staging`.

## Evidencia local (ignorada por Git)

`.local/audit-10d3i-d3/` (`summary.json`, status/deploy logs, validation).

## Próximo paso (no iniciado)

Retomar circuito controlado de 10D3I-D2 restante sobre esta DB:

1. Dry-run backfill sanitizado  
2. Apply TEST limit=1  
3. Smoke LEGACY → PREFER temporal → rollback LEGACY  

**No iniciar 10D3I-E** (socios/porcentajes) hasta ese circuito.
