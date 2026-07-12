-- "Visto" en bandeja (badge de no leídos) + posición exacta de la firma. Aditivo/nullable.
ALTER TABLE "DeliveredDocument" ADD COLUMN IF NOT EXISTS "signX" DOUBLE PRECISION;
ALTER TABLE "DeliveredDocument" ADD COLUMN IF NOT EXISTS "signY" DOUBLE PRECISION;
ALTER TABLE "DeliveredDocument" ADD COLUMN IF NOT EXISTS "seenAt" TIMESTAMP(3);
