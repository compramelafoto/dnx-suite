# Cómo aplicar la migración del alta de jurados

*2026-09-20. Migración `20260920120000_fotorank_judge_public_signup`.*

**El despliegue no corre `prisma migrate deploy`.** Esta migración se aplica a mano en las
cinco bases Neon del schema compartido, o las escrituras de las otras aplicaciones se
rompen.

## Qué agrega

- Dos enums: `FotorankJudgeDirectoryReviewStatus` y `FotorankJudgeSignupSource`.
- `FotorankJudgeAccount.emailVerifiedAt`.
- Seis columnas de revisión en `FotorankJudgeProfile`.
- Un índice sobre `directoryReviewStatus`, para la cola de Super Admin.
- `FotorankJudgeAuditEvent.organizationId` pasa a aceptar nulo.

**No agrega nada para la verificación del correo.** Eso usa `EmailVerificationToken` con
`purpose = 'VERIFY_EMAIL'`, que ya existe en las cinco bases (verificado el 2026-09-20: en
la base de FotoRank hay 25 tokens guardados).

## Qué pasa con los datos que ya están

Todos los perfiles existentes quedan `APPROVED`, con `signupSource = ORGANIZER_CREATED` y
`wantsDirectoryListing` igual a lo que ya tuvieran en `isListedInProfessionalDirectory`.

Si quedaran `PENDING`, desaparecerían del directorio sin que nadie entienda por qué. En la
base de FotoRank hay 0 perfiles, pero las otras cuatro comparten el schema y no se
revisaron una por una.

## Probada antes de aplicar

El 2026-09-21 se corrió entera sobre la rama Neon descartable
`prueba-migracion-jurados-20260921` (`br-gentle-tooth-adwbeoyq`), hija de `development`:

```
columnas nuevas en el perfil .............. 6
emailVerifiedAt en la cuenta .............. 1
organizationId de auditoría acepta nulo ... YES
perfiles que quedaron PENDING ............. 0
índice de la cola creado .................. 1
```

## Dónde hay que aplicarla

Verificado el 2026-09-21, una por una:

| Base | Proyecto Neon | Rama | Perfiles | Estado |
|---|---|---|---|---|
| FotoRank y FOTOFFICE | `divine-hall-10689679` | `development` (`br-old-rain-adwthzng`) | 0 | ✅ aplicada 21/09 |
| CompraMeLaFoto | `divine-hall-10689679` | `production` (`br-autumn-rain-ad18wq7y`) | 0 | ✅ aplicada 21/09 |
| Clickatón | `bitter-math-56019731` | por defecto | 0 | ✅ aplicada 21/09 |
| InfoSpot | `wandering-pine-79918137` | por defecto | 0 | ✅ aplicada 21/09 |
| DNX Suite staging | `fragrant-union-80829821` | por defecto | 0 | ✅ aplicada 21/09 |

**Las cinco quedaron aplicadas y registradas el 2026-09-21.** En cada una se verificaron
los cinco controles del paso 3 y dieron lo esperado. Ninguna fila de datos se tocó: los 822
usuarios de CompraMeLaFoto y los 271 socios de FOTOFFICE siguen igual.

**`compramelafoto-staging` (`cold-silence-10115969`) no tiene la tabla**, así que no entra:
nunca recibió el schema de FotoRank.

**Las cinco tienen 0 perfiles.** Eso significa que el `UPDATE` de la migración no va a
tocar ninguna fila: es puro agregar columnas. Es el mejor momento posible para aplicarla.

## El procedimiento

Para cada una de las cinco bases, en este orden:

**Paso 1 — Mirar antes de escribir.**
```sql
SELECT COUNT(*) AS perfiles FROM "FotorankJudgeProfile";
SELECT COUNT(*) AS ya_migrada FROM information_schema.columns
 WHERE table_name = 'FotorankJudgeProfile' AND column_name = 'directoryReviewStatus';
```
Si `ya_migrada` da 1, esa base ya está: pasar a la siguiente.

**Paso 2 — Aplicar las siete sentencias**, en una transacción, desde
`packages/db/prisma/migrations/20260920120000_fotorank_judge_public_signup/migration.sql`.

**Paso 3 — Verificar que quedó bien.**
```sql
SELECT 'columnas nuevas', COUNT(*)::text FROM information_schema.columns
 WHERE table_name = 'FotorankJudgeProfile'
   AND column_name IN ('signupSource','directoryReviewStatus','directoryReviewedAt',
                       'directoryReviewedByUserId','directoryReviewNotes','wantsDirectoryListing')
UNION ALL SELECT 'emailVerifiedAt', COUNT(*)::text FROM information_schema.columns
 WHERE table_name = 'FotorankJudgeAccount' AND column_name = 'emailVerifiedAt'
UNION ALL SELECT 'auditoria acepta nulo', is_nullable FROM information_schema.columns
 WHERE table_name = 'FotorankJudgeAuditEvent' AND column_name = 'organizationId'
UNION ALL SELECT 'perfiles pendientes', COUNT(*)::text FROM "FotorankJudgeProfile"
 WHERE "directoryReviewStatus" = 'PENDING';
```
Tiene que dar: **6**, **1**, **YES**, **0**.

**Paso 4 — Registrarla en `_prisma_migrations`.** Sin esto, el próximo que mire va a creer
que falta, y un `migrate deploy` intentaría aplicarla de nuevo.

```sql
INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES
  (gen_random_uuid()::text,
   '0b61f310ea3483e51614e4806d70922b7c1b6302272e82af2d2796415c573ce5',
   NOW(), '20260920120000_fotorank_judge_public_signup', NULL, NULL, NOW(), 1);
```

Ese checksum es el sha256 del archivo `migration.sql` de este repositorio (1693 bytes).
**Si el archivo se edita, el checksum cambia** y hay que recalcularlo con:
```bash
shasum -a 256 packages/db/prisma/migrations/20260920120000_fotorank_judge_public_signup/migration.sql
```

## Si algo sale mal

La migración sólo agrega. No borra columnas ni datos, así que revertirla es:

```sql
ALTER TABLE "FotorankJudgeProfile"
  DROP COLUMN "signupSource", DROP COLUMN "directoryReviewStatus",
  DROP COLUMN "directoryReviewedAt", DROP COLUMN "directoryReviewedByUserId",
  DROP COLUMN "directoryReviewNotes", DROP COLUMN "wantsDirectoryListing";
ALTER TABLE "FotorankJudgeAccount" DROP COLUMN "emailVerifiedAt";
DROP TYPE "FotorankJudgeDirectoryReviewStatus";
DROP TYPE "FotorankJudgeSignupSource";
```

`organizationId` **no se vuelve obligatorio**: para entonces puede haber hechos de
plataforma auditados sin organización, y volver atrás los borraría.
