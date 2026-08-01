# Migraciones de schema propuestas (identidad)

**No aplicadas a Production.** Revisar en Staging tras consolidar DB.

---

## 1. ExternalIdentity (fase 4)

```prisma
model ExternalIdentity {
  id              String   @id @default(cuid())
  userId          Int
  provider        ExternalIdentityProvider
  providerSubject String
  emailAtProvider String?
  emailVerified   Boolean  @default(false)
  linkedAt        DateTime @default(now())
  lastLoginAt     DateTime?
  metadataSafe    Json?
  user            User     @relation(fields: [userId], references: [id])

  @@unique([provider, providerSubject])
  @@index([userId])
}

enum ExternalIdentityProvider {
  GOOGLE
  AUTH0
  APPLE
}
```

Migración de datos: `User.googleId` → fila `GOOGLE`. Mantener columna `googleId` en dual-read hasta retiro.

## 2. UserIdentityAlias (fusión)

```prisma
model UserIdentityAlias {
  id               String   @id @default(cuid())
  oldUserId        Int
  canonicalUserId  Int
  reason           String
  migratedAt       DateTime @default(now())

  @@unique([oldUserId])
  @@index([canonicalUserId])
}
```

## 3. ApplicationMembership (opcional si WorkspaceAppAccess no alcanza)

Solo si se reintroduce `WorkspaceAppAccess` / catálogo de apps en schema activo.

## 4. PaymentAccountGrant

Ya parcialmente cubierto por modelo de grants en DNX Payments — verificar que no queden tokens en claro en `User.mp*`.
