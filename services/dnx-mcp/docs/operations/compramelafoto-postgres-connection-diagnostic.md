# ComprameLaFoto — Diagnóstico de conexión PostgreSQL staging

**Fecha:** 2026-07-07  
**Plataforma:** `compramelafoto`  
**Entorno:** staging (Neon)  
**Restricciones aplicadas:** sin migraciones, sin modificar DB, sin deploy, sin exponer URLs ni credenciales.

---

## Resumen ejecutivo

| Componente                        | Estado    | Nota                                                                |
| --------------------------------- | --------- | ------------------------------------------------------------------- |
| Prisma `validate`                 | OK        | Las tres variables DB están cargadas en el proceso MCP              |
| Prisma `migrate status`           | Bloqueado | 6 migraciones pendientes; `_prisma_migrations` no existe en staging |
| Cliente `pg` (sin opciones extra) | OK        | `SELECT 1`, `current_database`, `current_user` responden            |
| Postgres Provider DNX-MCP         | **Falla** | Error `08P01` en ping                                               |

**Causa raíz del fallo del Postgres Provider:** `POSTGRES_READONLY_DATABASE_URL` apunta al **pooler de Neon**, pero el cliente del provider envía el parámetro de arranque `default_transaction_read_only=on`. Neon **rechaza ese parámetro en conexiones pooled** → violación de protocolo (`08P01`). Prisma no usa ese parámetro, por eso valida correctamente.

---

## 1. Variables de entorno cargadas (solo booleanos)

| Variable                         | Cargada |
| -------------------------------- | ------- |
| `DATABASE_URL`                   | `true`  |
| `DIRECT_URL`                     | `true`  |
| `POSTGRES_READONLY_DATABASE_URL` | `true`  |

---

## 2. Clasificación de URLs (sin valores)

| Variable                      | Tipo                                   | Valor   |
| ----------------------------- | -------------------------------------- | ------- |
| `DATABASE_URL_is_pooled`      | pooled (host pooler Neon)              | `true`  |
| `DIRECT_URL_is_direct`        | conexión directa (sin pooler)          | `true`  |
| `POSTGRES_READONLY_is_direct` | pooled (host pooler Neon)              | `false` |
| `has_sslmode_require`         | `sslmode=require` presente en las URLs | `true`  |

---

## 3. Test de conexión read-only con `pg` (cliente plano)

Se ejecutó un `pg.Pool` **sin** `options: "-c default_transaction_read_only=on"` contra `POSTGRES_READONLY_DATABASE_URL`.

| Query                         | Resultado      |
| ----------------------------- | -------------- |
| `SELECT 1`                    | `1` (OK)       |
| `SELECT current_database()`   | `neondb`       |
| `SELECT current_user`         | `neondb_owner` |
| `EXISTS (_prisma_migrations)` | `false`        |

**Interpretación:** la base staging es alcanzable y responde. No tiene tabla `_prisma_migrations` — esquema Prisma aún no aplicado en este entorno.

---

## 4. Fallo del Postgres Provider (DNX-MCP)

### Síntoma en `release_prepare`

```text
postgres.connected: false
postgres.blockers: ["No se pudo conectar o evaluar PostgreSQL"]
```

### Error observado

| Campo             | Valor                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| Tipo              | `PostgresQueryError`                                                           |
| Código PostgreSQL | `08P01` (protocol violation)                                                   |
| Operación         | `ping` (`SELECT 1`)                                                            |
| Categoría         | **Protocolo / incompatibilidad pooler** (no auth, no SSL, no host, no timeout) |

### Mensaje subyacente (redactado)

Neon indica: _unsupported startup parameter in options: default_transaction_read_only_ — usar conexión **unpooled** o quitar el parámetro del startup package.

### Reproducción controlada

| Escenario                                                                   | Resultado         |
| --------------------------------------------------------------------------- | ----------------- |
| `pg.Pool` + URL readonly pooled, **sin** `options`                          | OK                |
| `pg.Pool` + URL readonly pooled, **con** `default_transaction_read_only=on` | **Falla `08P01`** |
| `pg.Pool` + `DIRECT_URL`, **con** `default_transaction_read_only=on`        | OK                |

### Código implicado

El cliente del provider fija el parámetro de arranque en todas las conexiones:

```46:53:src/providers/postgres/client/postgres-client.ts
      this.pool = new pg.Pool({
        connectionString: this.config.databaseUrl,
        max: 2,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: this.config.queryTimeoutMs,
        application_name: "dnx-mcp-readonly",
        options: "-c default_transaction_read_only=on",
      });
```

La URL resuelta viene de `POSTGRES_READONLY_DATABASE_URL` (`src/providers/postgres/config.ts`), que hoy es **pooled**.

---

## 5. Por qué Prisma valida pero el Postgres Provider no

| Aspecto                                   | Prisma                                   | Postgres Provider                   |
| ----------------------------------------- | ---------------------------------------- | ----------------------------------- |
| Herramienta                               | CLI `prisma validate` / `migrate status` | `pg` + pool propio                  |
| URLs usadas                               | `DATABASE_URL` + `DIRECT_URL`            | `POSTGRES_READONLY_DATABASE_URL`    |
| Parámetro `default_transaction_read_only` | No lo envía                              | Sí, en startup (`options`)          |
| Compatibilidad con pooler Neon            | OK (URLs pooled + direct según schema)   | **Falla** si readonly URL es pooled |

Prisma solo necesita que el schema y las URLs existan para `validate`. El assess del provider intenta **conectar y ejecutar queries** con una configuración incompatible con el pooler.

---

## 6. Estado Prisma (complementario, no es fallo de red)

`prisma migrate status` reporta **6 migraciones pendientes**:

- `20260422085720_init_baseline`
- `20260422185334_service_leads_subtypes_meta`
- `20260424022429_add_service_lead_forms`
- `20260424033104_add_service_lead_form_mode`
- `20260424162000_add_presential_courses_mvp`
- `20260428192455_add_evaluaciones_engine`

Esto es **esperado** mientras staging no tenga el esquema aplicado (`_prisma_migrations` ausente). No se ejecutaron migraciones en este diagnóstico.

---

## 7. Recomendaciones concretas

### A. Desbloquear Postgres Provider (elegir una)

1. **Recomendado — URL directa para readonly:** en `.env.local`, asignar a `POSTGRES_READONLY_DATABASE_URL` la misma URL **directa** que `DIRECT_URL` (host sin `pooler`). El parámetro `default_transaction_read_only=on` funciona en conexiones unpooled de Neon.

2. **Alternativa — quitar startup option con pooler:** modificar `postgres-client.ts` para no enviar `options` cuando el host es pooler Neon, y aplicar read-only con `SET default_transaction_read_only = on` tras conectar (solo si Neon lo permite en pooled).

3. **Alternativa — omitir assess:** dejar `POSTGRES_READONLY_DATABASE_URL` vacía; `release_prepare` omitirá el assess Postgres (`postgres: null`). No resuelve visibilidad operativa.

### B. Esquema staging (fuera de alcance de este diagnóstico)

Cuando corresponda aplicar schema en Neon staging (fuera de DNX-MCP / sin migraciones desde aquí):

- Ejecutar `prisma migrate deploy` desde el monorepo contra staging, o
- Aplicar migraciones vía pipeline de deploy preview.

Hasta entonces, `prisma migrate status` seguirá listando migraciones pendientes y `brainScore` permanecerá en 0.

### C. Verificación post-cambio

Tras ajustar `POSTGRES_READONLY_DATABASE_URL` a URL directa:

```bash
# En dnx-mcp, sin imprimir secretos
pnpm check && pnpm build
# Luego release_prepare dry-run para compramelafoto
```

Esperado: `postgres.connected: true`, ping OK, `migrationTable.exists: false` (hasta aplicar migraciones).

---

## 8. Lo que NO se hizo (por diseño)

- No se imprimieron `DATABASE_URL`, `DIRECT_URL` ni `POSTGRES_READONLY_DATABASE_URL`.
- No se ejecutaron migraciones Prisma.
- No se modificó la base de datos.
- No se desplegó a Vercel.

---

## Referencias

- [`compramelafoto-staging-database-setup.md`](./compramelafoto-staging-database-setup.md) — qué variable va dónde
- [`compramelafoto-release-prepare-monorepo.md`](./compramelafoto-release-prepare-monorepo.md) — flujo `release_prepare`
- [Neon — unsupported startup parameter](https://neon.tech/docs/connect/connection-errors#unsupported-startup-parameter)
- Código: `src/providers/postgres/client/postgres-client.ts`, `src/providers/postgres/config.ts`
