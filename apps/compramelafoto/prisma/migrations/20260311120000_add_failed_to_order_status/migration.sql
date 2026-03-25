-- Add FAILED to OrderStatus enum (pago rechazado/cancelado por webhook MP)
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'FAILED';
