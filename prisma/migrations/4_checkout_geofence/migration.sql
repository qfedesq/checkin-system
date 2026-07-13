-- Geocerca de check-out independiente de la de check-in. Aditivo/nullable + default.
ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "checkoutLat" DOUBLE PRECISION;
ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "checkoutLng" DOUBLE PRECISION;
ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "checkoutRadiusM" INTEGER NOT NULL DEFAULT 100;
