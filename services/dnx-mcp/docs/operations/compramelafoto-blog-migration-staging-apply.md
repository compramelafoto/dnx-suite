# ComprameLaFoto — Aplicación migración Blog/Marketing en staging

**Fecha:** 2026-07-09  
**Base de datos:** Neon staging (`ep-round-fog-a4xgibtv`) — **no producción**  
**Migración objetivo:** `20260706190000_add_clf_blog_marketing_gap`  
**Sin Vercel deploy manual · sin DNS · sin producción**

---

## Resumen ejecutivo

| Paso                                         | Resultado                             |
| -------------------------------------------- | ------------------------------------- |
| `prisma migrate deploy` — blog/marketing gap | **OK** (aplicada)                     |
| `prisma migrate deploy` — global             | **Error** (migración siguiente falló) |
| Tablas blog/marketing                        | **Existen**                           |
| Preview `dpl_CGQfoZaiW7PU2Cu9ukpLh2wVqKEz`   | **READY** / healthy                   |
| `release_validate` (`dryRun: false`)         | **GO** — Brain score **100**          |

---

## 1. Ejecución `migrate deploy`

**Comando:**

```bash
cd "/Volumes/HD DNX 10/PROGRAMACIONES/dnx-suite"
# DATABASE_URL y DIRECT_URL cargados desde DNX-MCP .env.local (staging Neon)
pnpm --filter @repo/db exec prisma migrate deploy
```

### Migración blog/marketing — OK

| Campo              | Valor                                       |
| ------------------ | ------------------------------------------- |
| **Nombre**         | `20260706190000_add_clf_blog_marketing_gap` |
| **Estado**         | Aplicada                                    |
| **finished_at**    | `2026-07-09T04:56:25.676Z`                  |
| **rolled_back_at** | `null`                                      |

### Migración siguiente — Error (no solicitada en este paso)

| Campo       | Valor                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| **Nombre**  | `20260708150000_organizer_direct_mp_commission_ledger`                                                       |
| **Estado**  | **Falló**                                                                                                    |
| **Error**   | `type "EventOrganizerCommissionStatus" does not exist` (SQL 42704)                                           |
| **Impacto** | `_prisma_migrations` queda con registro fallido; futuros `migrate deploy` bloqueados hasta `migrate resolve` |

> La migración blog **no se revirtió**. Las tablas creadas permanecen en staging.

---

## 2. Verificación post-migrate

### `_prisma_migrations`

| #   | migration_name                                       | finished_at       |
| --- | ---------------------------------------------------- | ----------------- |
| 1–6 | baseline … evaluaciones_engine                       | 2026-07-07        |
| 7   | **20260706190000_add_clf_blog_marketing_gap**        | **2026-07-09** ✅ |
| 8   | 20260708150000_organizer_direct_mp_commission_ledger | `null` ❌         |

### Tablas verificadas (`to_regclass` / `pg_tables`)

| Tabla           | Existe |
| --------------- | ------ |
| `BlogPost`      | ✅     |
| `BlogCategory`  | ✅     |
| `BlogTag`       | ✅     |
| `BlogAuthor`    | ✅     |
| `BlogMedia`     | ✅     |
| `Talk`          | ✅     |
| `TalkLead`      | ✅     |
| `DnxCourseLead` | ✅     |

Enum `BlogPostStatus` presente. Tablas adicionales del gap (`BlogPostView`, `BlogPostTag`, `BlogSubscriber`, `FotoOfficeInterest`, `CharlaFotoEscolarLead`, `DnxCourseEnrollment`, `SimulatorCapture`) también creadas por la misma migración.

---

## 3. Preview Vercel (sin deploy manual)

| Campo             | Valor                                                                           |
| ----------------- | ------------------------------------------------------------------------------- |
| **Deployment ID** | `dpl_CGQfoZaiW7PU2Cu9ukpLh2wVqKEz`                                              |
| **readyState**    | **READY**                                                                       |
| **health**        | **healthy**                                                                     |
| **Commit**        | `9850748` — `feat(db): add clf blog marketing gap migration`                    |
| **URL**           | `https://compramelafoto-dnxsuite-5p6i55xkl-compramelafotos-projects.vercel.app` |

Deploy disparado automáticamente por git push (no intervención manual en Vercel).

---

## 4. `release_validate` (`dryRun: false`)

**Preview auditado:** `dpl_CGQfoZaiW7PU2Cu9ukpLh2wVqKEz`

| Campo                 | Valor                                    |
| --------------------- | ---------------------------------------- |
| **decision**          | **GO**                                   |
| **canExecute**        | `true`                                   |
| **Brain score**       | **100**                                  |
| **brain.verdict**     | `approve`                                |
| **brain.shouldBlock** | `false`                                  |
| **validation.passed** | `true`                                   |
| **Blockers**          | ninguno (Git, Prisma, PostgreSQL, Brain) |
| **Warnings**          | ninguno bloqueante                       |

---

## 5. Efecto esperado en runtime

| Ruta / feature      | Antes                                      | Después                                                |
| ------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `/blog`             | 500 — `relation "BlogPost" does not exist` | Debe responder **200** (listado vacío si no hay posts) |
| Home sin álbumes    | DB vacía (`Album`: 0)                      | Sin cambio — requiere seed/import                      |
| Login usuarios prod | Falla — `User`: 0 en staging               | Sin cambio — requiere seed                             |

---

## 6. Pendientes (fuera de alcance)

1. **Resolver** migración fallida `20260708150000_organizer_direct_mp_commission_ledger` (`prisma migrate resolve` + fix SQL o gap migration para `EventOrganizerCommissionStatus`).
2. **Seed** de posts blog y/o datos de prueba en staging.
3. **Completar env preview** (R2, MP, Resend) — ver [`compramelafoto-preview-runtime-diagnostic.md`](./compramelafoto-preview-runtime-diagnostic.md).
4. **No** `release_execute` hasta plan de release acordado.

---

## Confirmaciones de alcance

| Restricción          | Cumplida |
| -------------------- | -------- |
| Solo DB staging Neon | ✅       |
| No producción        | ✅       |
| No Vercel manual     | ✅       |
| No DNS               | ✅       |
| No deploy manual     | ✅       |

---

## Referencias

- [`compramelafoto-blog-marketing-migration-plan.md`](./compramelafoto-blog-marketing-migration-plan.md)
- [`compramelafoto-preview-runtime-diagnostic.md`](./compramelafoto-preview-runtime-diagnostic.md)
- [`compramelafoto-real-preview-validation.md`](./compramelafoto-real-preview-validation.md)
