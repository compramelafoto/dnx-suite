-- Convertir valores monetarios de centavos a pesos (ARS enteros)
-- Redondeo: round(cents / 100.0)

-- Users: precio digital por defecto
UPDATE "User"
SET "defaultDigitalPhotoPrice" = ROUND("defaultDigitalPhotoPrice"::numeric / 100.0)::int
WHERE "defaultDigitalPhotoPrice" IS NOT NULL;

-- Albums: precio digital por foto
UPDATE "Album"
SET "digitalPhotoPriceCents" = ROUND("digitalPhotoPriceCents"::numeric / 100.0)::int
WHERE "digitalPhotoPriceCents" IS NOT NULL;

-- Orders: totales y comisiones
UPDATE "Order"
SET
  "totalCents" = ROUND("totalCents"::numeric / 100.0)::int,
  "platformCommissionCents" = CASE
    WHEN "platformCommissionCents" IS NULL THEN NULL
    ELSE ROUND("platformCommissionCents"::numeric / 100.0)::int
  END,
  "extensionSurchargeCents" = ROUND("extensionSurchargeCents"::numeric / 100.0)::int;

-- Order items: precio unitario y subtotal
UPDATE "OrderItem"
SET
  "priceCents" = ROUND("priceCents"::numeric / 100.0)::int,
  "subtotalCents" = ROUND("subtotalCents"::numeric / 100.0)::int;

-- AppConfig: mínimo digital (fila única)
UPDATE "AppConfig"
SET "minDigitalPhotoPrice" = ROUND("minDigitalPhotoPrice"::numeric / 100.0)::int
WHERE "minDigitalPhotoPrice" IS NOT NULL;

-- SystemSettings: minDigitalPhotoPrice (string numérico)
UPDATE "SystemSettings"
SET "value" = ROUND("value"::numeric / 100.0)::int::text
WHERE "key" = 'minDigitalPhotoPrice' AND "value" ~ '^[0-9]+$';
