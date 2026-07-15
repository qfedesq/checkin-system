import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";
import { route } from "@/lib/route";

const body = z.object({ legajo: z.string().min(1), hireDate: z.string() });

export const POST = route("admin.users.approve", async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const collision = await prisma.employeeProfile.findUnique({ where: { legajo: parsed.data.legajo } });
  if (collision && collision.userId !== id) {
    return NextResponse.json({ error: "Legajo ya utilizado" }, { status: 409 });
  }

  const hireDate = new Date(parsed.data.hireDate);
  if (Number.isNaN(hireDate.getTime())) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { status: "ACTIVE", approvedAt: new Date(), approvedById: session.user.id },
    });
    const existing = await tx.employeeProfile.findUnique({ where: { userId: id } });
    if (existing) {
      await tx.employeeProfile.update({ where: { userId: id }, data: { legajo: parsed.data.legajo, hireDate } });
    } else {
      // Si no hay profile todavía, pre-creamos con placeholders para que la FK del legajo quede; el empleado los completa luego.
      await tx.employeeProfile.create({
        data: {
          userId: id,
          legajo: parsed.data.legajo,
          hireDate,
          lastName: "",
          firstName: "",
          dob: new Date("1970-01-01"),
          cuil: `PENDING-${id.slice(0, 8)}`,
          category: "HELPER",
          phone: "",
          healthCardExpiry: new Date("2099-12-31"),
          foodCourseExpiry: new Date("2099-12-31"),
          shirtSize: "",
          hoodieSize: "",
          jacketSize: "",
          pantsSize: "",
          shoeSize: "",
          address: "",
          addressNumber: "",
          neighborhood: "",
          city: "",
          postalCode: "",
          emergencyContact: "",
          emergencyPhone: "",
        },
      });
    }
    });
  } catch (e) {
    // QA: defensa ante colisión de legajo por carrera (el pre-check de arriba no es atómico
    // con el create/update de acá adentro) — sin esto, el 500 genérico del wrapper `route`
    // ocultaba que el conflicto era simplemente un legajo duplicado.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const field = String(e.meta?.target ?? "");
      const message = field.includes("legajo")
        ? "Legajo ya utilizado"
        : field.includes("cuil")
          ? "Ese CUIL ya está registrado"
          : "Ya existe un registro con ese valor";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw e;
  }

  await recordAudit({ actorId: session.user.id, action: "user.approve", subjectId: id, metadata: { legajo: parsed.data.legajo } });
  return NextResponse.json({ ok: true });
});
