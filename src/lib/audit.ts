import "server-only";
import { prisma } from "./prisma";
import { logError } from "./log";

export async function recordAudit(input: { actorId?: string | null; action: string; subjectId?: string; metadata?: Record<string, unknown> }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        subjectId: input.subjectId,
        metadata: input.metadata as never,
      },
    });
  } catch (err) {
    logError("audit", err);
  }
}
