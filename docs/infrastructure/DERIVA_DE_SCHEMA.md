# Deriva de schema entre las bases de la suite

**Última verificación:** 2026-09-03 · **Última aplicación manual:** 2026-09-04
**Regla:** no incluir connection strings, usuarios ni passwords en este documento.

---

## El problema

`packages/db/prisma/schema.prisma` es **uno solo para todo el monorepo**, pero cada app
tiene **su propia base**. Cuando agregás un campo a un modelo compartido (`User` es el caso
típico) y lo aplicás en una sola base, las demás quedan con el cliente Prisma pidiendo una
columna que su base no tiene.

Lo traicionero es cómo falla:

- **Leer con `select` acotado sigue funcionando.** No se nota nada.
- **Escribir falla** con error Prisma **P2022**, aunque la escritura no use esa columna:
  Prisma devuelve todas las columnas del modelo cuando guarda.

Por eso el síntoma aparece tarde, en producción, y en un lugar que no tiene nada que ver
con el cambio que lo causó.

Ningún build corre `prisma migrate deploy` — el único comando de Prisma en los pipelines es
`prisma generate`, que actualiza el código pero **no** la base. Así que la deriva no se
corrige sola ni avisa.

## Qué revisar y cuándo

Después de tocar `schema.prisma`, y **antes de desplegar**:

```bash
pnpm --filter @repo/db db:drift --target compramelafoto='postgresql://…' --target clickaton='postgresql://…'
```

O pasando todos los destinos juntos:

```bash
DRIFT_TARGETS='{"compramelafoto":"postgresql://…","clickaton":"postgresql://…"}' pnpm --filter @repo/db db:drift
```

El script es **sólo lectura** (rechaza `--allow-write`) y **no lee `packages/db/.env`** a
propósito: hay que decir explícitamente qué base estás mirando. Las URLs se sacan del MCP de
Neon con `get_connection_string`; no viven en el repo.

### Cómo leer la salida

| Categoría | Qué significa | Urgencia |
| --------- | ------------- | -------- |
| **URGENTE** | Falta una columna en una tabla **con datos**. La app usa esa tabla: la próxima escritura falla con P2022. | Arreglar antes de desplegar |
| **latente** | Falta una columna en una tabla **vacía**. Hoy no rompe; rompe el día que esa app escriba ahí por primera vez. | Arreglar cuando se pueda |
| tablas "no usadas por esta app" | Tablas del schema compartido que esa base ni siquiera tiene. Normal. | Ninguna |

El script imprime el `ALTER TABLE … ADD COLUMN IF NOT EXISTS` sugerido para cada columna
faltante. **No ejecuta nada**: se revisa y se aplica a mano. Cuando una columna es `NOT NULL`
sin default, la marca con `REVISAR`, porque agregarla así revienta si la tabla ya tiene filas.

Cuando una columna faltante usa un tipo enum que esa base tampoco tiene, el script emite
primero el `CREATE TYPE` idempotente correspondiente y lo dice explícitamente ("van PRIMERO").
Sin eso el `ALTER` falla: pasa en las bases que nunca corrieron la migración que creó el tipo.
Infospot producción, por ejemplo, no tiene ninguno de los 9 enums que sus columnas faltantes
necesitan.

Sale con código 1 si hay deriva, 0 si está todo al día.

## Bases que comparten este schema

Proyectos Neon de la organización `Dnx` con tabla `User`:

| Proyecto Neon | Qué es |
| ------------- | ------ |
| `divine-hall-10689679` (`compramelafoto`) | producción de compramelafoto.com |
| `bitter-math-56019731` (`clickaton-production`) | producción de maratonfotografica.com |
| `wandering-pine-79918137` (`infospot-production`) | producción de Infospot |
| `fragrant-union-80829821` (`dnx-suite-staging`) | staging |
| `cold-silence-10115969` (`compramelafoto-staging`) | staging |

`plain-sky-50672248` (`clickaton-staging`) **no** tiene tabla `User`.

## Estado al 2026-09-03

| Base | Urgente | Latente |
| ---- | ------- | ------- |
| compramelafoto (prod) | 0 | 0 |
| clickaton (prod) | 0 | 34 |
| infospot (prod) | 0 | 107 |
| dnx-suite-staging | 2 | 74 |

Las latentes de Clickatón e Infospot están en tablas de otras apps (`Student`, `School`,
`PreCompraOrder`, `Template`, `DesignExportJob`…) que esas bases tienen creadas pero no usan.

## Migraciones aplicadas a mano

Registro de lo que se aplicó por fuera de `prisma migrate`, para no perderle el rastro.

| Fecha | Migración | Bases | Notas |
| ----- | --------- | ----- | ----- |
| 2026-09-04 | `20260903100000_referral_attribution_attempt` | las 5 | `compramelafoto` (prod) ya la tenía; se aplicó a las otras 4. Tabla nueva `ReferralAttributionAttempt`, aditiva y con `IF NOT EXISTS`. Verificado: 9 columnas y 5 índices en las 5, y una escritura de prueba en `compramelafoto-staging` (insertada, leída y borrada). |

El SQL es idempotente, así que si más adelante alguien corre `prisma migrate deploy` sobre alguna
de estas bases, esta migración pasa sin romper y queda registrada.

## Lo que este script NO arregla

Automatizar `prisma migrate deploy` en los builds **no es viable hoy**. Cada base tiene un
subconjunto distinto del historial de migraciones del repo:

| Base | Migraciones registradas | Fallidas bloqueantes |
| ---- | ----------------------- | -------------------- |
| repo | 160 | — |
| clickaton (prod) | 161 | 0 |
| compramelafoto (prod) | 348 filas / 339 nombres (incluye historial previo al monorepo) | 0 |
| infospot (prod) | 56 | 0 |
| dnx-suite-staging | 138 | 0 |

Correr `migrate deploy` sobre Infospot intentaría aplicarle más de cien migraciones que crean
tablas de otras apps. Sobre compramelafoto se toparía con un historial que arrastra la etapa
anterior al monorepo. Ordenar eso es un trabajo aparte y hay que hacerlo base por base, no
metiéndolo en el pipeline de golpe.

Mientras tanto, la rutina es: tocar el schema → correr `db:drift` → aplicar el SQL → desplegar.
