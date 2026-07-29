# Clickatón Staging — Cutover a DB de identidad compartida

**ADR:** ADR-DNX-002 (Estrategia A)  
**Estado 10B.6:** `CLICKATON DATA MIGRATION BLOCKED`  
**Informe:** `STAGING_SHARED_IDENTITY_CUTOVER_REPORT.md`

---

## Destino oficial Staging

`ep-round-fog-a4xgibtv…` / `neondb` (CLF Preview / DNX Payments staging).

## Origen

`ep-divine-smoke-av8hmt7s…` / `clickaton_staging` (6 ediciones — health vivo).

## Bloqueos actuales

1. `DATABASE_URL` Clickatón Staging **Encrypted** → `vercel env pull` vacío.  
2. FotoRank Preview en `ep-empty-moon…` ≠ destino.  
3. Backups Neon no creados (sin API/URL origen).

## Preflight

1. Backup Neon origen `backup-before-identity-cutover`.  
2. Backup Neon destino `backup-before-clickaton-import`.  
3. URL origen pullable.  
4. FotoRank Preview → misma DEST.  
5. `pnpm clickaton:staging:identity-cutover` dry-run.  
6. `prisma migrate deploy` en DEST.

## Cutover

1. Congelar writes identidad Clickatón Staging.  
2. Dry-run mapa usuarios.  
3. Execute fase 1 (mapa + altas).  
4. Import dominio (6 ediciones) order-safe.  
5. Integrity check.  
6. Apuntar Clickatón Staging `DATABASE_URL` → DEST.  
7. Redeploy Staging.  
8. Smoke + fixtures 1–6.

## Rollback

Restaurar env divine-smoke + redeploy anterior. No borrar users DEST. Origen intacto.
