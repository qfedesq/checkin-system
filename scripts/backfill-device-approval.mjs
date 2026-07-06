#!/usr/bin/env node
/**
 * Backfill OBLIGATORIO al deployar v0.16: aprueba los dispositivos ya registrados
 * para que los usuarios existentes no queden bloqueados para fichar.
 *
 * Uso: DATABASE_URL=... node scripts/backfill-device-approval.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const result = await prisma.user.updateMany({
  where: { deviceId: { not: null }, deviceApprovedAt: null },
  data: { deviceApprovedAt: new Date() },
});

console.log(`Dispositivos aprobados retroactivamente: ${result.count}`);
await prisma.$disconnect();
