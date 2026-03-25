-- AlterTable: OrderItem.finish de enum PrintFinish a String para permitir acabados libres (cuero, arena, lija, etc.)
ALTER TABLE "OrderItem" ALTER COLUMN "finish" TYPE TEXT USING "finish"::text;
