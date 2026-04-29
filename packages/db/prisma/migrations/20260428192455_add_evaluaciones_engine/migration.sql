-- CreateTable
CREATE TABLE "EvaluationContext" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationContextStudent" (
    "id" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "EvaluationContextStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationActivity" (
    "id" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" DECIMAL(8,2),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubric" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricCriteria" (
    "id" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "weight" DECIMAL(8,2),
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RubricCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricLevel" (
    "id" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score" DECIMAL(8,2) NOT NULL,
    "feedbackText" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RubricLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationResult" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "totalScore" DECIMAL(8,2) NOT NULL,
    "finalFeedback" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationResultItem" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "score" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "EvaluationResultItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationContext_workspaceId_idx" ON "EvaluationContext"("workspaceId");

-- CreateIndex
CREATE INDEX "EvaluationContext_ownerType_ownerId_idx" ON "EvaluationContext"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "Student_workspaceId_idx" ON "Student"("workspaceId");

-- CreateIndex
CREATE INDEX "Student_email_idx" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_workspaceId_externalId_key" ON "Student"("workspaceId", "externalId");

-- CreateIndex
CREATE INDEX "EvaluationContextStudent_studentId_idx" ON "EvaluationContextStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationContextStudent_contextId_studentId_key" ON "EvaluationContextStudent"("contextId", "studentId");

-- CreateIndex
CREATE INDEX "EvaluationActivity_contextId_idx" ON "EvaluationActivity"("contextId");

-- CreateIndex
CREATE UNIQUE INDEX "Rubric_activityId_key" ON "Rubric"("activityId");

-- CreateIndex
CREATE INDEX "RubricCriteria_rubricId_idx" ON "RubricCriteria"("rubricId");

-- CreateIndex
CREATE INDEX "RubricLevel_criteriaId_idx" ON "RubricLevel"("criteriaId");

-- CreateIndex
CREATE INDEX "EvaluationResult_studentId_idx" ON "EvaluationResult"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationResult_activityId_studentId_key" ON "EvaluationResult"("activityId", "studentId");

-- CreateIndex
CREATE INDEX "EvaluationResultItem_levelId_idx" ON "EvaluationResultItem"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationResultItem_resultId_criteriaId_key" ON "EvaluationResultItem"("resultId", "criteriaId");

-- AddForeignKey
ALTER TABLE "EvaluationContext" ADD CONSTRAINT "EvaluationContext_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationContextStudent" ADD CONSTRAINT "EvaluationContextStudent_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "EvaluationContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationContextStudent" ADD CONSTRAINT "EvaluationContextStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationActivity" ADD CONSTRAINT "EvaluationActivity_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "EvaluationContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rubric" ADD CONSTRAINT "Rubric_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "EvaluationActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricCriteria" ADD CONSTRAINT "RubricCriteria_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "Rubric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricLevel" ADD CONSTRAINT "RubricLevel_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "RubricCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResult" ADD CONSTRAINT "EvaluationResult_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "EvaluationActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResult" ADD CONSTRAINT "EvaluationResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResultItem" ADD CONSTRAINT "EvaluationResultItem_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "EvaluationResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResultItem" ADD CONSTRAINT "EvaluationResultItem_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "RubricCriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResultItem" ADD CONSTRAINT "EvaluationResultItem_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "RubricLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
