-- Cam Of Duty: la cuenta se creó para entrar a Cam Of Duty (y no era de CLF de antes).
ALTER TABLE "CamOfDutyMember" ADD COLUMN IF NOT EXISTS "accountFromCamOfDuty" BOOLEAN NOT NULL DEFAULT false;
