# ComprameLaFoto — Plan migración Blog/Marketing gap (staging)

**Fecha:** 2026-07-09  
**Migración:** `20260706190000_add_clf_blog_marketing_gap`  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Sin producción · sin deploy · sin `migrate deploy` (todavía)**

---

## Problema

El `schema.prisma` del monorepo incluye modelos de blog/marketing/leads importados del legacy CLF, pero **ninguna migración existente** crea esas tablas. En staging Neon:

- `/blog` → `relation "BlogPost" does not exist`
- Prisma client y app compilan; falla en runtime al consultar tablas ausentes

**Migraciones previas aplicadas en staging (6):** `20260422085720` … `20260428192455_add_evaluaciones_engine`  
**Migración local pendiente de deploy (otra):** `20260708150000_organizer_direct_mp_commission_ledger` (solo enum ALTER, independiente)

---

## 1. Modelos verificados en `schema.prisma`

| Modelo                  | En schema | En migraciones previas | En gap migration |
| ----------------------- | --------- | ---------------------- | ---------------- |
| `BlogPost`              | ✅        | ❌                     | ✅               |
| `BlogCategory`          | ✅        | ❌                     | ✅               |
| `BlogTag`               | ✅        | ❌                     | ✅               |
| `BlogAuthor`            | ✅        | ❌                     | ✅               |
| `BlogMedia`             | ✅        | ❌                     | ✅               |
| `BlogPostView`          | ✅        | ❌                     | ✅               |
| `BlogPostTag`           | ✅        | ❌                     | ✅               |
| `BlogSubscriber`        | ✅        | ❌                     | ✅               |
| `FotoOfficeInterest`    | ✅        | ❌                     | ✅               |
| `Talk`                  | ✅        | ❌                     | ✅               |
| `TalkLead`              | ✅        | ❌                     | ✅               |
| `CharlaFotoEscolarLead` | ✅        | ❌                     | ✅               |
| `DnxCourseEnrollment`   | ✅        | ❌                     | ✅               |
| `DnxCourseLead`         | ✅        | ❌                     | ✅               |
| `SimulatorCapture`      | ✅        | ❌                     | ✅               |

### Enums creados en la migración

| Enum                        | Valores                               |
| --------------------------- | ------------------------------------- |
| `BlogPostStatus`            | DRAFT, PUBLISHED, ARCHIVED            |
| `BlogPostType`              | BLOG, FEATURE, CASE_STUDY, COMPARISON |
| `TalkStatus`                | DRAFT, PUBLISHED, CLOSED, ARCHIVED    |
| `TalkModality`              | MEET, ONLINE, PRESENCIAL, OTHER       |
| `DnxCourseEnrollmentStatus` | PENDING_PAYMENT, APPROVED, CANCELLED  |

### Relacionados en schema pero ya en baseline (no incluidos en gap)

| Modelo          | Notas                                    |
| --------------- | ---------------------------------------- |
| `EmailCampaign` | Creado en `20260422085720_init_baseline` |
| `EmailSend`     | Creado en `20260422085720_init_baseline` |

---

## 2. Generación de SQL

**Método:** `prisma migrate diff --from-url <staging_neon> --to-schema-datamodel prisma/schema.prisma --script`, filtrado a tablas/enums del gap.

**Archivo:** `packages/db/prisma/migrations/20260706190000_add_clf_blog_marketing_gap/migration.sql`

**Contenido:**

- 5 enums
- 15 tablas
- Índices y unique constraints
- 9 foreign keys (hacia `User`, relaciones internas blog/talk)

**Orden en carpeta migrations:** antes de `20260708150000_organizer_direct_mp_commission_ledger`.

---

## 3. Validaciones locales (pre-deploy)

| Comando                                  | Resultado |
| ---------------------------------------- | --------- |
| `pnpm exec prisma validate` (`@repo/db`) | ✅ OK     |
| `pnpm --filter compramelafoto typecheck` | ✅ OK     |
| `pnpm --filter compramelafoto build`     | ✅ OK     |

**No se ejecutó** `prisma migrate deploy`.

---

## 4. Aplicación planificada en staging (cuando se autorice)

```bash
cd packages/db
pnpm db:migrate:deploy
```

**Precondiciones:**

- Backup o snapshot Neon staging
- Ventana de mantenimiento preview (no producción)
- Verificar que `_prisma_migrations` no tenga ya esta migración

**Post-deploy checks:**

```sql
SELECT to_regclass('public."BlogPost"');
SELECT COUNT(*) FROM "BlogPost";
```

Smoke: `GET /blog` en preview → 200 sin error Prisma.

---

## 5. Riesgos y mitigaciones

| Riesgo                                  | Mitigación                                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Migración falla por enum ya existente   | Deploy una sola vez; staging no tiene estos enums                                                                                               |
| Otras tablas del schema siguen faltando | Este gap es **acotado** a blog/marketing/leads; el diff completo staging→schema tiene más objetos (catálogo, packs, etc.) — migraciones futuras |
| DB vacía post-migrate                   | `/blog` carga vacío pero sin 500; seed de posts es paso separado                                                                                |
| `20260708150000` no aplicada en staging | Aplicar ambas en orden cronológico                                                                                                              |

---

## 6. Próximos pasos

1. **Review** del SQL en PR (solo `packages/db/.../migration.sql`).
2. **`migrate deploy`** en staging Neon (no producción).
3. **Seed opcional** de categorías/posts de prueba para QA blog.
4. Planificar migraciones gap adicionales si otras rutas CLF fallan por tablas faltantes.

---

## Referencias

- [`compramelafoto-preview-runtime-diagnostic.md`](./compramelafoto-preview-runtime-diagnostic.md)
- [`compramelafoto-staging-prisma-migrations-plan.md`](./compramelafoto-staging-prisma-migrations-plan.md)
