# Santa Fe en Foco — RC01 Registration Opening Runbook

**Branch:** `release/fotorank-santa-fe-registration-2026`  
**Date pack:** 2026-08-04  
**Legal path:** CAMINO B · `PROVISIONALLY_AUTHORIZED_PENDING_LEGAL_REVIEW`

## Scope of this RC

| Capability | State |
| --- | --- |
| Public landing | ON |
| Free registration | Ready (seed leaves `registrationEnabled=false` until GO) |
| Photo upload | OFF |
| Jury / results / admission (participant) | OFF |
| Production alias deploy | Do **not** cut over until GO |

## PENDING_OPERATOR_INPUT

Before final GO, complete in `docs/fotorank/legal/santa-fe-en-foco-camino-b-authorization-2026-08-04.md`:

- `authorizedByName`
- `authorizedByRole`

Do **not** invent names or titles.

## Domains

- Public canonical: **https://fotorank.com** (see `docs/fotorank/canonical-domain-fotorank-com.md`)
- `www.fotorank.com` → `fotorank.com`
- Staging hosts stay on their own Vercel hostnames

## OAuth

Google callback must be registered as:

`https://fotorank.com/api/auth/google/callback`

## Email (Resend)

Required env for real send:

- `RESEND_API_KEY`
- `RESEND_FROM` or `FOTORANK_EMAIL_FROM`
- Optional: `FOTORANK_EMAIL_REPLY_TO` (defaults reply-to `sfprosario@gmail.com` for this contest)

Without API key, registration still succeeds; email stays **QUEUED**. UI must not claim the email was sent.

## Production seed (do not confuse with migrate)

```bash
FOTORANK_PRODUCTION_SEED_CONFIRM=SANTA_FE_EN_FOCO_PRODUCTION_2026 \
FOTORANK_CONTEST_SLUG_CONFIRM=santa-fe-en-foco \
ALLOW_PRODUCTION_SEED=1 \
pnpm --filter @repo/db db:seed:santa-fe-en-foco:production
```

Hard gates: confirm phrase, slug confirm, denylist staging hosts, intentional prod env.  
`registrationEnabled` remains **false** after seed.

**Do not** run `prisma migrate deploy` against production from this RC agent flow unless explicitly approved outside this runbook.

## GO / NO-GO gates

### GO only if all pass

1. Migrations additive applied in target DB (`answersJson`, `guardianEmail`).
2. Production seed succeeded; contest slug `santa-fe-en-foco` published; upload window closed (`submissionOpensAt` ≥ 2099 or null-fail-closed).
3. Legal texts provisional CAMINO B published; gate does not flag `NO PUBLICAR` / `BORRADOR` / `STAGING_TEST` / `[PENDING_*]`.
4. `PENDING_OPERATOR_INPUT` filled for operator name/role **or** consciously accepted as remaining blocker with signed waiver by product owner.
5. DNS + Vercel domain `fotorank.com` attached; OAuth callback matches.
6. Resend from-domain verified **or** accepted risk that emails stay queued.
7. Smoke: create account → login → register FREE → number issued → upload API returns closed message.
8. Rate limit returns 429 under burst on registration/auth.
9. Manual flip `registrationEnabled=true` only after GO checklist signed.

### NO-GO if any

- Staging DATABASE_URL used for prod seed
- Legal markers of draft/no-publish in published rules
- Upload window open unintentionally
- OAuth redirect mismatch
- Operator authorization fields silently fabricated

## Rollback levels

1. **Soft:** set `registrationEnabled=false` (stop new registrations).
2. **Landing:** unpublish / set contest visibility private.
3. **DNS:** point traffic away from production deployment (keep data).
4. **Data:** do not drop additive columns; reverse only by stopping intake and support messaging.

## Local verify

```bash
# unit selfcheck
pnpm --filter fotorank test:santa-fe-registration-selfcheck

# local staging-style seed (blocked in production env)
pnpm --filter @repo/db db:seed:santa-fe-en-foco
pnpm --filter @repo/db db:seed:santa-fe-rules-config

# app
pnpm --filter fotorank dev
# open /concursos/santa-fe-en-foco
```
