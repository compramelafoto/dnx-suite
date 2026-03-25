# Módulo Jurados (Fotorank)

Base funcional completa para jurados con auth separada, asignaciones por categoría, evaluación anónima y auditoría.

## Cobertura por fase

1. **Fundación de datos y contratos**
   - Schema Prisma `FotorankJudge*` + enums de estados/métodos.
   - Migración creada en `packages/db/prisma/migrations/20260321131523_add_fotorank_judges_module`.
   - Contratos base en `contracts.ts`.

2. **CRUD jurados**
   - Admin: `/jurados`, `/jurados/nuevo`, `/jurados/[judgeId]/editar`.
   - Perfil público: `/jurados/publico/[publicSlug]`.

3. **Asignaciones e invitaciones**
   - Admin: `/jurados/asignaciones`, `/jurados/invitaciones`.
   - Invitación con token hasheado y vencimiento.
   - Aceptación por registro: `/jurado/register?token=...`.

4. **Panel jurado y evaluación**
   - Login jurado: `/jurado/login`.
   - Panel: `/jurado/panel`.
   - Evaluación una-a-una: `/jurado/asignaciones/[assignmentId]/evaluar`.

5. **Historial y auditoría**
   - Eventos append-only en `FotorankJudgeAuditEvent`.
   - Historial de voto en `FotorankJudgeVoteHistory`.
   - Vista admin: `/jurados/auditoria`.

6. **Público + hardening**
   - Jurados públicos por concurso: `/concursos/[slug]/jurados`.
   - Perfil público enriquecido por `publicSlug`.

## Reglas técnicas clave

- **Anonimato de autor**: en evaluación no se expone `authorUserId` del entry.
- **No impersonación**: auth de jurado separada (`dnx_judge_auth`).
- **Métodos dinámicos**: renderer por `methodType` + `methodConfigJson`.
- **Edición de voto**: controlada por `allowVoteEdit` + ventana temporal.

## Verificación recomendada

- Ejecutar migración: `pnpm -C packages/db db:migrate`.
- Regenerar cliente Prisma: `pnpm -C packages/db db:generate`.
- Chequeo tipos app: `pnpm -C apps/fotorank check-types`.
- Sembrar datos demo: `pnpm -C packages/db db:seed`.

## Perfil de jurado: avatar y bio

- Detalle de **storage de avatar**, borrado seguro y **reutilización del renderer de bio** (preview vs público): ver **[JUDGE_PROFILE_STORAGE.md](./JUDGE_PROFILE_STORAGE.md)**.
