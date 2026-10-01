-- Consigna fuera de puntaje ("sorpresa extra").
-- `false` = se entrega y se preselecciona, pero no entra en la calificación ni en el
-- ranking de la edición. El default `true` deja intactas las consignas que ya existen.
ALTER TABLE "ClickatonPrompt"
  ADD COLUMN IF NOT EXISTS "countsForScoring" BOOLEAN NOT NULL DEFAULT true;
