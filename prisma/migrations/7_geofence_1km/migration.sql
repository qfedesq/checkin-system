-- Margen de geocerca por defecto: 100 m → 1000 m (1 km). Pedido del cliente.
-- Cambia el default de la columna y lleva a 1 km todas las filas existentes (el admin puede
-- ajustar un radio menor por empleado desde la ficha; mínimo permitido 20 m).
ALTER TABLE "EmployeeProfile" ALTER COLUMN "checkinRadiusM" SET DEFAULT 1000;
ALTER TABLE "EmployeeProfile" ALTER COLUMN "checkoutRadiusM" SET DEFAULT 1000;
UPDATE "EmployeeProfile" SET "checkinRadiusM" = 1000, "checkoutRadiusM" = 1000;
