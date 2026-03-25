# Solución: Error P3006 en Prisma Migrate

## Error

```
Error: P3006
Migration `20260121101158_add_retired_status` failed to apply cleanly to the shadow database.
Error: ERROR: type "PrintOrderStatus" does not exist
```

## Causa

La shadow database de Prisma no tiene el enum `PrintOrderStatus` creado. Esto puede pasar cuando:
- La migración ya fue aplicada en producción pero la shadow database está desincronizada
- La shadow database necesita ser recreada

## Soluciones

### Solución 1: Marcar la migración como aplicada (si ya está en producción)

Si la migración `20260121101158_add_retired_status` ya fue aplicada en tu base de datos de producción:

```bash
npx prisma migrate resolve --applied 20260121101158_add_retired_status
```

Luego intenta crear la nueva migración:

```bash
npx prisma migrate dev --name add_lab_customization
```

### Solución 2: Resetear la shadow database

Si la migración NO está aplicada en producción, resetea la shadow database:

```bash
# Opción A: Resetear solo shadow database (recomendado)
npx prisma migrate reset --skip-seed

# Opción B: Si eso no funciona, usar --skip-generate
npx prisma migrate dev --skip-generate --name add_lab_customization
```

### Solución 3: Aplicar migraciones manualmente y luego crear la nueva

Si ninguna de las anteriores funciona:

```bash
# 1. Verificar estado de migraciones
npx prisma migrate status

# 2. Si la migración está pendiente, aplicarla manualmente
npx prisma migrate deploy

# 3. Luego crear la nueva migración
npx prisma migrate dev --name add_lab_customization
```

### Solución 4: Usar --create-only (crear sin aplicar)

Si solo quieres crear el archivo de migración sin aplicarlo:

```bash
npx prisma migrate dev --create-only --name add_lab_customization
```

Luego aplicar manualmente:

```bash
npx prisma migrate deploy
```

## Verificación

Después de aplicar la solución:

```bash
# Verificar estado
npx prisma migrate status

# Generar cliente Prisma
npx prisma generate
```

## Nota sobre Shadow Database

La shadow database es una base de datos temporal que Prisma crea para validar migraciones. Si está desincronizada, puede causar este error. Las soluciones arriba deberían resolverlo.
