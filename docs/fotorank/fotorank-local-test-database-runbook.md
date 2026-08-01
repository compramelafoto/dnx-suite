# FotoRank — Runbook de base de datos local (P0)

**Propósito:** probar migraciones y flujos de inscripción/carga **sin tocar Neon** ni ninguna DB remota con drift.

---

## 1. Regla de oro

Antes de cualquier `prisma migrate` / `db push` / seed:

```bash
echo "$DATABASE_URL"
echo "$DIRECT_URL"
```

Debe ser **localhost** (o `127.0.0.1`).  
Si aparece `neon.tech`, `amazonaws.com`, `supabase.co` u otro host remoto → **ABORT**.

El archivo `packages/db/.env` suele apuntar a Neon: **no lo uses** para P0-06. Pasá las variables en el comando.

---

## 2. PostgreSQL local (Homebrew)

```bash
# Estado
brew services list | rg postgres
psql -d postgres -c "SELECT version();"

# Crear DB aislada
createdb fotorank_p0_06_test

# Verificar
psql -d fotorank_p0_06_test -c "SELECT current_database();"
```

Docker es opcional; en este entorno no estaba disponible. Homebrew es suficiente.

---

## 3. Variables recomendadas

```bash
export DATABASE_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_test'
export DIRECT_URL="$DATABASE_URL"
# Opcional shadow local
export SHADOW_DATABASE_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_shadow'
```

Ajustá el usuario/socket a tu instalación (`whoami`).

---

## 4. Aplicar schema (DB limpia)

### Opción A — `db push` (rápida para test aislado)

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite

DATABASE_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_test' \
DIRECT_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_test' \
  pnpm --filter @repo/db exec prisma db push
```

### Opción B — migraciones ordenadas (desde cero)

Solo si la DB está vacía o es un shadow dedicado:

```bash
DATABASE_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_test' \
DIRECT_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_test' \
  pnpm --filter @repo/db exec prisma migrate deploy
```

Migraciones relevantes P0:

- `20260728120000_fotorank_p0_01_registration_rules_fee_assets`
- `20260728140000_fotorank_p0_06_entry_upload_exif_checklist`

**No** correr `migrate deploy` contra Neon con drift.

---

## 5. Generar cliente Prisma

```bash
pnpm --filter @repo/db exec prisma generate
```

---

## 6. Seed

Santa Fe en Foco requiere al menos un `User` (admin). En DB vacía, creá uno o corré el seed principal de FotoRank si existe en el entorno.

```bash
DATABASE_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_test' \
DIRECT_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_test' \
  pnpm --filter @repo/db exec tsx prisma/scripts/seed-santa-fe-en-foco.ts
```

El seed está bloqueado si `NODE_ENV=production` o `VERCEL_ENV=production`.

---

## 7. Tests

```bash
# Unit dominio obras (sin DB)
pnpm --filter fotorank run test:entries:selfcheck

# Integración (exige localhost)
DATABASE_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_test' \
DIRECT_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_test' \
  pnpm --filter fotorank run test:entries:integration

# Inscripción FREE
DATABASE_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_test' \
DIRECT_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_test' \
  pnpm --filter fotorank run test:registration:integration
```

E2E (servidor Next + seed + usuarios `participante1@fotorank.com`):

```bash
pnpm --filter fotorank run test:e2e:only -- e2e/public-entry-upload.spec.ts
```

Storage privado local: `apps/fotorank/.data/` (gitignore).

---

## 8. Destruir y recrear

```bash
dropdb fotorank_p0_06_test
createdb fotorank_p0_06_test
# repetir db push / migrate + seed
```

---

## 9. Cómo verificar qué DB está activa

```bash
# En shell
node -e "console.log(process.env.DATABASE_URL)"

# En Prisma (conexión real)
DATABASE_URL='postgresql://danielcuart@localhost:5432/fotorank_p0_06_test' \
  pnpm --filter @repo/db exec tsx -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.\$queryRaw\`SELECT current_database() AS db, inet_server_addr() AS addr\`
      .then(r => { console.log(r); return p.\$disconnect(); });
  "
```

Checklist anti-Neon:

1. Host = localhost / 127.0.0.1  
2. Nombre DB = `fotorank_p0_06_test` (o shadow)  
3. No exportar `.env` de `packages/db` sin override  
4. El selfcheck de integración **aborta** si detecta host remoto  

---

## 10. Rollback lógico

- **Assets:** no se borran en reemplazo; quedan `isActive=false` + `replacedAt`.  
- **Obra retirada:** `WITHDRAWN` + `withdrawnAt` (sin delete físico).  
- **Migración:** en test, `dropdb` + recrear es el rollback preferido. No aplicar `migrate resolve` sobre Neon.
