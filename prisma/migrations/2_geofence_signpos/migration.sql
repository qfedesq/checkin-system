-- Geocerca de check-in por empleado (F4) + posición de firma en entregas (F2).
-- Todas las columnas son aditivas y nullable / con default → seguro sin downtime.

ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "checkinLat" DOUBLE PRECISION;
ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "checkinLng" DOUBLE PRECISION;
ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "checkinRadiusM" INTEGER NOT NULL DEFAULT 100;

ALTER TABLE "DeliveredDocument" ADD COLUMN IF NOT EXISTS "signAnchor" TEXT;
ALTER TABLE "DeliveredDocument" ADD COLUMN IF NOT EXISTS "signPage" INTEGER;
