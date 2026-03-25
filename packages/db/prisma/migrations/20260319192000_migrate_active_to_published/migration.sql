-- Migrar concursos ACTIVE (legacy) a PUBLISHED
UPDATE "FotorankContest" SET status = 'PUBLISHED' WHERE status = 'ACTIVE';
