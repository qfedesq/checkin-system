-- Perdón de bloqueo por vencimiento: cuando el admin desbloquea a un empleado, se guarda el
-- instante para que el cron NO vuelva a bloquearlo por un vencimiento ya existente. El auto-bloqueo
-- sólo se dispara de nuevo si vence un documento DESPUÉS de esta marca, o si el admin bloquea a mano.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "expiryBlockClearedAt" TIMESTAMP(3);
