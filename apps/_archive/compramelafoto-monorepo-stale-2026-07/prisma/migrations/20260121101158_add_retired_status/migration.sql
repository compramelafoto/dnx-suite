-- Crear enum PrintOrderStatus si no existe (con todos los valores iniciales)
DO $$ BEGIN
    CREATE TYPE "PrintOrderStatus" AS ENUM (
        'CREATED',
        'IN_PRODUCTION',
        'READY',
        'READY_TO_PICKUP',
        'SHIPPED',
        'DELIVERED',
        'CANCELED',
        'RETIRED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Si el enum ya existe, solo agregar RETIRED si no está presente
DO $$ 
BEGIN
    -- Intentar agregar RETIRED solo si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'RETIRED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PrintOrderStatus')
    ) THEN
        ALTER TYPE "PrintOrderStatus" ADD VALUE 'RETIRED';
    END IF;
END $$;
