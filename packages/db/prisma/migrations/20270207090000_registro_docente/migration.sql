-- CreateTable
CREATE TABLE "DocenteEscuela" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "numero" TEXT,
    "cue" TEXT,
    "localidad" TEXT,
    "modelo" TEXT NOT NULL,
    "reglas" JSONB NOT NULL DEFAULT '{}',
    "archivadaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocenteEscuela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocenteCurso" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "escuelaId" TEXT NOT NULL,
    "cicloLectivo" INTEGER NOT NULL,
    "anio" TEXT NOT NULL,
    "division" TEXT,
    "turno" TEXT,
    "materia" TEXT NOT NULL,
    "reglas" JSONB NOT NULL DEFAULT '{}',
    "confirmadoMiEscuela" JSONB NOT NULL DEFAULT '{}',
    "archivadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocenteCurso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocenteEstudiante" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dni" TEXT,
    "orden" INTEGER NOT NULL,
    "condicion" TEXT NOT NULL DEFAULT 'R',
    "altaAt" DATE,
    "bajaAt" DATE,
    "bajaMotivo" TEXT,
    "reglas" JSONB NOT NULL DEFAULT '{}',
    "notaPrivada" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocenteEstudiante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocenteClase" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'DICTADA',
    "motivo" TEXT,
    "horaDocente" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocenteClase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocenteAsistencia" (
    "id" TEXT NOT NULL,
    "claseId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "horaLlegada" TEXT,
    "anotadaAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocenteAsistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocenteEvaluacion" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha" DATE,
    "periodo" TEXT NOT NULL,
    "notaMaxima" DECIMAL(6,2) NOT NULL DEFAULT 10,
    "recuperaAId" TEXT,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocenteEvaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocenteNota" (
    "id" TEXT NOT NULL,
    "evaluacionId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "valor" DECIMAL(6,2),
    "especial" TEXT,
    "entregaTarde" BOOLEAN NOT NULL DEFAULT false,
    "devolucion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocenteNota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocenteNotaPeriodo" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "final" DECIMAL(6,2),
    "especial" TEXT,
    "sugeridaAlConfirmar" DECIMAL(6,2),
    "motivo" TEXT,
    "pasadaMiEscuelaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocenteNotaPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocenteEscuela_workspaceId_idx" ON "DocenteEscuela"("workspaceId");

-- CreateIndex
CREATE INDEX "DocenteCurso_workspaceId_idx" ON "DocenteCurso"("workspaceId");

-- CreateIndex
CREATE INDEX "DocenteCurso_escuelaId_idx" ON "DocenteCurso"("escuelaId");

-- CreateIndex
CREATE INDEX "DocenteEstudiante_cursoId_orden_idx" ON "DocenteEstudiante"("cursoId", "orden");

-- CreateIndex
CREATE INDEX "DocenteEstudiante_workspaceId_idx" ON "DocenteEstudiante"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "DocenteClase_cursoId_fecha_key" ON "DocenteClase"("cursoId", "fecha");

-- CreateIndex
CREATE INDEX "DocenteAsistencia_estudianteId_idx" ON "DocenteAsistencia"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "DocenteAsistencia_claseId_estudianteId_key" ON "DocenteAsistencia"("claseId", "estudianteId");

-- CreateIndex
CREATE INDEX "DocenteEvaluacion_cursoId_periodo_idx" ON "DocenteEvaluacion"("cursoId", "periodo");

-- CreateIndex
CREATE INDEX "DocenteNota_estudianteId_idx" ON "DocenteNota"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "DocenteNota_evaluacionId_estudianteId_key" ON "DocenteNota"("evaluacionId", "estudianteId");

-- CreateIndex
CREATE INDEX "DocenteNotaPeriodo_cursoId_periodo_idx" ON "DocenteNotaPeriodo"("cursoId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "DocenteNotaPeriodo_estudianteId_periodo_key" ON "DocenteNotaPeriodo"("estudianteId", "periodo");

-- AddForeignKey
ALTER TABLE "DocenteEscuela" ADD CONSTRAINT "DocenteEscuela_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteCurso" ADD CONSTRAINT "DocenteCurso_escuelaId_fkey" FOREIGN KEY ("escuelaId") REFERENCES "DocenteEscuela"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteEstudiante" ADD CONSTRAINT "DocenteEstudiante_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "DocenteCurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteClase" ADD CONSTRAINT "DocenteClase_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "DocenteCurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteAsistencia" ADD CONSTRAINT "DocenteAsistencia_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "DocenteClase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteAsistencia" ADD CONSTRAINT "DocenteAsistencia_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "DocenteEstudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteEvaluacion" ADD CONSTRAINT "DocenteEvaluacion_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "DocenteCurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteEvaluacion" ADD CONSTRAINT "DocenteEvaluacion_recuperaAId_fkey" FOREIGN KEY ("recuperaAId") REFERENCES "DocenteEvaluacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteNota" ADD CONSTRAINT "DocenteNota_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "DocenteEvaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteNota" ADD CONSTRAINT "DocenteNota_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "DocenteEstudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteNotaPeriodo" ADD CONSTRAINT "DocenteNotaPeriodo_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "DocenteCurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocenteNotaPeriodo" ADD CONSTRAINT "DocenteNotaPeriodo_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "DocenteEstudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

