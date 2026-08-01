# FotoRank — Runbook storage privado R2

## Variables

| Variable | Uso |
|----------|-----|
| `FOTORANK_PRIVATE_STORAGE_PROVIDER` | `local` \| `r2` (opcional; auto si hay creds) |
| `FOTORANK_R2_ACCOUNT_ID` | Account Cloudflare |
| `FOTORANK_R2_ACCESS_KEY_ID` | Access key R2 |
| `FOTORANK_R2_SECRET_ACCESS_KEY` | Secret (nunca loguear) |
| `FOTORANK_R2_BUCKET` | Bucket **privado** |
| `FOTORANK_R2_ENDPOINT` | `https://<account>.r2.cloudflarestorage.com` |
| `FOTORANK_R2_REGION` | `auto` |
| `FOTORANK_R2_KEY_PREFIX` | Prefijo lógico (`fotorank`) |
| `FOTORANK_R2_SIGNED_URL_TTL_SECONDS` | TTL máximo firmadas |
| `FOTORANK_STORAGE_SIGNING_SECRET` | HMAC del proxy `/api/fotorank/private-asset` |

Aliases aceptados: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`.

## Bucket

1. Crear bucket R2 **sin** Public Development URL.
2. Sin dominio público para originales.
3. CORS: solo orígenes de la app (staging/prod), métodos `GET`/`PUT`/`HEAD` si upload directo.
4. Content-Types controlados en servidor (`image/jpeg`, derivados `image/jpeg`).

## Keys

Generadas en servidor:

`fotorank/contests/{contestId}/entries/{entryId}/versions/{n}/{kind}/{assetId}`

Sin email, DNI, Instagram ni filename original.

## Staging (P0-08)

- Bucket sugerido: `fotorank-private-staging` (nunca `fotorank-uploads`).
- Catalog MCP: `stagingBucket` en plataforma `fotorank`.
- Smoke real (fixture texto, put/head/signed/delete):

```bash
export FOTORANK_PRIVATE_STORAGE_PROVIDER=r2
# FOTORANK_R2_* apuntando SOLO a staging
pnpm --filter fotorank run test:storage:r2-staging
```

Sin credenciales → `SKIP` (no declarar PASS). Lifecycle de fixtures: borrar en el smoke; cron futuro vía `test:release:orphan-assets`.

## Prueba local

```bash
pnpm --filter fotorank run test:storage:r2-config
```

Sin credenciales → `providerResolved: local` (esperado).

Con credenciales de **staging** (nunca prod en laptop):

```bash
export FOTORANK_PRIVATE_STORAGE_PROVIDER=r2
# + vars R2 staging
pnpm --filter fotorank run test:storage:r2-config
```

## Lectura

Por defecto el provider R2 firma URLs del **proxy** `/api/fotorank/private-asset` (auth por rol).  
`FOTORANK_R2_DIRECT_SIGNED_READ=1` habilita GET firmado directo a R2 (solo ops avanzadas).

## Verificación “no público”

1. Obtener `storageKey` de un ORIGINAL en DB local/staging.
2. Intentar `https://pub-....r2.dev/<key>` → debe fallar.
3. Como jurado, abrir preview → solo `JURY_PREVIEW`.
4. Como jurado, pedir ORIGINAL → 403.

## Rotación de credenciales

1. Crear nuevo access key en Cloudflare.
2. Actualizar secretos en Vercel/hosting (staging → validar → prod).
3. Revocar key anterior.
4. No commitear `.env`.

## Rollback

`FOTORANK_PRIVATE_STORAGE_PROVIDER=local` solo para emergencias de desarrollo.  
En staging/prod: mantener R2; rollback = redeploy con key anterior o bucket snapshot.

## Local vs staging vs prod

| Env | Provider | Bucket |
|-----|----------|--------|
| local | local `.data/` | n/a |
| staging | R2 staging privado | `fotorank-*-staging` |
| prod | R2 prod privado | `fotorank-*-prod` |
