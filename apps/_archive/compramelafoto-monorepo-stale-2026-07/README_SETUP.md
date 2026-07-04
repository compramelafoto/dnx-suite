# Setup y Comandos - ComprameLaFoto

> **Disciplina DB DNX Suite:** `packages/db` es la fuente de verdad.  
> En **staging/prod** usar solo `pnpm --filter @repo/db run db:migrate:deploy`.  
> `db push` es únicamente para local/dev controlado.

## 🚀 Comandos Importantes

### Base de Datos

```bash
# Aplicar cambios del schema (solo local/dev)
pnpm --filter @repo/db run db:migrate

# Sincronizar schema directamente (solo local/dev controlado, NO staging/prod)
pnpm --filter @repo/db run db:push

# Regenerar Prisma Client después de cambios en schema
pnpm --filter @repo/db run db:generate

# Abrir Prisma Studio (visor visual de la base de datos)
pnpm --filter @repo/db run db:studio
```

### Seed (Datos Iniciales)

```bash
# Crear usuario ADMIN desde .env.local
npm run seed
```

**Importante**: Antes de ejecutar el seed, asegurate de tener en `.env.local`:

```env
ADMIN_EMAIL=cuart.daniel@gmail.com
ADMIN_PASSWORD=Daniel1608$
DATABASE_URL=tu_connection_string_aqui
```

### Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# Build de producción
npm run build

# Iniciar servidor de producción
npm start
```

## 📝 Orden Recomendado de Ejecución

1. **Primera vez / Después de cambios en schema (local/dev)**:
   ```bash
   pnpm --filter @repo/db run db:migrate
   pnpm --filter @repo/db run db:generate
   npm run seed
   ```

2. **Para ver datos**:
   ```bash
   pnpm --filter @repo/db run db:studio
   ```

3. **Durante desarrollo**:
   ```bash
   npm run dev
   ```

## 🔐 Roles del Sistema

- **ADMIN**: Panel de administración completo
- **PHOTOGRAPHER**: Fotógrafos que venden fotos
- **LAB**: Laboratorios que imprimen (requieren aprobación admin)
- **CUSTOMER**: Clientes finales (compran/imprimen)

## 🗑️ Eliminación automática de álbumes (30 días)

Los álbumes se eliminan automáticamente a los 30 días. Para que el cron funcione en producción:

1. Definí `CRON_SECRET` en las variables de entorno (ej. en Vercel).
2. Configurá un cron diario que llame a `GET /api/cron/cleanup-expired-albums` con header:
   `Authorization: Bearer <tu CRON_SECRET>`.
3. En `vercel.json` hay un ejemplo de horario (4:00 UTC). Si usás un cron externo (cron-job.org, EasyCron, etc.), programalo 1 vez por día.

En desarrollo, si `CRON_SECRET` no está definido, la ruta acepta requests sin auth.

## ⚠️ Notas de Seguridad

- El usuario ADMIN se crea automáticamente con `npm run seed`
- La contraseña del admin NO debe estar en el código
- Usa variables de entorno (`.env.local`) para datos sensibles
- En producción, cambia `AUTH_SECRET` por un valor seguro
