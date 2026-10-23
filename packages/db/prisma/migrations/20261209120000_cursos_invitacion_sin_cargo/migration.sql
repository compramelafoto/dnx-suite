-- FOTOFFICE: invitar alumnos sin cargo a un curso grabado. Sólo agrega valores a dos enums
-- de cursos. Idempotente.
ALTER TYPE "CourseAccessOrigin" ADD VALUE IF NOT EXISTS 'INVITATION';
ALTER TYPE "CourseEnrollmentPaymentMethod" ADD VALUE IF NOT EXISTS 'INVITATION';
