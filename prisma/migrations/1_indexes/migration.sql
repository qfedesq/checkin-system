-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentUpload_status_idx" ON "DocumentUpload"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attendance_checkOutAt_idx" ON "Attendance"("checkOutAt");

-- QA-008: cierra el race de doble check-in — sólo puede existir una jornada
-- abierta (checkOutAt IS NULL) por usuario. No expresable en schema.prisma
-- (partial index), se agrega vía SQL crudo.
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_one_open_per_user" ON "Attendance"("userId") WHERE "checkOutAt" IS NULL;
