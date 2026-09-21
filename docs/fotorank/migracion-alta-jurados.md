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

## El procedimiento

Para cada una de las cinco bases:

1. Contar lo que hay antes, para saber si la actualización toca algo:
   ```sql
   SELECT COUNT(*) FROM "FotorankJudgeProfile";
   ```
2. Aplicar el contenido de
   `packages/db/prisma/migrations/20260920120000_fotorank_judge_public_signup/migration.sql`.
3. Verificar que no quedó nada pendiente:
   ```sql
   SELECT "directoryReviewStatus", COUNT(*) FROM "FotorankJudgeProfile" GROUP BY 1;
   ```
   Tiene que devolver sólo `APPROVED`, o ninguna fila.
4. Registrar la migración en `_prisma_migrations` con el checksum de una base sana, según
   el procedimiento ya documentado en el repositorio. **Aplicar el SQL sin registrarlo deja
   `_prisma_migrations` desincronizada** y el próximo que mire va a creer que falta.

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
