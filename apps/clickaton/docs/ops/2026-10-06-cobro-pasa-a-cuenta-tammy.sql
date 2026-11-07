-- Clickatón: el 100 % del cobro pasa de la cuenta MP de Dnx Estudio
-- (pa_ba733fa7a35f4326 / MP 97484805) a la de Tammy (pa_c938e72aed3a485c / MP 200207816).
-- Va junto con apps/clickaton/lib/payments/live-collector.ts: aplicar en el mismo
-- momento en que ese cambio llega a producción.
--
-- Por cada edición: nueva versión PUBLICADA del reparto con 100 % a Tammy y la
-- anterior queda SUPERSEDED (el historial no se toca; lo ya cobrado no se mueve).

BEGIN;

-- 1ª edición: Tammy ya figuraba como participante, pero sin cuenta de cobro.
UPDATE "DnxAgreementParticipant"
   SET "paymentAccountId" = 'pa_c938e72aed3a485c', "updatedAt" = now()
 WHERE id = 'cms78d1hy000xxpc4q6nbgioi'
   AND "financialIdentityId" = 'cms78czmk000rxpc4zdx9k8bf';

-- Navidad 2026 y Otoño 2027: Tammy entra como participante.
INSERT INTO "DnxAgreementParticipant"
  (id, "agreementId", "financialIdentityId", "paymentAccountId", "roleLabel", status,
   "invitedByUserId", "approvedByUserId", "acceptedAt", "createdAt", "updatedAt")
VALUES
  ('cmtammy0participant02navid', 'cmu9nav2agreement001navid', 'cms78czmk000rxpc4zdx9k8bf',
   'pa_c938e72aed3a485c', 'ORGANIZER', 'ACCEPTED', 1, 1, now(), now(), now()),
  ('cmtammy0participant03otono', 'cmu9oto3agreement003otono', 'cms78czmk000rxpc4zdx9k8bf',
   'pa_c938e72aed3a485c', 'ORGANIZER', 'ACCEPTED', 1, 1, now(), now(), now());

-- Nuevas versiones publicadas.
INSERT INTO "DnxDistributionVersion"
  (id, "agreementId", "versionNumber", status, "roundingPolicy", "feePolicy",
   "publishedAt", "publishedByUserId", "supersedesVersionId", "createdAt")
SELECT n.id, v."agreementId", v."versionNumber" + 1, 'PUBLISHED', v."roundingPolicy", v."feePolicy",
       now(), 1, v.id, now()
  FROM (VALUES
    ('cmtammy0version0003arg2026', 'cms8e6ys9000oitnse1v8otsf'),
    ('cmtammy0version0002navidad', 'cmu9nav2version00001navid'),
    ('cmtammy0version0002otono27', 'cmu9oto3version0003otono')
  ) AS n(id, old_id)
  JOIN "DnxDistributionVersion" v ON v.id = n.old_id;

INSERT INTO "DnxDistributionRule"
  (id, "distributionVersionId", "agreementParticipantId", kind, value, priority, optional, "createdAt")
VALUES
  ('cmtammy0rule000003arg2026', 'cmtammy0version0003arg2026', 'cms78d1hy000xxpc4q6nbgioi', 'PERCENTAGE', 10000, 100, false, now()),
  ('cmtammy0rule000002navidad', 'cmtammy0version0002navidad', 'cmtammy0participant02navid', 'PERCENTAGE', 10000, 100, false, now()),
  ('cmtammy0rule000002otono27', 'cmtammy0version0002otono27', 'cmtammy0participant03otono', 'PERCENTAGE', 10000, 100, false, now());

UPDATE "DnxDistributionVersion" SET status = 'SUPERSEDED'
 WHERE id IN ('cms8e6ys9000oitnse1v8otsf', 'cmu9nav2version00001navid', 'cmu9oto3version0003otono');

UPDATE "DnxEconomicAgreement" a
   SET "currentVersionId" = n.new_id,
       name = regexp_replace(a.name, 'DNX Studio 100%( \(temporal\))?', 'Tammy 100%'),
       "updatedAt" = now()
  FROM (VALUES
    ('cms78d0f8000txpc4krmfbcup', 'cmtammy0version0003arg2026'),
    ('cmu9nav2agreement001navid', 'cmtammy0version0002navidad'),
    ('cmu9oto3agreement003otono', 'cmtammy0version0002otono27')
  ) AS n(agreement_id, new_id)
 WHERE a.id = n.agreement_id;

-- Inscripciones vencidas que guardaron la cuenta vieja: si alguien reintenta,
-- que tome el reparto nuevo (si no, pagaría a Dnx y no se podría confirmar).
UPDATE "ClickatonRegistration" SET "financialDistributionSnapshot" = NULL
 WHERE "paymentStatus" = 'EXPIRED' AND "financialDistributionSnapshot" IS NOT NULL;

COMMIT;
