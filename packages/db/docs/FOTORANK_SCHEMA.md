# Schema FotoRank — Base de datos inicial

## Resumen

Schema Prisma para FotoRank que **reutiliza la autenticación de ComprameLaFoto** sin modificar la lógica existente. Permisos y contexto interno de FotoRank se manejan con tablas propias, separadas del `User.role` global.

---

## Ubicación en el schema

El bloque FotoRank está insertado **al final** de `packages/db/prisma/schema.prisma`, después de los modelos existentes (Diploma, Ranking, etc.):

```
// =============================================================================
// FOTORANK — Perfil, organizaciones y concursos (permisos separados de ComprameLaFoto)
// Reutiliza User existente. NO tocar auth, cookie ni User.role.
// =============================================================================
```

---

## Cambios en el modelo User

Se añadieron **solo relaciones** al modelo `User` existente. No se modificó ningún campo ni se agregó `role`:

```prisma
model User {
  // ... campos existentes sin cambios ...

  memberships                         Membership[]
  fotorankProfile                     FotorankProfile?
  contestOrganizationMembers           ContestOrganizationMember[]
  invitedContestOrganizationMembers   ContestOrganizationMember[] @relation("InvitedBy")
  createdContestOrganizations         ContestOrganization[]
  createdFotorankContests             FotorankContest[]
}
```

---

## Conflictos de nombres

| Modelo solicitado | Modelo existente | Solución |
|-------------------|------------------|----------|
| Contest           | Contest          | Se creó **FotorankContest** para evitar conflicto |
| ContestCategory   | Category         | Se creó **FotorankContestCategory** para evitar conflicto |

Los modelos `Contest`, `Category`, `Entry`, `Workspace`, etc. **no se modifican** y siguen usándose por ComprameLaFoto / lógica actual.

---

## Entidades añadidas

### 1. FotorankProfile
- Relación 1:1 con `User`
- Activa al usuario dentro de FotoRank
- Campos: `id`, `userId`, `displayName`, `avatarUrl`, `bio`, `createdAt`, `updatedAt`

### 2. ContestOrganization
- Institución, comunidad, escuela o asociación que organiza concursos
- Campos: `id`, `name`, `slug`, `description`, `logoUrl`, `website`, `createdByUserId`, `createdAt`, `updatedAt`

### 3. ContestOrganizationMember
- Relación User ↔ ContestOrganization con rol por organización
- Enum `FotorankOrganizationRole`: OWNER, ADMIN, EDITOR, JUDGE, VIEWER
- Enum `FotorankMemberStatus`: ACTIVE, PENDING, INVITED, DECLINED, REMOVED
- Unique compuesto: `(organizationId, userId)`

### 4. FotorankContest
- Pertenece a `ContestOrganization`
- Enum `FotorankContestStatus`: DRAFT, ACTIVE, CLOSED
- Enum `FotorankContestVisibility`: PUBLIC, PRIVATE, UNLISTED
- Campos de fechas: `startAt`, `submissionDeadline`, `judgingStartAt`, `judgingEndAt`, `resultsAt`
- Unique compuesto: `(organizationId, slug)`

### 5. FotorankContestCategory
- Pertenece a `FotorankContest`
- Campos: `id`, `contestId`, `name`, `slug`, `description`, `maxFiles`, `sortOrder`, `createdAt`, `updatedAt`
- Unique compuesto: `(contestId, slug)`

---

## Migración segura

1. **Crear migración (ya generada):**
   ```bash
   cd packages/db && pnpm db:migrate
   ```

2. **La migración solo añade:**
   - Nuevas tablas
   - Nuevos enums
   - Nuevas foreign keys hacia `User` y entre tablas FotoRank
   - **No modifica** tablas existentes

3. **Aplicar:**
   ```bash
   pnpm db:migrate
   ```
   O en producción:
   ```bash
   pnpm db:migrate:deploy
   ```

---

## Próximos pasos (terreno listo)

- [ ] Onboarding de FotoRank (crear FotorankProfile al activar)
- [ ] Creación de organización (ContestOrganization + ContestOrganizationMember OWNER)
- [ ] Creación de concurso (FotorankContest + FotorankContestCategory)
- [ ] Membresías por organización (invitaciones, roles, status)
- [ ] Migrar la UI actual de concursos (que usa Contest/Workspace) a FotorankContest/ContestOrganization cuando corresponda

---

## Criterios cumplidos

- ✅ Misma cuenta (User) para toda la suite
- ✅ Permisos separados por producto (ContestOrganizationMember vs Membership)
- ✅ Cero roturas en ComprameLaFoto
- ✅ Base sana para escalar FotoRank
- ✅ No se tocó `lib/auth.ts`, cookie, ni `User.role`
