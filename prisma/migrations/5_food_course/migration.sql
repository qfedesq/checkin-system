-- Curso de manipulación de alimentos: vencimiento + frente/dorso, mismas características que la libreta sanitaria.
-- Aditivo y retro-compatible. La columna de vencimiento es NOT NULL con DEFAULT sentinela 2099-12-31 (mismo criterio que
-- healthCardExpiry usa como "sin dato"): así el backfill de filas existentes y cualquier insert del código anterior durante
-- la ventana de deploy no rompen. El código nuevo siempre provee un valor real (y TS lo exige en cada create).
ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "foodCourseExpiry" TIMESTAMP(3) NOT NULL DEFAULT '2099-12-31 00:00:00';
ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "foodCourseFrontBlobUrl" TEXT;
ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "foodCourseBackBlobUrl" TEXT;
ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "notifiedFoodCourseExpiryAt" TIMESTAMP(3);

-- Nuevo motivo de bloqueo automático por curso vencido.
ALTER TYPE "DisableReason" ADD VALUE IF NOT EXISTS 'EXPIRED_FOOD_COURSE';
