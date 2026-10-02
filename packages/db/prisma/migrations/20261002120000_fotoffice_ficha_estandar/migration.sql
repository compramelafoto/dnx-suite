-- Etapa 0.3 FOTOFFICE: ficha estándar. Puramente ADITIVO: ocho tablas nuevas.
-- No altera Client, Member, Workspace ni User (las FKs nacen en las tablas nuevas).
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE.

CREATE TABLE "FotofficeNoteCategory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeNoteCategory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FotofficeNote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "memberId" TEXT,
    "categoryId" TEXT,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "authorUserId" INTEGER,
    "authorLabel" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeNote_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FotofficeTag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gris',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeTag_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FotofficeTagAssignment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "clientId" TEXT,
    "memberId" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeTagAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FotofficeAttachment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "memberId" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "uploadedByUserId" INTEGER,
    "uploadedByLabel" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "purgeAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeAttachment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FotofficePersonRelation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fromClientId" TEXT,
    "fromMemberId" TEXT,
    "toClientId" TEXT,
    "toMemberId" TEXT,
    "kind" TEXT NOT NULL,
    "customLabel" TEXT,
    "note" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficePersonRelation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FotofficePersonEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "memberId" TEXT,
    "kind" TEXT NOT NULL,
    "detail" JSONB,
    "actorUserId" INTEGER,
    "actorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficePersonEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClientAudit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorLabel" TEXT NOT NULL,
    "changesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FotofficeNoteCategory_workspaceId_isActive_order_idx" ON "FotofficeNoteCategory"("workspaceId", "isActive", "order");
CREATE UNIQUE INDEX "FotofficeNoteCategory_workspaceId_name_key" ON "FotofficeNoteCategory"("workspaceId", "name");
CREATE INDEX "FotofficeNote_workspaceId_clientId_createdAt_idx" ON "FotofficeNote"("workspaceId", "clientId", "createdAt");
CREATE INDEX "FotofficeNote_workspaceId_memberId_createdAt_idx" ON "FotofficeNote"("workspaceId", "memberId", "createdAt");
CREATE UNIQUE INDEX "FotofficeTag_workspaceId_nameKey_key" ON "FotofficeTag"("workspaceId", "nameKey");
CREATE INDEX "FotofficeTagAssignment_workspaceId_tagId_idx" ON "FotofficeTagAssignment"("workspaceId", "tagId");
CREATE INDEX "FotofficeTagAssignment_clientId_idx" ON "FotofficeTagAssignment"("clientId");
CREATE INDEX "FotofficeTagAssignment_memberId_idx" ON "FotofficeTagAssignment"("memberId");
CREATE UNIQUE INDEX "FotofficeAttachment_storageKey_key" ON "FotofficeAttachment"("storageKey");
CREATE INDEX "FotofficeAttachment_workspaceId_clientId_createdAt_idx" ON "FotofficeAttachment"("workspaceId", "clientId", "createdAt");
CREATE INDEX "FotofficeAttachment_workspaceId_memberId_createdAt_idx" ON "FotofficeAttachment"("workspaceId", "memberId", "createdAt");
CREATE INDEX "FotofficeAttachment_status_purgeAfter_idx" ON "FotofficeAttachment"("status", "purgeAfter");
CREATE INDEX "FotofficePersonRelation_workspaceId_fromClientId_idx" ON "FotofficePersonRelation"("workspaceId", "fromClientId");
CREATE INDEX "FotofficePersonRelation_workspaceId_fromMemberId_idx" ON "FotofficePersonRelation"("workspaceId", "fromMemberId");
CREATE INDEX "FotofficePersonRelation_workspaceId_toClientId_idx" ON "FotofficePersonRelation"("workspaceId", "toClientId");
CREATE INDEX "FotofficePersonRelation_workspaceId_toMemberId_idx" ON "FotofficePersonRelation"("workspaceId", "toMemberId");
CREATE INDEX "FotofficePersonEvent_workspaceId_clientId_createdAt_idx" ON "FotofficePersonEvent"("workspaceId", "clientId", "createdAt");
CREATE INDEX "FotofficePersonEvent_workspaceId_memberId_createdAt_idx" ON "FotofficePersonEvent"("workspaceId", "memberId", "createdAt");
CREATE INDEX "ClientAudit_workspaceId_clientId_createdAt_idx" ON "ClientAudit"("workspaceId", "clientId", "createdAt");
ALTER TABLE "FotofficeNoteCategory" ADD CONSTRAINT "FotofficeNoteCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeNote" ADD CONSTRAINT "FotofficeNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeNote" ADD CONSTRAINT "FotofficeNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeNote" ADD CONSTRAINT "FotofficeNote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeNote" ADD CONSTRAINT "FotofficeNote_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FotofficeNoteCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotofficeNote" ADD CONSTRAINT "FotofficeNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotofficeTag" ADD CONSTRAINT "FotofficeTag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeTagAssignment" ADD CONSTRAINT "FotofficeTagAssignment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeTagAssignment" ADD CONSTRAINT "FotofficeTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "FotofficeTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeTagAssignment" ADD CONSTRAINT "FotofficeTagAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeTagAssignment" ADD CONSTRAINT "FotofficeTagAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeAttachment" ADD CONSTRAINT "FotofficeAttachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeAttachment" ADD CONSTRAINT "FotofficeAttachment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeAttachment" ADD CONSTRAINT "FotofficeAttachment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficePersonRelation" ADD CONSTRAINT "FotofficePersonRelation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficePersonRelation" ADD CONSTRAINT "FotofficePersonRelation_fromClientId_fkey" FOREIGN KEY ("fromClientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficePersonRelation" ADD CONSTRAINT "FotofficePersonRelation_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficePersonRelation" ADD CONSTRAINT "FotofficePersonRelation_toClientId_fkey" FOREIGN KEY ("toClientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficePersonRelation" ADD CONSTRAINT "FotofficePersonRelation_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficePersonEvent" ADD CONSTRAINT "FotofficePersonEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficePersonEvent" ADD CONSTRAINT "FotofficePersonEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficePersonEvent" ADD CONSTRAINT "FotofficePersonEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientAudit" ADD CONSTRAINT "ClientAudit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientAudit" ADD CONSTRAINT "ClientAudit_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactamente una persona por fila.
ALTER TABLE "FotofficeNote" ADD CONSTRAINT "FotofficeNote_una_persona" CHECK (("clientId" IS NULL) <> ("memberId" IS NULL));
ALTER TABLE "FotofficeTagAssignment" ADD CONSTRAINT "FotofficeTagAssignment_una_persona" CHECK (("clientId" IS NULL) <> ("memberId" IS NULL));
ALTER TABLE "FotofficeAttachment" ADD CONSTRAINT "FotofficeAttachment_una_persona" CHECK (("clientId" IS NULL) <> ("memberId" IS NULL));
ALTER TABLE "FotofficePersonEvent" ADD CONSTRAINT "FotofficePersonEvent_una_persona" CHECK (("clientId" IS NULL) <> ("memberId" IS NULL));
ALTER TABLE "FotofficePersonRelation" ADD CONSTRAINT "FotofficePersonRelation_from" CHECK (("fromClientId" IS NULL) <> ("fromMemberId" IS NULL));
ALTER TABLE "FotofficePersonRelation" ADD CONSTRAINT "FotofficePersonRelation_to" CHECK (("toClientId" IS NULL) <> ("toMemberId" IS NULL));

-- Una etiqueta una sola vez por persona.
CREATE UNIQUE INDEX "FotofficeTagAssignment_tag_cliente" ON "FotofficeTagAssignment"("tagId", "clientId") WHERE "clientId" IS NOT NULL;
CREATE UNIQUE INDEX "FotofficeTagAssignment_tag_socio" ON "FotofficeTagAssignment"("tagId", "memberId") WHERE "memberId" IS NOT NULL;

-- Conversión única de "Observaciones" (idempotente: los ids obs_c_/obs_m_ evitan duplicar si se vuelve a correr).
INSERT INTO "FotofficeNote" ("id","workspaceId","clientId","memberId","categoryId","body","pinned","authorUserId","authorLabel","createdAt")
SELECT 'obs_c_' || c."id", c."workspaceId", c."id", NULL, NULL, c."notes", true, NULL, 'Importado', c."createdAt"
FROM "Client" c
WHERE c."notes" IS NOT NULL AND btrim(c."notes") <> ''
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "FotofficeNote" ("id","workspaceId","clientId","memberId","categoryId","body","pinned","authorUserId","authorLabel","createdAt")
SELECT 'obs_m_' || m."id", m."workspaceId",
       (SELECT c."id" FROM "Client" c WHERE c."memberId" = m."id"),
       CASE WHEN EXISTS (SELECT 1 FROM "Client" c WHERE c."memberId" = m."id") THEN NULL ELSE m."id" END,
       NULL, m."notes", true, NULL, 'Importado', m."createdAt"
FROM "Member" m
WHERE m."notes" IS NOT NULL AND btrim(m."notes") <> ''
ON CONFLICT ("id") DO NOTHING;
